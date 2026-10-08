//! Pure batch state machine: inputs are user actions and extension messages, outputs are Effects
//! that the engine executes (send, copy, ffmpeg, save, notify).
use crate::bridge::{FromExt, ToExt};
use crate::model::{Project, Row, RowStatus, Stage};
use crate::music::pick_music;
use rand::Rng;
use std::collections::BTreeSet;
use std::path::PathBuf;

#[derive(Debug, Clone, PartialEq)]
pub enum Effect {
    /// Encode the rows' images and send image.put + job.submit.
    Submit { job_id: String, stts: Vec<u32> },
    Send(ToExt),
    /// Copy the downloaded file into the project and probe it, then call `on_raw_ready`.
    ImportRaw { stt: u32, from: PathBuf },
    PostProcess(u32),
    Save,
    Changed,
    Notify(String),
}

pub const FAILURE_STREAK_LIMIT: u32 = 3;

#[derive(Clone)]
pub struct Runner {
    pub project: Project,
    pub running: bool,
    failure_streak: u32,
    job_counter: u64,
    importing: BTreeSet<u32>,
}

impl Runner {
    pub fn new(project: Project) -> Self {
        Self { project, running: false, failure_streak: 0, job_counter: 0, importing: BTreeSet::new() }
    }

    fn new_job_id(&mut self) -> String {
        self.job_counter += 1;
        let ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
        format!("j{ms}-{}", self.job_counter)
    }

    fn active_row(&mut self, job_id: &str, stt: u32) -> Option<&mut Row> {
        self.project.rows.iter_mut().find(|r| r.stt == stt && r.job_id.as_deref() == Some(job_id) && r.status.is_active())
    }

    fn reset_active(&mut self, job_id: Option<&str>) {
        for r in self.project.rows.iter_mut().filter(|r| r.status.is_active() && job_id.map_or(true, |j| r.job_id.as_deref() == Some(j))) {
            r.status = RowStatus::Pending;
            r.job_id = None;
            self.importing.remove(&r.stt);
        }
    }

    fn refresh_running(&mut self) {
        self.running = self.project.rows.iter().any(|r| r.status.is_active() || matches!(r.status, RowStatus::Downloaded | RowStatus::PostProcessing));
    }

    pub fn start(&mut self, tracks: &[PathBuf], rng: &mut impl Rng) -> Result<Vec<Effect>, String> {
        let stts: Vec<u32> = self.project.rows.iter().filter(|r| r.status == RowStatus::Pending).map(|r| r.stt).collect();
        if stts.is_empty() {
            return Err("Không có dòng nào đang chờ".into());
        }
        let missing: Vec<String> = self.project.rows.iter().filter(|r| stts.contains(&r.stt) && self.project.effective_prompt(r).is_empty()).map(|r| r.stt.to_string()).collect();
        if !missing.is_empty() {
            return Err(format!("Các dòng chưa có prompt: {}", missing.join(", ")));
        }
        let assigned: Vec<Option<PathBuf>> = stts.iter().map(|s| self.project.row(*s).and_then(|r| r.music.clone())).collect();
        let m = &self.project.preset.music;
        let picks = pick_music(&assigned, m.mode, m.fallback, tracks, rng);
        let job_id = self.new_job_id();
        for (stt, pick) in stts.iter().zip(picks) {
            let r = self.project.row_mut(*stt).expect("stt from rows");
            r.resolved_music = pick;
            r.status = RowStatus::Sending;
            r.job_id = Some(job_id.clone());
            r.raw_video = None;
            r.output = None;
        }
        self.running = true;
        self.failure_streak = 0;
        Ok(vec![Effect::Save, Effect::Changed, Effect::Submit { job_id, stts }])
    }

    /// The engine could not deliver the job (extension disconnected).
    pub fn revert_submit(&mut self, job_id: &str, reason: &str) -> Vec<Effect> {
        if !self.project.rows.iter().any(|r| r.job_id.as_deref() == Some(job_id) && r.status.is_active()) { return vec![]; }
        self.reset_active(Some(job_id));
        self.refresh_running();
        vec![Effect::Notify(reason.to_string()), Effect::Save, Effect::Changed]
    }

