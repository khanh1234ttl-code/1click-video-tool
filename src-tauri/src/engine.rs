//! Executes runner Effects: talks to the bridge, copies/probes downloads, runs ffmpeg (max 2),
//! saves the project and notifies the UI.
use crate::bridge::{Bridge, BridgeEvent, FromExt, JobItem, JobSettings, ToExt};
use crate::chrome_window::Bounds;
use crate::import::{rows_from_images, scan_files, IMAGE_EXTS};
use crate::media::{self, MixParams};
use crate::model::{Project, RowStatus};
use crate::project::{self, AppSettings};
use crate::runner::{Effect, Runner};
use futures_util::future::BoxFuture;
use serde::Serialize;
use std::collections::{BTreeMap, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tokio::sync::{mpsc, Semaphore};

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub connected: bool,
    pub ext_id: Option<String>,
    pub ext_version: Option<String>,
    pub ffmpeg: Option<String>,
    pub running: bool,
    pub hide_chrome: bool,
    /// The Vids window has been reported by the extension (so it can be hidden).
    pub chrome_window: bool,
}

#[cfg(test)]
#[path = "engine_tests.rs"]
mod review_tests;

/// Post-processing needs both tools: ffprobe validates downloads and sizes the overlay.
fn missing_media_tools(ffmpeg: Option<&Path>, ffprobe: Option<&Path>) -> Option<String> {
    match (ffmpeg, ffprobe) {
        (None, _) => Some("Không tìm thấy FFmpeg. Chọn thư mục FFmpeg trong tab Chạy.".into()),
        (_, None) => Some("Không tìm thấy ffprobe (đi kèm FFmpeg). Chọn thư mục FFmpeg có ffprobe.exe trong tab Chạy.".into()),
        _ => None,
    }
}

pub enum EngineEvent {
    Project(Project),
    Status(Status),
    Toast(String),
}

struct State {
    runner: Option<Runner>,
    settings: AppSettings,
    ext_version: Option<String>,
    epoch: u64,
    next_operation: u64,
    operations: BTreeMap<u32, u64>,
    chrome_bounds: Option<Bounds>,
    /// Last visibility asked of the Vids window (also what tests observe).
    chrome_visible_requested: Option<bool>,
}

type Effects = (u64, Vec<OwnedEffect>);

/// Engine effects have immutable ownership before leaving the mutation/save transaction.
enum OwnedEffect {
    Submit { job_id: String, operations: Vec<Operation> },
    Send(ToExt),
    ImportRaw { op: Operation, from: PathBuf },
    PostProcess(Operation),
    Notify(String),
}

