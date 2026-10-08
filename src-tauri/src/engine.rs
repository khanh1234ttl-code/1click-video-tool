//! Executes runner Effects: talks to the bridge, copies/probes downloads, runs ffmpeg (max 2),
//! saves the project and notifies the UI.
use crate::bridge::{Bridge, BridgeEvent, FromExt, JobItem, JobSettings, ToExt};
use crate::import::{rows_from_images, scan_files, IMAGE_EXTS};
use crate::media::{self, MixParams};
use crate::model::Project;
use crate::project::{self, AppSettings};
use crate::runner::{Effect, Runner};
use futures_util::future::BoxFuture;
use serde::Serialize;
use std::collections::VecDeque;
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
}

pub struct Engine {
    state: Mutex<State>,
    bridge: Bridge,
    app_dir: PathBuf,
    notify: Arc<dyn Fn(EngineEvent) + Send + Sync>,
    ffmpeg_slots: Semaphore,
}

impl Engine {
    pub fn new(bridge: Bridge, app_dir: PathBuf, notify: Arc<dyn Fn(EngineEvent) + Send + Sync>) -> Arc<Engine> {
        let settings = project::load_settings(&app_dir);
        Arc::new(Engine { state: Mutex::new(State { runner: None, settings, ext_version: None }), bridge, app_dir, notify, ffmpeg_slots: Semaphore::new(2) })
    }

    pub fn app_dir(&self) -> PathBuf {
        self.app_dir.clone()
    }

    fn tools(&self) -> (Option<PathBuf>, Option<PathBuf>) {
        let st = self.state.lock().unwrap();
        (media::find_tool("ffmpeg", st.settings.ffmpeg.as_deref()), media::find_tool("ffprobe", st.settings.ffprobe.as_deref()))
    }