    fn fail_generate(&mut self, job_id: &str, stt: u32, error: String) -> Vec<Effect> {
        let Some(r) = self.active_row(job_id, stt) else { return vec![] };
        r.status = RowStatus::Failed { stage: Stage::Generate, message: error };
        self.importing.remove(&stt);
        self.failure_streak += 1;
        let mut fx = vec![];
        if self.failure_streak >= FAILURE_STREAK_LIMIT && self.running {
            self.running = false;
            self.reset_active(Some(job_id));
            fx.push(Effect::Send(ToExt::JobCancel { job_id: job_id.to_string() }));
            fx.push(Effect::Notify("3 dòng lỗi liên tiếp — đã dừng. Có thể đã hết lượt tạo Veo hôm nay.".into()));
        }
        self.refresh_running();
        fx.extend([Effect::Save, Effect::Changed]);
        fx
    }

    pub fn on_message(&mut self, msg: FromExt) -> Vec<Effect> {
        match msg {
            FromExt::JobRejected { job_id, error } => self.revert_submit(&job_id, &error),
            FromExt::ItemProgress { job_id, index, percent } => match self.active_row(&job_id, index) {
                Some(r) => {
                    r.status = RowStatus::Rendering { percent: percent.min(100) };
                    vec![Effect::Changed]
                }
                None => vec![],
            },
            FromExt::ItemDownloaded { job_id, index, file_path } => {
                if self.active_row(&job_id, index).is_some() && self.importing.insert(index) {
                    vec![Effect::ImportRaw { stt: index, from: file_path.into() }]
                } else { vec![] }
            },
            FromExt::ItemFailed { job_id, index, error } => self.fail_generate(&job_id, index, error),
            FromExt::JobStatus { job_id, known, done, failed, .. } => {
                if !known {
                    self.reset_active(Some(&job_id));
                    self.refresh_running();
                    return vec![Effect::Save, Effect::Changed];
                }
                let mut fx = vec![];
                for d in done {
                    if self.active_row(&job_id, d.index).is_some() && self.importing.insert(d.index) {
                        fx.push(Effect::ImportRaw { stt: d.index, from: d.file_path.into() });
                    }
                }
                for f in failed {
                    fx.extend(self.fail_generate(&job_id, f.index, f.error));
                }
                fx
            }
            FromExt::Hello { .. } | FromExt::JobAccepted { .. } | FromExt::Pong => vec![],
        }
    }

    /// The copy worker exited without a durable completion; allow job.query replay to claim it again.
    pub(crate) fn release_import(&mut self, stt: u32) { self.importing.remove(&stt); }

    pub fn on_raw_ready(&mut self, stt: u32, result: Result<PathBuf, String>) -> Vec<Effect> {
        self.importing.remove(&stt);
        let auto = self.project.preset.gen.auto_post_process;
        let Some(r) = self.project.row_mut(stt) else { return vec![] };
        let fx = match result {
            Ok(p) => {
                r.raw_video = Some(p);
                self.failure_streak = 0;
                if auto {
                    r.status = RowStatus::Downloaded;
                    vec![Effect::PostProcess(stt), Effect::Save, Effect::Changed]
                } else {
                    r.status = RowStatus::Generated;
                    vec![Effect::Save, Effect::Changed]
                }
            }
            Err(e) => {
                r.status = RowStatus::Failed { stage: Stage::Download, message: e };
                vec![Effect::Save, Effect::Changed]
            }
        };
        self.refresh_running();
        fx
    }

    pub fn on_postprocess_started(&mut self, stt: u32) -> Vec<Effect> {
        match self.project.row_mut(stt) {
            Some(r) => {
                r.status = RowStatus::PostProcessing;
                self.refresh_running();
                vec![Effect::Save, Effect::Changed]
            }
            None => vec![],
        }
    }

    pub fn on_postprocess_done(&mut self, stt: u32, result: Result<PathBuf, String>) -> Vec<Effect> {
        let Some(r) = self.project.row_mut(stt) else { return vec![] };
        match result {
            Ok(out) => {
                r.output = Some(out);
                r.status = RowStatus::Done;
            }
            Err(e) => r.status = RowStatus::Failed { stage: Stage::PostProcess, message: e },
        }
        self.refresh_running();
        vec![Effect::Save, Effect::Changed]
    }