#[derive(Clone)]
struct Operation {
    epoch: u64,
    id: u64,
    stt: u32,
    job_id: Option<String>,
    postprocess: bool,
    project: Project,
    ffmpeg: Option<PathBuf>,
    ffprobe: Option<PathBuf>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
enum FileAction { Publish, Restore, RemovePublished, RemoveBackup }

pub struct Engine {
    state: Mutex<State>,
    bridge: Bridge,
    app_dir: PathBuf,
    notify: Arc<dyn Fn(EngineEvent) + Send + Sync>,
    ffmpeg_slots: Semaphore,
    #[cfg(test)]
    test_hooks: Arc<review_tests::TestHooks>,
}

impl Engine {
    pub fn new(bridge: Bridge, app_dir: PathBuf, notify: Arc<dyn Fn(EngineEvent) + Send + Sync>) -> Arc<Engine> {
        let settings = project::load_settings(&app_dir);
        Arc::new(Engine { state: Mutex::new(State { runner: None, settings, ext_version: None, epoch: 0, next_operation: 0, operations: BTreeMap::new(), chrome_bounds: None, chrome_visible_requested: None }), bridge, app_dir, notify, ffmpeg_slots: Semaphore::new(2), #[cfg(test)] test_hooks: Arc::new(review_tests::TestHooks::default()) })
    }

    pub fn app_dir(&self) -> PathBuf {
        self.app_dir.clone()
    }

    fn tools(&self) -> (Option<PathBuf>, Option<PathBuf>) {
        let st = self.state.lock().unwrap();
        (media::find_tool("ffmpeg", st.settings.ffmpeg.as_deref()), media::find_tool("ffprobe", st.settings.ffprobe.as_deref()))
    }

    pub fn status(&self) -> Status {
        // Report FFmpeg as available only when ffprobe is too, so the Run tab offers the picker.
        let (ff, fp) = self.tools();
        let ffmpeg = ff.filter(|_| fp.is_some()).map(|p| p.to_string_lossy().into_owned());
        let st = self.state.lock().unwrap();
        Status {
            connected: self.bridge.is_connected(),
            ext_id: self.bridge.allowed_id(),
            ext_version: st.ext_version.clone(),
            ffmpeg,
            running: st.runner.as_ref().map_or(false, |r| r.running),
            hide_chrome: st.settings.hide_chrome,
            chrome_window: st.chrome_bounds.is_some(),
        }
    }

    /// Shows or hides the reported Vids window. The Win32 call runs after the lock is released.
    fn set_chrome_visible(&self, visible: bool) {
        let bounds = {
            let mut st = self.state.lock().unwrap();
            st.chrome_visible_requested = Some(visible);
            st.chrome_bounds
        };
        if let Some(b) = bounds {
            crate::chrome_window::set_visible(&b, visible);
        }
    }

    /// Saves the "hide Chrome" choice and applies it to the Vids window right away.
    pub fn set_hide_chrome(&self, hide: bool) -> Result<(), String> {
        {
            let mut st = self.state.lock().unwrap();
            st.settings.hide_chrome = hide;
            project::save_settings(&self.app_dir, &st.settings).map_err(|e| e.to_string())?;
        }
        self.set_chrome_visible(!hide);
        self.emit_status();
        Ok(())
    }

    /// Brings the Vids window back, e.g. when the tool exits.
    pub fn restore_chrome(&self) {
        self.set_chrome_visible(true);
    }

    fn emit_status(&self) {
        (self.notify)(EngineEvent::Status(self.status()));
    }

    pub fn project(&self) -> Option<Project> {
        self.state.lock().unwrap().runner.as_ref().map(|r| r.project.clone())
    }

    pub fn spawn_event_loop(self: &Arc<Self>, mut rx: mpsc::UnboundedReceiver<BridgeEvent>) {
        let me = self.clone();
        tokio::spawn(async move {
            while let Some(ev) = rx.recv().await {
                me.clone().on_bridge_event(ev).await;
            }
        });
    }

    /// Sync on purpose: the std Mutex guard must never live across an `.await`.
    fn effects_for(&self, ev: BridgeEvent) -> Effects {
        let mut st = self.state.lock().unwrap();
        let before = st.runner.clone();
        let fx = match ev {
            BridgeEvent::Connected { ext_id } => {
                if st.settings.allowed_extension_id.as_deref() != Some(&ext_id) {
                    st.settings.allowed_extension_id = Some(ext_id);
                    let _ = project::save_settings(&self.app_dir, &st.settings);
                }
                st.runner.as_ref().map(|r| r.on_connected()).unwrap_or_default()
            }
            BridgeEvent::Disconnected => {
                st.ext_version = None;
                vec![]
            }
            BridgeEvent::Message(m) => {
                if let FromExt::Hello { ext_version } = &m {
                    st.ext_version = Some(ext_version.clone());
                }
                st.runner.as_mut().map(|r| r.on_message(m)).unwrap_or_default()
            }
        };
        self.commit_or_notify(&mut st, before, fx)
    }

    async fn on_bridge_event(self: Arc<Self>, ev: BridgeEvent) {
        match &ev {
            BridgeEvent::Message(FromExt::WindowInfo { left, top, width, height, .. }) => {
                let hide = {
                    let mut st = self.state.lock().unwrap();
                    st.chrome_bounds = Some(Bounds { left: *left, top: *top, width: *width, height: *height });
                    st.settings.hide_chrome
                };
                self.set_chrome_visible(!hide);
                self.emit_status();
                return;
            }
            // The user may have to sign in or fix something in Chrome.
            BridgeEvent::Message(FromExt::JobRejected { .. }) => self.set_chrome_visible(true),
            BridgeEvent::Connected { .. } => {
                self.bridge.send(&ToExt::WindowQuery);
            }
            _ => {}
        }
        let fx = self.effects_for(ev);
        self.emit_status();
        self.apply(fx).await;
    }

    /// Opens `<image_dir>/_1click/project.json`, or creates a project from the images.
    pub fn open_project(self: &Arc<Self>, image_dir: &Path) -> Result<Project, String> {
        let mut st = self.state.lock().unwrap();
        let project = match project::load(image_dir).map_err(|e| e.to_string())? {
            Some(p) => p,
            None => {
                let images = scan_files(image_dir, &IMAGE_EXTS).map_err(|e| e.to_string())?;
                if images.is_empty() {
                    return Err("Folder không có ảnh (jpg, png, webp)".into());
                }
                let p = Project::new(image_dir.to_path_buf(), rows_from_images(images));
                project::save(&p).map_err(|e| e.to_string())?;
                p
            }
        };
        let mut runner = Runner::new(project);
        let mut fx = runner.recover_after_load();
        if self.bridge.is_connected() {
            fx.extend(runner.on_connected());
        }
        let before = st.runner.clone();
        let old_epoch = st.epoch;
        let old_operations = st.operations.clone();
        st.epoch += 1;
        st.operations.clear();
        st.runner = Some(runner);
        let fx = match self.commit_locked(&mut st, before, fx) {
            Ok(fx) => fx,
            Err(err) => { st.epoch = old_epoch; st.operations = old_operations; return Err(err); }
        };
        let p = st.runner.as_ref().unwrap().project.clone();
        drop(st);
        self.emit_status();
        let me = self.clone();
        tokio::spawn(async move { me.apply(fx).await });
        Ok(p)
    }

    /// Applies a user edit to the open project, saves it and notifies the UI.
    pub fn edit(&self, f: impl FnOnce(&mut Project)) -> Result<(), String> {
        self.edit_checked(None, f)
    }

    pub fn edit_scoped(&self, image_dir: &Path, f: impl FnOnce(&mut Project)) -> Result<(), String> {
        self.edit_checked(Some(image_dir), f)
    }

    fn edit_checked(&self, image_dir: Option<&Path>, f: impl FnOnce(&mut Project)) -> Result<(), String> {
        let mut st = self.state.lock().unwrap();
        let r = st.runner.as_mut().ok_or("Chưa mở dự án")?;
        if image_dir.is_some_and(|dir| r.project.image_dir != dir) {
            return Err("Dự án đã thay đổi; không thể lưu chỉnh sửa cũ".into());
        }
        let before = r.project.clone();
        f(&mut r.project);
        if let Err(e) = project::save(&r.project) {
            r.project = before;
            return Err(e.to_string());
        }
        (self.notify)(EngineEvent::Project(r.project.clone()));
        Ok(())
    }

    pub fn save_named_preset(&self, image_dir: &Path, name: &str) -> Result<(), String> {
        let st = self.state.lock().unwrap();
        let p = &st.runner.as_ref().ok_or("Chưa mở dự án")?.project;
        if p.image_dir != image_dir {
            return Err("Dự án đã thay đổi; không thể lưu preset cũ".into());
        }
        project::save_preset(&self.app_dir, name, &p.preset).map_err(|e| e.to_string())
    }

    pub fn load_named_preset(&self, image_dir: &Path, name: &str) -> Result<crate::model::Preset, String> {
        let preset = project::load_preset(&self.app_dir, name).map_err(|e| e.to_string())?;
        self.edit_scoped(image_dir, |p| p.preset = preset.clone())?;
        Ok(preset)
    }

    pub async fn start(self: &Arc<Self>) -> Result<(), String> {
        if !self.bridge.is_connected() {
            return Err("Extension chưa kết nối. Mở Chrome có cài extension 1Click rồi thử lại.".into());
        }
        let (ffmpeg, ffprobe) = self.tools();
        if let Some(e) = missing_media_tools(ffmpeg.as_deref(), ffprobe.as_deref()) {
            return Err(e);
        }
        let fx = self.start_effects()?;
        self.emit_status();
        self.apply(fx).await;
        self.emit_status();
        Ok(())
    }

    /// Sync helper so neither the Mutex guard nor ThreadRng is held across an `.await`.
    fn start_effects(&self) -> Result<Effects, String> {
        let mut st = self.state.lock().unwrap();
        let before = st.runner.clone();
        let r = st.runner.as_mut().ok_or("Chưa mở dự án")?;
        let tracks = crate::music::list_tracks(r.project.preset.music.folder.as_deref());
        let fx = r.start(&tracks, &mut rand::thread_rng())?;
        self.commit_locked(&mut st, before, fx)
    }

    /// Mutation, snapshot and durable write are one synchronous transaction.
    /// Restore the entire runner on failure, including its transient duplicate/failure guards.
    fn commit_locked(&self, st: &mut State, before: Option<Runner>, fx: Vec<Effect>) -> Result<Effects, String> {
        let before_operations = st.operations.clone();
        let changed = !fx.is_empty();
        let owned = self.capture_effects(st, fx);
        if changed {
            if let Some(r) = st.runner.as_ref() {
                if let Err(err) = project::save(&r.project) {
                    st.runner = before;
                    st.operations = before_operations;
                    return Err(format!("Không lưu được dự án: {err}"));
                }
                (self.notify)(EngineEvent::Project(r.project.clone()));
            }
        }
        Ok((st.epoch, owned))
    }

    fn commit_or_notify(&self, st: &mut State, before: Option<Runner>, fx: Vec<Effect>) -> Effects {
        self.commit_locked(st, before, fx).unwrap_or_else(|err| (st.epoch, vec![OwnedEffect::Notify(err)]))
    }

    fn with_runner(&self, f: impl FnOnce(&mut Runner) -> Vec<Effect>) -> Effects {
        let mut st = self.state.lock().unwrap();
        let before = st.runner.clone();
        // A PostProcessing row without a claim is a completed worker whose save failed.
        // Rearm it only on the next explicit local action; there is no automatic retry loop.
        let abandoned: Vec<_> = st.runner.as_ref().map(|r| r.project.rows.iter()
            .filter(|row| row.status == RowStatus::PostProcessing && !st.operations.contains_key(&row.stt))
            .map(|row| row.stt).collect()).unwrap_or_default();
        if let Some(r) = st.runner.as_mut() {
            for stt in abandoned { r.on_postprocess_done(stt, Err("Lưu kết quả thất bại; có thể hậu kỳ lại".into())); }
        }
        let fx = st.runner.as_mut().map(f).unwrap_or_default();
        self.commit_or_notify(&mut st, before, fx)
    }

    pub async fn pause(self: &Arc<Self>) {
        let fx = {
            let mut st = self.state.lock().unwrap();
            let before = st.runner.clone();
            let fx = st.runner.as_mut().map(|r| r.pause()).unwrap_or_default();
            match self.commit_locked(&mut st, before, fx) {
                Ok(fx) => { st.operations.clear(); fx }
                Err(err) => (st.epoch, vec![OwnedEffect::Notify(err)]),
            }
        };
        self.apply(fx).await;
        self.emit_status();
    }

    pub async fn retry(self: &Arc<Self>, stts: &[u32]) {
        let fx = self.with_runner(|r| r.retry(stts));
        self.apply(fx).await;
        self.emit_status();
    }

    pub async fn reprocess(self: &Arc<Self>, stts: &[u32]) {
        let fx = self.with_runner(|r| r.reprocess(stts));
        self.apply(fx).await;
        self.emit_status();
    }

    pub fn set_ffmpeg_dir(&self, dir: &Path) -> Result<(), String> {
        let (ff, fp) = (dir.join("ffmpeg.exe"), dir.join("ffprobe.exe"));
        if !ff.is_file() || !fp.is_file() {
            return Err("Thư mục phải chứa ffmpeg.exe và ffprobe.exe".into());
        }
        let mut st = self.state.lock().unwrap();
        st.settings.ffmpeg = Some(ff);
        st.settings.ffprobe = Some(fp);
        project::save_settings(&self.app_dir, &st.settings).map_err(|e| e.to_string())?;
        drop(st);
        self.emit_status();
        Ok(())
    }

    pub fn reset_extension(&self) {
        self.bridge.reset_allowed();
        let mut st = self.state.lock().unwrap();
        st.settings.allowed_extension_id = None;
        let _ = project::save_settings(&self.app_dir, &st.settings);
        drop(st);
        self.emit_status();
    }

    fn operation_matches(st: &State, op: &Operation) -> bool {
        st.epoch == op.epoch
            && st.operations.get(&op.stt) == Some(&op.id)
            && st.runner.as_ref().and_then(|r| r.project.row(op.stt))
                .map_or(false, |r| r.job_id == op.job_id && if op.postprocess {
                    r.status == RowStatus::PostProcessing
                } else { r.status.is_active() })
    }

    /// Called only while the originating mutation transaction still holds the mutex.
    fn capture_effects(&self, st: &mut State, fx: Vec<Effect>) -> Vec<OwnedEffect> {
        let mut owned = Vec::new();
        for effect in fx {
            match effect {
                Effect::Save | Effect::Changed => {},
                Effect::Notify(t) => owned.push(OwnedEffect::Notify(t)),
                Effect::Send(m) => owned.push(OwnedEffect::Send(m)),
                Effect::Submit { job_id, stts } => {
                    // Validate the whole batch before inserting any claim.
                    let valid = st.runner.as_ref().map_or(false, |r| stts.iter().all(|stt|
                        r.project.row(*stt).map_or(false, |row| row.status.is_active() && row.job_id.as_deref() == Some(&job_id))));
                    if valid {
                        let operations = stts.into_iter().filter_map(|stt| self.claim_locked(st, stt, false)).collect();
                        owned.push(OwnedEffect::Submit { job_id, operations });
                    }
                }
                Effect::ImportRaw { stt, from } => {
                    if let Some(op) = self.claim_locked(st, stt, false) { owned.push(OwnedEffect::ImportRaw { op, from }); }
                }
                Effect::PostProcess(stt) => {
                    if let Some(op) = self.claim_locked(st, stt, true) { owned.push(OwnedEffect::PostProcess(op)); }
                }
            }
        }
        owned
    }

    fn claim_locked(&self, st: &mut State, stt: u32, postprocess: bool) -> Option<Operation> {
        let row = st.runner.as_ref()?.project.row(stt)?;
        let eligible = if postprocess {
            row.raw_video.is_some() && matches!(row.status, RowStatus::Downloaded | RowStatus::Generated | RowStatus::Done | RowStatus::Failed { stage: crate::model::Stage::PostProcess, .. })
        } else { row.status.is_active() };
        if !eligible { return None; }
        if postprocess { st.runner.as_mut()?.on_postprocess_started(stt); }
        st.next_operation += 1;
        let id = st.next_operation;
        st.operations.insert(stt, id);
        let p = st.runner.as_ref()?.project.clone();
        Some(Operation {
            epoch: st.epoch, id, stt, job_id: p.row(stt)?.job_id.clone(), postprocess, project: p,
            ffmpeg: media::find_tool("ffmpeg", st.settings.ffmpeg.as_deref()),
            ffprobe: media::find_tool("ffprobe", st.settings.ffprobe.as_deref()),
        })
    }

    fn apply(self: &Arc<Self>, effects: Effects) -> BoxFuture<'static, ()> {
        let me = self.clone();
        Box::pin(async move {
            let (epoch, effects) = effects;
            let mut queue: VecDeque<OwnedEffect> = effects.into();
            while let Some(e) = queue.pop_front() {
                match e {
                    OwnedEffect::Notify(t) => {
                        if me.state.lock().unwrap().epoch == epoch { (me.notify)(EngineEvent::Toast(t)); }
                    }
                    OwnedEffect::Send(m) => {
                        let st = me.state.lock().unwrap();
                        if st.epoch == epoch { me.bridge.send(&m); }
                    }
                    OwnedEffect::Submit { job_id, operations } => {
                        let (next_epoch, fx) = me.submit(epoch, job_id, operations).await;
                        if next_epoch == epoch { queue.extend(fx); }
                    }
                    OwnedEffect::ImportRaw { op, from } => {
                        if Self::operation_matches(&me.state.lock().unwrap(), &op) {
                            let m2 = me.clone();
                            tokio::spawn(async move {
                                let result = m2.import_raw(&op, from).await;
                                let fx = m2.finish_operation(&op, result);
                                m2.apply(fx).await;
                                m2.emit_status();
                                #[cfg(test)]
                                m2.test_hooks.finished.add_permits(1);
                            });
                        }
                    }
                    OwnedEffect::PostProcess(op) => {
                        if Self::operation_matches(&me.state.lock().unwrap(), &op) {
                            me.emit_status();
                            let m2 = me.clone();
                            tokio::spawn(async move {
                                m2.clone().post_process(op).await;
                                #[cfg(test)]
                                m2.test_hooks.finished.add_permits(1);
                            });
                        }
                    }
                }
            }
        })
    }

    async fn submit(self: &Arc<Self>, epoch: u64, job_id: String, operations: Vec<Operation>) -> Effects {
        if !operations.iter().all(|op| Self::operation_matches(&self.state.lock().unwrap(), op)) { return (epoch, vec![]); }
        let Some(first) = operations.first() else { return (epoch, vec![]); };
        let project = first.project.clone();
        let paths: Vec<_> = operations.iter().map(|op| (op.stt, op.project.row(op.stt).unwrap().image_path.clone())).collect();
        #[cfg(test)]
        let hooks = self.test_hooks.clone();
        let encoded = tokio::task::spawn_blocking(move || {
            #[cfg(test)]
            hooks.checkpoint_blocking(review_tests::Boundary::Encode);
            paths.into_iter().map(|(stt, p)| (stt, media::encode_image_for_upload(&p))).collect::<Vec<_>>()
        }).await;
        // The checks and all transport enqueueing share the mutation mutex with Pause/Open.
        let mut st = self.state.lock().unwrap();
        if !operations.iter().all(|op| Self::operation_matches(&st, op)) { return (epoch, vec![]); }
        let encoded = match encoded {
            Ok(values) => values,
            Err(err) => return self.revert_locked(&mut st, &job_id, &err.to_string()),
        };
        let mut items = Vec::new();
        for (stt, res) in encoded {
            let (name, base64) = match res {
                Ok(v) => v,
                Err(err) => return self.revert_locked(&mut st, &job_id, &err.to_string()),
            };
            let id = format!("{job_id}-{stt}");
            if !self.bridge.send(&ToExt::ImagePut { id: id.clone(), name, base64 }) {
                return self.revert_locked(&mut st, &job_id, "Mất kết nối extension");
            }
            items.push(JobItem { index: stt, prompt: project.effective_prompt(project.row(stt).unwrap()), image_id: id });
        }
        let g = &project.preset.gen;
        let settings = JobSettings { mode: g.mode.as_ext().into(), aspect_ratio: g.aspect_ratio.clone(), quality: g.quality.clone(), concurrency: g.concurrency, max_retries: g.max_retries };
        if !self.bridge.send(&ToExt::JobSubmit { job_id: job_id.clone(), settings, items }) {
            return self.revert_locked(&mut st, &job_id, "Mất kết nối extension");
        }
        (epoch, vec![])
    }

    fn revert_locked(&self, st: &mut State, job_id: &str, reason: &str) -> Effects {
        let before = st.runner.clone();
        let fx = st.runner.as_mut().map(|r| r.revert_submit(job_id, reason)).unwrap_or_default();
        self.commit_or_notify(st, before, fx)
    }

    fn temporary(op: &Operation, dir: &Path) -> PathBuf {
        dir.join(format!(".oneclick-{}-{}-{:03}.mp4", op.epoch, op.id, op.stt))
    }

    async fn import_raw(&self, op: &Operation, from: PathBuf) -> Result<PathBuf, String> {
        let raw_dir = op.project.work_dir().join("raw");
        let dest = Self::temporary(op, &raw_dir);
        let cleanup = dest.clone();
        let ffprobe = op.ffprobe.clone().ok_or("Không tìm thấy ffprobe")?;
        #[cfg(test)]
        self.test_hooks.imports.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        let result = tokio::task::spawn_blocking(move || {
            std::fs::create_dir_all(&raw_dir).map_err(|e| e.to_string())?;
            std::fs::copy(&from, &dest).map_err(|e| format!("Không chép được video tải về ({}): {e}", from.display()))?;
            media::probe(&ffprobe, &dest).map_err(|e| format!("Video tải về bị hỏng: {e}"))?;
            Ok(dest)
        }).await.unwrap_or_else(|e| Err(e.to_string()));
        #[cfg(test)]
        self.test_hooks.checkpoint(review_tests::Boundary::Import).await;
        if result.is_err() { let _ = std::fs::remove_file(cleanup); }
        result
    }

    async fn post_process(self: Arc<Self>, op: Operation) {
        #[cfg(test)]
        self.test_hooks.checkpoint(review_tests::Boundary::Queued).await;
        let _slot = self.ffmpeg_slots.acquire().await.expect("semaphore open");
        if !Self::operation_matches(&self.state.lock().unwrap(), &op) { return; }
        let p = &op.project;
        let r = p.row(op.stt).expect("claimed row");
        let overlay = p.work_dir().join("overlays").join(format!("{:03}.png", op.stt));
        let overlay = (!r.text.trim().is_empty() && overlay.is_file()).then_some(overlay);
        let m = &p.preset.music;
        let mix = r.resolved_music.clone().filter(|f| f.is_file()).map(|music| MixParams { music, music_volume: m.music_volume, fade_in: m.fade_in, fade_out: m.fade_out });
        let original_volume = m.original_volume;
        let out_dir = p.preset.output.folder.clone().unwrap_or_else(|| p.image_dir.join("Output"));
        let temp = Self::temporary(&op, &out_dir);
        let cleanup = temp.clone();
        let raw = r.raw_video.clone();
        #[cfg(test)]
        self.test_hooks.processes.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        #[cfg(test)]
        let hooks = self.test_hooks.clone();
        let result = match (raw, op.ffmpeg.clone(), op.ffprobe.clone()) {
            (Some(raw), Some(ffmpeg), Some(ffprobe)) => tokio::task::spawn_blocking(move || -> Result<PathBuf, String> {
                std::fs::create_dir_all(&out_dir).map_err(|e| e.to_string())?;
                let probe = media::probe(&ffprobe, &raw).map_err(|e| e.to_string())?;
                #[cfg(test)]
                hooks.checkpoint_blocking(review_tests::Boundary::Process);
                media::run_tool(&ffmpeg, &media::build_args(&raw, overlay.as_deref(), mix.as_ref(), original_volume, &probe, &temp)).map_err(|e| e.to_string())?;
                Ok(temp)
            }).await.unwrap_or_else(|e| Err(e.to_string())),
            (None, _, _) => Err("Thiếu video gốc".into()),
            _ => Err("Không tìm thấy FFmpeg".into()),
        };
        if result.is_err() { let _ = std::fs::remove_file(cleanup); }
        let fx = self.finish_operation(&op, result);
        self.apply(fx).await;
        self.emit_status();
    }

    fn file_action(&self, action: FileAction, from: &Path, to: Option<&Path>) -> std::io::Result<()> {
        #[cfg(test)]
        if self.test_hooks.fs_faults.lock().unwrap().remove(&action) {
            return Err(std::io::Error::other(format!("injected {action:?} failure")));
        }
        match action {
            FileAction::Publish | FileAction::Restore => std::fs::rename(from, to.expect("rename destination")),
            FileAction::RemovePublished | FileAction::RemoveBackup => std::fs::remove_file(from),
        }
    }

    fn rollback_publication(&self, final_path: &Path, backup: Option<&Path>, remove_published: bool) -> Result<(), String> {
        let describe = |err: std::io::Error| format!("Không khôi phục được {}: {err}. Bản sao cần khôi phục: {}", final_path.display(), backup.map(|p| p.display().to_string()).unwrap_or_else(|| "không có; giữ file hiện tại để kiểm tra".into()));
        if remove_published {
            // Do not try to rename over a published file that could not be removed.
            self.file_action(FileAction::RemovePublished, final_path, None).map_err(&describe)?;
        }
        if let Some(backup) = backup {
            self.file_action(FileAction::Restore, backup, Some(final_path)).map_err(describe)?;
        }
        Ok(())
    }

    /// File publication and row publication are serialized with identity checks and persistence.
    /// Keep a replaced file until the new project snapshot is durable, so save failure rolls back I/O.
    fn finish_operation(&self, op: &Operation, result: Result<PathBuf, String>) -> Effects {
        let mut st = self.state.lock().unwrap();
        if !Self::operation_matches(&st, op) {
            if let Ok(temp) = result { let _ = std::fs::remove_file(temp); }
            return (op.epoch, vec![]);
        }
        let before = st.runner.clone();
        let mut published = None;
        let result = result.and_then(|temp| {
            let row = op.project.row(op.stt).unwrap();
            let final_path = if op.postprocess {
                let out_dir = op.project.preset.output.folder.clone().unwrap_or_else(|| op.project.image_dir.join("Output"));
                media::output_path(&out_dir, op.stt, &row.image_stem(), op.project.preset.output.overwrite)
            } else { op.project.work_dir().join("raw").join(format!("{:03}.mp4", op.stt)) };
            // A stable reserved backup protects recovery even after restarting the engine.
            let backup = final_path.with_extension("mp4.backup");
            if backup.exists() {
                let _ = std::fs::remove_file(&temp);
                return Err(format!("Không ghi đè {}: còn bản sao cần khôi phục {}", final_path.display(), backup.display()));
            }
            let existing = final_path.exists();
            if existing {
                if let Err(e) = std::fs::rename(&final_path, &backup) {
                    let _ = std::fs::remove_file(temp);
                    return Err(e.to_string());
                }
            }
            if let Err(e) = self.file_action(FileAction::Publish, &temp, Some(&final_path)) {
                let rollback = self.rollback_publication(&final_path, existing.then_some(backup.as_path()), false);
                let _ = std::fs::remove_file(temp);
                return Err(match rollback { Ok(()) => e.to_string(), Err(rollback) => format!("{e}. {rollback}") });
            }
            published = Some((final_path.clone(), existing.then_some(backup)));
            Ok(final_path)
        });
        let r = st.runner.as_mut().unwrap();
        let fx = if op.postprocess { r.on_postprocess_done(op.stt, result) } else { r.on_raw_ready(op.stt, result) };
        match self.commit_locked(&mut st, before, fx) {
            Ok(mut fx) => {
                if st.operations.get(&op.stt) == Some(&op.id) { st.operations.remove(&op.stt); }
                if let Some((final_path, Some(backup))) = published {
                    if let Err(err) = self.file_action(FileAction::RemoveBackup, &backup, None) {
                        fx.1.push(OwnedEffect::Notify(format!("Đã lưu {}, nhưng không xóa được bản sao {}: {err}. Giữ bản sao để khôi phục; chưa thể ghi đè file này.", final_path.display(), backup.display())));
                    }
                }
                fx
            }
            Err(err) => {
                if st.operations.get(&op.stt) == Some(&op.id) { st.operations.remove(&op.stt); }
                if !op.postprocess { st.runner.as_mut().unwrap().release_import(op.stt); }
                let rollback = published.map(|(final_path, backup)| self.rollback_publication(&final_path, backup.as_deref(), true));
                let message = match rollback { Some(Err(rollback)) => format!("{err}. {rollback}"), _ => err };
                (op.epoch, vec![OwnedEffect::Notify(message)])
            }
        }
    }
}