    pub fn status(&self) -> Status {
        let ffmpeg = self.tools().0.map(|p| p.to_string_lossy().into_owned());
        let st = self.state.lock().unwrap();
        Status {
            connected: self.bridge.is_connected(),
            ext_id: self.bridge.allowed_id(),
            ext_version: st.ext_version.clone(),
            ffmpeg,
            running: st.runner.as_ref().map_or(false, |r| r.running),
        }
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
    fn effects_for(&self, ev: BridgeEvent) -> Vec<Effect> {
        let mut st = self.state.lock().unwrap();
        match ev {
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
        }
    }

    async fn on_bridge_event(self: Arc<Self>, ev: BridgeEvent) {
        let fx = self.effects_for(ev);
        self.emit_status();
        self.apply(fx).await;
    }

    /// Opens `<image_dir>/_1click/project.json`, or creates a project from the images.
    pub fn open_project(self: &Arc<Self>, image_dir: &Path) -> Result<Project, String> {
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
        let p = runner.project.clone();
        self.state.lock().unwrap().runner = Some(runner);
        let me = self.clone();
        tokio::spawn(async move { me.apply(fx).await });
        Ok(p)
    }

    /// Applies a user edit to the open project, saves it and notifies the UI.
    pub fn edit(&self, f: impl FnOnce(&mut Project)) -> Result<(), String> {
        let p = {
            let mut st = self.state.lock().unwrap();
            let r = st.runner.as_mut().ok_or("Chưa mở dự án")?;
            f(&mut r.project);
            r.project.clone()
        };
        project::save(&p).map_err(|e| e.to_string())?;
        (self.notify)(EngineEvent::Project(p));
        Ok(())
    }

    pub async fn start(self: &Arc<Self>) -> Result<(), String> {
        if !self.bridge.is_connected() {
            return Err("Extension chưa kết nối. Mở Chrome có cài extension 1Click rồi thử lại.".into());
        }
        if self.tools().0.is_none() {
            return Err("Không tìm thấy FFmpeg. Chọn thư mục FFmpeg trong tab Chạy.".into());
        }
        let fx = self.start_effects()?;
        self.apply(fx).await;
        self.emit_status();
        Ok(())
    }

    /// Sync helper so neither the Mutex guard nor ThreadRng is held across an `.await`.
    fn start_effects(&self) -> Result<Vec<Effect>, String> {
        let mut st = self.state.lock().unwrap();
        let r = st.runner.as_mut().ok_or("Chưa mở dự án")?;
        let tracks = crate::music::list_tracks(r.project.preset.music.folder.as_deref());
        r.start(&tracks, &mut rand::thread_rng())
    }

    fn with_runner(&self, f: impl FnOnce(&mut Runner) -> Vec<Effect>) -> Vec<Effect> {
        self.state.lock().unwrap().runner.as_mut().map(f).unwrap_or_default()
    }

    pub async fn pause(self: &Arc<Self>) {
        let fx = self.with_runner(|r| r.pause());
        self.apply(fx).await;
        self.emit_status();
    }

    pub async fn retry(self: &Arc<Self>, stts: &[u32]) {
        let fx = self.with_runner(|r| r.retry(stts));
        self.apply(fx).await;
    }

    pub async fn reprocess(self: &Arc<Self>, stts: &[u32]) {
        let fx = self.with_runner(|r| r.reprocess(stts));
        self.apply(fx).await;
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

    fn apply(self: &Arc<Self>, effects: Vec<Effect>) -> BoxFuture<'static, ()> {
        let me = self.clone();
        Box::pin(async move {
            let mut queue: VecDeque<Effect> = effects.into();
            while let Some(e) = queue.pop_front() {
                match e {
                    Effect::Save => {
                        if let Some(p) = me.project() {
                            if let Err(err) = project::save(&p) {
                                (me.notify)(EngineEvent::Toast(format!("Không lưu được dự án: {err}")));
                            }
                        }
                    }
                    Effect::Changed => {
                        if let Some(p) = me.project() {
                            (me.notify)(EngineEvent::Project(p));
                        }
                    }
                    Effect::Notify(t) => (me.notify)(EngineEvent::Toast(t)),
                    Effect::Send(m) => {
                        me.bridge.send(&m);
                    }
                    Effect::Submit { job_id, stts } => queue.extend(me.submit(job_id, stts).await),
                    Effect::ImportRaw { stt, from } => {
                        let m2 = me.clone();
                        tokio::spawn(async move {
                            let res = m2.import_raw(stt, from).await;
                            let fx = m2.with_runner(|r| r.on_raw_ready(stt, res));
                            m2.apply(fx).await;
                        });
                    }
                    Effect::PostProcess(stt) => {
                        let m2 = me.clone();
                        tokio::spawn(async move { m2.post_process(stt).await });
                    }
                }
            }
        })
    }

    async fn submit(self: &Arc<Self>, job_id: String, stts: Vec<u32>) -> Vec<Effect> {
        let (project, rows) = {
            let st = self.state.lock().unwrap();
            let p = st.runner.as_ref().expect("runner exists").project.clone();
            let rows: Vec<_> = p.rows.iter().filter(|r| stts.contains(&r.stt)).cloned().collect();
            (p, rows)
        };
        let paths: Vec<(u32, PathBuf)> = rows.iter().map(|r| (r.stt, r.image_path.clone())).collect();
        let encoded = tokio::task::spawn_blocking(move || paths.into_iter().map(|(stt, p)| (stt, media::encode_image_for_upload(&p))).collect::<Vec<_>>()).await.expect("encode task");
        let mut items = Vec::new();
        for (stt, res) in encoded {
            let (name, base64) = match res {
                Ok(v) => v,
                Err(e) => return self.with_runner(|r| r.revert_submit(&job_id, &e.to_string())),
            };
            let id = format!("{job_id}-{stt}");
            if !self.bridge.send(&ToExt::ImagePut { id: id.clone(), name, base64 }) {
                return self.with_runner(|r| r.revert_submit(&job_id, "Mất kết nối extension"));
            }
            let row = rows.iter().find(|r| r.stt == stt).expect("row");
            items.push(JobItem { index: stt, prompt: project.effective_prompt(row), image_id: id });
        }
        let g = &project.preset.gen;
        let settings = JobSettings { mode: g.mode.as_ext().into(), aspect_ratio: g.aspect_ratio.clone(), quality: g.quality.clone(), concurrency: g.concurrency, max_retries: g.max_retries };
        if !self.bridge.send(&ToExt::JobSubmit { job_id: job_id.clone(), settings, items }) {
            return self.with_runner(|r| r.revert_submit(&job_id, "Mất kết nối extension"));
        }
        vec![]
    }

    async fn import_raw(&self, stt: u32, from: PathBuf) -> Result<PathBuf, String> {
        let (work, ffprobe) = (self.project().ok_or("Chưa mở dự án")?.work_dir(), self.tools().1.ok_or("Không tìm thấy ffprobe")?);
        tokio::task::spawn_blocking(move || {
            let raw_dir = work.join("raw");
            std::fs::create_dir_all(&raw_dir).map_err(|e| e.to_string())?;
            let dest = raw_dir.join(format!("{stt:03}.mp4"));
            std::fs::copy(&from, &dest).map_err(|e| format!("Không chép được video tải về ({}): {e}", from.display()))?;
            media::probe(&ffprobe, &dest).map_err(|e| format!("Video tải về bị hỏng: {e}"))?;
            Ok(dest)
        })
        .await
        .map_err(|e| e.to_string())?
    }

    async fn post_process(self: Arc<Self>, stt: u32) {
        let _slot = self.ffmpeg_slots.acquire().await.expect("semaphore open");
        let fx = self.with_runner(|r| r.on_postprocess_started(stt));
        self.apply(fx).await;
        let (ffmpeg, ffprobe) = self.tools();
        let job = self.project().and_then(|p| {
            let r = p.row(stt)?.clone();
            let overlay = p.work_dir().join("overlays").join(format!("{stt:03}.png"));
            let overlay = (!r.text.trim().is_empty() && overlay.is_file()).then_some(overlay);
            let m = &p.preset.music;
            let mix = r.resolved_music.clone().filter(|f| f.is_file()).map(|music| MixParams { music, music_volume: m.music_volume, original_volume: m.original_volume, fade_in: m.fade_in, fade_out: m.fade_out });
            let out_dir = p.preset.output.folder.clone().unwrap_or_else(|| p.image_dir.join("Output"));
            let stem = r.image_stem();
            Some((r.raw_video?, overlay, mix, out_dir, stem, p.preset.output.overwrite))
        });
        let result = match (job, ffmpeg, ffprobe) {
            (Some((raw, overlay, mix, out_dir, stem, overwrite)), Some(ffmpeg), Some(ffprobe)) => tokio::task::spawn_blocking(move || -> Result<PathBuf, String> {
                std::fs::create_dir_all(&out_dir).map_err(|e| e.to_string())?;
                let probe = media::probe(&ffprobe, &raw).map_err(|e| e.to_string())?;
                let out = media::output_path(&out_dir, stt, &stem, overwrite);
                media::run_tool(&ffmpeg, &media::build_args(&raw, overlay.as_deref(), mix.as_ref(), &probe, &out)).map_err(|e| e.to_string())?;
                Ok(out)
            })
            .await
            .unwrap_or_else(|e| Err(e.to_string())),
            (None, _, _) => Err("Thiếu video gốc".into()),
            _ => Err("Không tìm thấy FFmpeg".into()),
        };
        let fx = self.with_runner(|r| r.on_postprocess_done(stt, result));
        self.apply(fx).await;
    }
}