    pub fn pause(&mut self) -> Vec<Effect> {
        let jobs: BTreeSet<String> = self.project.rows.iter().filter(|r| r.status.is_active()).filter_map(|r| r.job_id.clone()).collect();
        self.reset_active(None);
        self.importing.clear();
        for r in &mut self.project.rows {
            if matches!(r.status, RowStatus::Downloaded | RowStatus::PostProcessing) {
                r.status = RowStatus::Failed { stage: Stage::PostProcess, message: "Đã dừng hậu kỳ".into() };
            }
        }
        self.running = false;
        let mut fx: Vec<Effect> = jobs.into_iter().map(|job_id| Effect::Send(ToExt::JobCancel { job_id })).collect();
        fx.extend([Effect::Save, Effect::Changed]);
        fx
    }

    /// Failed rows: post-processing failures with a raw video only redo post-processing;
    /// anything else goes back to Pending (the next Start regenerates it).
    pub fn retry(&mut self, stts: &[u32]) -> Vec<Effect> {
        let mut fx = vec![];
        for stt in stts {
            let Some(r) = self.project.row_mut(*stt) else { continue };
            match &r.status {
                RowStatus::Failed { stage: Stage::PostProcess, .. } if r.raw_video.is_some() => fx.push(Effect::PostProcess(*stt)),
                RowStatus::Failed { .. } => {
                    r.status = RowStatus::Pending;
                    r.job_id = None;
                    r.raw_video = None;
                    r.output = None;
                }
                _ => {}
            }
        }
        fx.extend([Effect::Save, Effect::Changed]);
        fx
    }

    pub fn reprocess(&mut self, stts: &[u32]) -> Vec<Effect> {
        let selected: Vec<_> = self.project.rows.iter().filter(|r| stts.contains(&r.stt) && r.raw_video.is_some() && matches!(r.status, RowStatus::Done | RowStatus::Downloaded | RowStatus::Generated | RowStatus::Failed { stage: Stage::PostProcess, .. })).map(|r| r.stt).collect();
        let assigned: Vec<_> = selected.iter().map(|s| self.project.row(*s).unwrap().music.clone()).collect();
        let m = &self.project.preset.music;
        let tracks = crate::music::list_tracks(m.folder.as_deref());
        let picks = pick_music(&assigned, m.mode, m.fallback, &tracks, &mut rand::thread_rng());
        let mut fx = vec![Effect::Save, Effect::Changed];
        for (stt, pick) in selected.into_iter().zip(picks) {
            self.project.row_mut(stt).unwrap().resolved_music = pick;
            fx.push(Effect::PostProcess(stt));
        }
        fx
    }

    pub fn on_connected(&self) -> Vec<Effect> {
        let jobs: BTreeSet<String> = self.project.rows.iter().filter(|r| r.status.is_active()).filter_map(|r| r.job_id.clone()).collect();
        jobs.into_iter().map(|job_id| Effect::Send(ToExt::JobQuery { job_id })).collect()
    }

    /// After reopening a project: unfinished post-processing is queued again; rows still waiting
    /// on the extension stay active until `on_connected` queries their job.
    pub fn recover_after_load(&mut self) -> Vec<Effect> {
        let mut fx = vec![];
        for r in self.project.rows.iter_mut() {
            if r.status == RowStatus::Generated && !r.raw_video.as_ref().is_some_and(|p| p.exists()) {
                r.status = RowStatus::Pending;
                r.raw_video = None;
                continue;
            }
            if matches!(r.status, RowStatus::PostProcessing | RowStatus::Downloaded) {
                if r.raw_video.as_ref().map_or(false, |p| p.exists()) {
                    r.status = RowStatus::Downloaded;
                    fx.push(Effect::PostProcess(r.stt));
                } else {
                    r.status = RowStatus::Pending;
                    r.raw_video = None;
                }
            }
        }
        self.refresh_running();
        fx.extend([Effect::Save, Effect::Changed]);
        fx
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Project, Row, RowStatus, Stage};
    use rand::{rngs::StdRng, SeedableRng};

    fn runner(n: u32) -> Runner {
        let rows = (1..=n).map(|i| {
            let mut r = Row::new(i, format!("C:/i/{i}.jpg").into());
            r.prompt = format!("p{i}");
            r
        }).collect();
        Runner::new(Project::new("C:/i".into(), rows))
    }

    fn started(n: u32) -> (Runner, String) {
        let mut r = runner(n);
        let fx = r.start(&[], &mut StdRng::seed_from_u64(1)).unwrap();
        let Effect::Submit { job_id, stts } = fx.iter().find(|f| matches!(f, Effect::Submit { .. })).unwrap() else { panic!("{fx:?}") };
        assert_eq!(stts, &(1..=n).collect::<Vec<_>>());
        (r, job_id.clone())
    }

    fn status(r: &Runner, stt: u32) -> RowStatus {
        r.project.row(stt).unwrap().status.clone()
    }

    #[test]
    fn review_stale_rejections_do_not_stop_new_job() {
        let (mut r, old) = started(1);
        r.pause();
        r.start(&[], &mut StdRng::seed_from_u64(1)).unwrap();
        assert!(r.on_message(FromExt::JobRejected { job_id: old.clone(), error: "late".into() }).is_empty());
        assert!(r.revert_submit(&old, "late encode").is_empty());
        assert!(r.running);
    }

    #[test]
    fn review_duplicate_downloads_are_claimed_once() {
        let (mut r, job) = started(1);
        let msg = || FromExt::ItemDownloaded { job_id: job.clone(), index: 1, file_path: "raw".into() };
        assert!(!r.on_message(msg()).is_empty());
        assert!(r.on_message(msg()).is_empty());
        assert!(r.on_message(FromExt::JobStatus { job_id: job, known: true, done: vec![crate::bridge::DoneItem { index: 1, file_path: "raw".into() }], failed: vec![], pending: vec![] }).is_empty());
    }

    #[test]
    fn review_recovery_restores_running_and_failure_guard() {
        let (r, job) = started(4);
        let mut r = Runner::new(r.project);
        r.recover_after_load();
        assert!(r.running);
        for i in 1..=2 { r.on_message(FromExt::ItemFailed { job_id: job.clone(), index: i, error: "x".into() }); }
        assert!(r.on_message(FromExt::ItemFailed { job_id: job.clone(), index: 3, error: "x".into() }).contains(&Effect::Send(ToExt::JobCancel { job_id: job })));
    }

    #[test]
    fn review_start_persists_before_submit() {
        let fx = runner(1).start(&[], &mut StdRng::seed_from_u64(1)).unwrap();
        let save = fx.iter().position(|f| *f == Effect::Save).unwrap();
        let submit = fx.iter().position(|f| matches!(f, Effect::Submit { .. })).unwrap();
        assert!(save < submit);
    }

    #[test]
    fn review_reprocess_resolves_current_music() {
        let tmp = tempfile::tempdir().unwrap();
        let a = tmp.path().join("a.mp3"); let b = tmp.path().join("b.mp3");
        std::fs::write(&a, b"a").unwrap(); std::fs::write(&b, b"b").unwrap();
        let mut r = runner(1);
        r.project.preset.music.mode = crate::model::MusicMode::Assigned;
        r.project.rows[0].status = RowStatus::Done;
        r.project.rows[0].raw_video = Some("raw".into());
        r.project.rows[0].resolved_music = Some(a);
        r.project.rows[0].music = Some(b.clone());
        let fx = r.reprocess(&[1]);
        assert_eq!(r.project.rows[0].resolved_music, Some(b));
        assert!(fx.contains(&Effect::PostProcess(1)));
        assert!(!fx.iter().any(|f| matches!(f, Effect::Submit { .. })));
    }

    #[test]
    fn review_reprocess_adds_music_to_previously_silent_row() {
        let tmp = tempfile::tempdir().unwrap();
        let track = tmp.path().join("nhạc mới.mp3");
        std::fs::write(&track, b"music").unwrap();
        let mut r = runner(1);
        r.start(&[], &mut StdRng::seed_from_u64(7)).unwrap();
        assert_eq!(r.project.rows[0].resolved_music, None);
        r.on_raw_ready(1, Ok("raw.mp4".into()));
        r.on_postprocess_done(1, Ok("output.mp4".into()));
        r.project.preset.music.folder = Some(tmp.path().into());
        r.project.preset.music.mode = crate::model::MusicMode::Sequential;
        let fx = r.reprocess(&[1]);
        assert_eq!(r.project.rows[0].resolved_music, Some(track));
        assert!(fx.contains(&Effect::PostProcess(1)));
        assert!(!fx.iter().any(|f| matches!(f, Effect::Submit { .. })));
    }

    #[test]
    fn review_reprocess_deleted_assignment_uses_fallback_then_silence() {
        let tmp = tempfile::tempdir().unwrap();
        let deleted = tmp.path().join("assigned.mp3");
        let fallback = tmp.path().join("fallback.mp3");
        std::fs::write(&deleted, b"assigned").unwrap();
        std::fs::write(&fallback, b"fallback").unwrap();
        let mut r = runner(1);
        r.project.preset.music.mode = crate::model::MusicMode::Assigned;
        r.project.preset.music.fallback = crate::model::MusicMode::Sequential;
        r.project.preset.music.folder = Some(tmp.path().into());
        r.project.rows[0].music = Some(deleted.clone());
        r.start(&[fallback.clone()], &mut StdRng::seed_from_u64(7)).unwrap();
        assert_eq!(r.project.rows[0].resolved_music, Some(deleted.clone()));
        r.on_raw_ready(1, Ok("raw.mp4".into()));
        r.on_postprocess_done(1, Ok("output.mp4".into()));
        std::fs::remove_file(deleted).unwrap();
        let fx = r.reprocess(&[1]);
        assert_eq!(r.project.rows[0].resolved_music, Some(fallback.clone()));
        assert!(fx.contains(&Effect::PostProcess(1)));
        assert!(!fx.iter().any(|f| matches!(f, Effect::Submit { .. })));
        std::fs::remove_file(fallback).unwrap();
        let fx = r.reprocess(&[1]);
        assert_eq!(r.project.rows[0].resolved_music, None);
        assert!(fx.contains(&Effect::PostProcess(1)));
        assert!(!fx.iter().any(|f| matches!(f, Effect::Submit { .. })));
    }

    #[test]
    fn review_recovered_rendering_can_pause_without_resubmitting() {
        let (mut r, job) = started(2);
        r.on_message(FromExt::ItemProgress { job_id: job.clone(), index: 2, percent: 42 });
        let mut recovered = Runner::new(r.project);
        let fx = recovered.recover_after_load();
        assert!(recovered.running);
        assert!(!fx.iter().any(|f| matches!(f, Effect::Submit { .. })));
        assert_eq!(recovered.on_connected(), vec![Effect::Send(ToExt::JobQuery { job_id: job.clone() })]);
        let fx = recovered.pause();
        assert!(!recovered.running);
        assert!(fx.contains(&Effect::Send(ToExt::JobCancel { job_id: job.clone() })));
        assert!(recovered.project.rows.iter().all(|r| r.status == RowStatus::Pending && r.job_id.is_none()));
        assert!(recovered.on_message(FromExt::ItemFailed { job_id: job, index: 1, error: "late".into() }).is_empty());
    }

    #[test]
    fn review_recovered_query_three_failures_cancel_remaining_row() {
        let (mut r, job) = started(4);
        r.on_message(FromExt::ItemProgress { job_id: job.clone(), index: 4, percent: 50 });
        let mut recovered = Runner::new(r.project);
        recovered.recover_after_load();
        let fx = recovered.on_message(FromExt::JobStatus {
            job_id: job.clone(), known: true, done: vec![], pending: vec![4],
            failed: (1..=3).map(|index| crate::bridge::FailedItem { index, error: "Veo lỗi".into() }).collect(),
        });
        assert!(fx.contains(&Effect::Send(ToExt::JobCancel { job_id: job })));
        assert!(!recovered.running);
        assert_eq!(status(&recovered, 4), RowStatus::Pending);
        assert!(recovered.project.rows[..3].iter().all(|r| matches!(r.status, RowStatus::Failed { stage: Stage::Generate, .. })));
    }

    #[test]
    fn review_recovery_keeps_saved_music_and_finishes_running() {
        let tmp = tempfile::tempdir().unwrap();
        let raw = tmp.path().join("raw.mp4");
        let saved = tmp.path().join("saved.mp3");
        let current = tmp.path().join("current.mp3");
        for path in [&raw, &saved, &current] { std::fs::write(path, b"x").unwrap(); }
        let mut r = runner(1);
        r.project.preset.music.mode = crate::model::MusicMode::Assigned;
        r.project.rows[0].music = Some(saved.clone());
        r.start(&[], &mut StdRng::seed_from_u64(7)).unwrap();
        r.on_raw_ready(1, Ok(raw));
        r.on_postprocess_started(1);
        r.project.rows[0].music = Some(current);
        let mut recovered = Runner::new(r.project);
        assert!(recovered.recover_after_load().contains(&Effect::PostProcess(1)));
        assert!(recovered.running);
        assert_eq!(recovered.project.rows[0].resolved_music, Some(saved.clone()));
        recovered.on_postprocess_started(1);
        recovered.on_postprocess_done(1, Ok("output.mp4".into()));
        assert!(!recovered.running);
        assert_eq!(status(&recovered, 1), RowStatus::Done);
        assert_eq!(recovered.project.rows[0].resolved_music, Some(saved));
    }

    #[test]
    fn review_last_postprocess_failure_stops_running() {
        let (mut r, _) = started(1);
        r.on_raw_ready(1, Ok("raw.mp4".into()));
        r.on_postprocess_started(1);
        assert!(r.running);
        r.on_postprocess_done(1, Err("FFmpeg lỗi".into()));
        assert!(!r.running);
        assert_eq!(status(&r, 1), RowStatus::Failed { stage: Stage::PostProcess, message: "FFmpeg lỗi".into() });
    }

    #[test]
    fn start_refuses_rows_without_prompt() {
        let mut r = runner(3);
        r.project.rows[1].prompt.clear();
        r.project.rows[2].prompt = "  ".into();
        let err = r.start(&[], &mut StdRng::seed_from_u64(1)).unwrap_err();
        assert!(err.contains("2, 3"), "{err}");
        assert!(r.project.rows.iter().all(|x| x.status == RowStatus::Pending));
        r.project.common_prompt = "chung".into();
        assert!(r.start(&[], &mut StdRng::seed_from_u64(1)).is_ok());
    }

    #[test]
    fn start_assigns_music_and_marks_sending() {
        let mut r = runner(2);
        let tracks = vec![std::path::PathBuf::from("a.mp3")];
        r.start(&tracks, &mut StdRng::seed_from_u64(1)).unwrap();
        assert!(r.running);
        assert!(r.project.rows.iter().all(|x| x.status == RowStatus::Sending && x.resolved_music.is_some() && x.job_id.is_some()));
    }

    #[test]
    fn downloads_out_of_order_map_by_stt() {
        let (mut r, job) = started(3);
        r.project.preset.gen.auto_post_process = true; // tests the auto pipeline
        let fx = r.on_message(FromExt::ItemProgress { job_id: job.clone(), index: 2, percent: 40 });
        assert_eq!(status(&r, 2), RowStatus::Rendering { percent: 40 });
        assert_eq!(fx, vec![Effect::Changed]);
        let fx = r.on_message(FromExt::ItemDownloaded { job_id: job.clone(), index: 3, file_path: "D:/dl/003_x.mp4".into() });
        assert_eq!(fx, vec![Effect::ImportRaw { stt: 3, from: "D:/dl/003_x.mp4".into() }]);
        let fx = r.on_raw_ready(3, Ok("C:/i/_1click/raw/003.mp4".into()));
        assert_eq!(fx[0], Effect::PostProcess(3));
        assert_eq!(status(&r, 3), RowStatus::Downloaded);
        assert_eq!(status(&r, 1), RowStatus::Sending);
        // a download for another job is ignored
        assert!(r.on_message(FromExt::ItemDownloaded { job_id: "other".into(), index: 1, file_path: "x".into() }).is_empty());
    }

    #[test]
    fn three_consecutive_failures_pause_and_cancel() {
        let (mut r, job) = started(5);
        for i in 1..=2 {
            r.on_message(FromExt::ItemFailed { job_id: job.clone(), index: i, error: "Veo từ chối".into() });
        }
        assert!(r.running);
        let fx = r.on_message(FromExt::ItemFailed { job_id: job.clone(), index: 3, error: "Veo từ chối".into() });
        assert!(!r.running);
        assert!(fx.contains(&Effect::Send(ToExt::JobCancel { job_id: job.clone() })));
        assert!(fx.iter().any(|e| matches!(e, Effect::Notify(m) if m.contains("3 dòng lỗi liên tiếp"))));
        assert_eq!(status(&r, 3), RowStatus::Failed { stage: Stage::Generate, message: "Veo từ chối".into() });
        assert_eq!(status(&r, 4), RowStatus::Pending);
    }

    #[test]
    fn a_success_resets_the_failure_streak() {
        let (mut r, job) = started(5);
        r.on_message(FromExt::ItemFailed { job_id: job.clone(), index: 1, error: "e".into() });
        r.on_message(FromExt::ItemFailed { job_id: job.clone(), index: 2, error: "e".into() });
        r.on_raw_ready(3, Ok("raw3".into()));
        let fx = r.on_message(FromExt::ItemFailed { job_id: job.clone(), index: 4, error: "e".into() });
        assert!(!fx.iter().any(|e| matches!(e, Effect::Notify(_) | Effect::Send(ToExt::JobCancel { .. }))), "{fx:?}");
        assert!(r.running, "row 5 is still rendering");
        assert_eq!(status(&r, 5), RowStatus::Sending);
    }

    #[test]
    fn late_messages_after_pause_are_ignored() {
        let (mut r, job) = started(2);
        let fx = r.pause();
        assert!(fx.contains(&Effect::Send(ToExt::JobCancel { job_id: job.clone() })));
        assert!(r.project.rows.iter().all(|x| x.status == RowStatus::Pending && x.job_id.is_none()));
        assert!(r.on_message(FromExt::ItemDownloaded { job_id: job.clone(), index: 1, file_path: "x".into() }).is_empty());
        assert!(r.on_message(FromExt::ItemProgress { job_id: job, index: 2, percent: 9 }).is_empty());
        assert_eq!(status(&r, 2), RowStatus::Pending);
    }

    #[test]
    fn rejected_job_returns_rows_to_pending() {
        let (mut r, job) = started(2);
        let fx = r.on_message(FromExt::JobRejected { job_id: job, error: "Cần đăng nhập Google".into() });
        assert!(fx.contains(&Effect::Notify("Cần đăng nhập Google".into())));
        assert!(!r.running);
        assert!(r.project.rows.iter().all(|x| x.status == RowStatus::Pending));
    }

    #[test]
    fn retry_regenerates_or_only_reprocesses() {
        let (mut r, job) = started(2);
        r.on_message(FromExt::ItemFailed { job_id: job, index: 1, error: "e".into() });
        r.on_raw_ready(2, Ok("raw2".into()));
        r.on_postprocess_done(2, Err("ffmpeg lỗi".into()));
        let fx = r.retry(&[1, 2]);
        assert_eq!(status(&r, 1), RowStatus::Pending);
        assert!(fx.contains(&Effect::PostProcess(2)));
        assert_eq!(r.project.row(2).unwrap().raw_video.as_deref(), Some(std::path::Path::new("raw2")));
    }

    #[test]
    fn reconnect_queries_active_jobs_and_unknown_jobs_reset() {
        let (mut r, job) = started(2);
        assert_eq!(r.on_connected(), vec![Effect::Send(ToExt::JobQuery { job_id: job.clone() })]);
        r.on_message(FromExt::JobStatus { job_id: job.clone(), known: false, done: vec![], failed: vec![], pending: vec![] });
        assert!(r.project.rows.iter().all(|x| x.status == RowStatus::Pending));
    }

    #[test]
    fn job_status_imports_finished_items() {
        let (mut r, job) = started(2);
        let fx = r.on_message(FromExt::JobStatus { job_id: job.clone(), known: true, done: vec![crate::bridge::DoneItem { index: 2, file_path: "f2".into() }], failed: vec![], pending: vec![1] });
        assert_eq!(fx, vec![Effect::ImportRaw { stt: 2, from: "f2".into() }]);
    }

    #[test]
    fn recover_after_load_requeues_postprocessing() {
        let (mut r, _job) = started(1);
        let tmp = tempfile::tempdir().unwrap();
        let raw = tmp.path().join("001.mp4");
        std::fs::write(&raw, b"x").unwrap();
        r.on_raw_ready(1, Ok(raw));
        r.on_postprocess_started(1);
        let fx = r.recover_after_load();
        assert_eq!(fx[0], Effect::PostProcess(1));
        assert_eq!(status(&r, 1), RowStatus::Downloaded);
    }

    #[test]
    fn raw_ready_without_auto_ends_generated() {
        let (mut r, _job) = started(1);
        let fx = r.on_raw_ready(1, Ok("C:/i/_1click/raw/001.mp4".into()));
        assert_eq!(status(&r, 1), RowStatus::Generated);
        assert!(!fx.contains(&Effect::PostProcess(1)));
        assert!(fx.contains(&Effect::Save));
        assert!(!r.running, "only generated rows left: not running");
    }

    #[test]
    fn raw_ready_with_auto_post_processes() {
        let (mut r, _job) = started(1);
        r.project.preset.gen.auto_post_process = true;
        let fx = r.on_raw_ready(1, Ok("raw".into()));
        assert_eq!(status(&r, 1), RowStatus::Downloaded);
        assert!(fx.contains(&Effect::PostProcess(1)));
    }

    #[test]
    fn reprocess_exports_generated_rows() {
        let mut r = runner(2);
        r.project.rows[0].status = RowStatus::Generated;
        r.project.rows[0].raw_video = Some("raw1".into());
        let fx = r.reprocess(&[1, 2]);
        assert!(fx.contains(&Effect::PostProcess(1)));
        assert!(!fx.contains(&Effect::PostProcess(2)), "row 2 has no raw video");
    }

    #[test]
    fn recover_keeps_generated_and_resets_missing_raw() {
        let tmp = tempfile::tempdir().unwrap();
        let raw = tmp.path().join("001.mp4");
        std::fs::write(&raw, b"x").unwrap();
        let mut r = runner(2);
        r.project.rows[0].status = RowStatus::Generated;
        r.project.rows[0].raw_video = Some(raw);
        r.project.rows[1].status = RowStatus::Generated;
        r.project.rows[1].raw_video = Some(tmp.path().join("gone.mp4"));
        let fx = r.recover_after_load();
        assert!(!fx.iter().any(|f| matches!(f, Effect::PostProcess(_))));
        assert_eq!(status(&r, 1), RowStatus::Generated);
        assert_eq!(status(&r, 2), RowStatus::Pending);
        assert_eq!(r.project.rows[1].raw_video, None);
        assert!(!r.running);
    }

    #[test]
    fn stop_leaves_generated_rows_alone() {
        let mut r = runner(1);
        r.project.rows[0].status = RowStatus::Generated;
        r.project.rows[0].raw_video = Some("raw".into());
        r.pause();
        assert_eq!(status(&r, 1), RowStatus::Generated);
    }

    #[test]
    fn old_project_json_defaults_auto_post_process_off() {
        let p: crate::model::Project = serde_json::from_str(r#"{"version":1,"imageDir":"C:/i","rows":[{"stt":1,"imagePath":"C:/i/a.png","status":{"state":"done"},"rawVideo":"C:/i/_1click/raw/001.mp4"}],"preset":{"gen":{"mode":"imageToVideo","aspectRatio":"16:9","quality":"720p","concurrency":3,"maxRetries":0}}}"#).unwrap();
        assert!(!p.preset.gen.auto_post_process);
        assert_eq!(p.rows[0].status, RowStatus::Done);
        let json = serde_json::to_value(RowStatus::Generated).unwrap();
        assert_eq!(json, serde_json::json!({"state": "generated"}));
    }
}
