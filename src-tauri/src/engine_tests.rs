use super::*;
use crate::model::RowStatus;
use futures_util::StreamExt;
use std::sync::atomic::{AtomicUsize, Ordering};
use tokio::sync::Notify;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;

#[derive(Clone, Copy, PartialEq)]
pub(super) enum Boundary {
    Encode,
    Import,
    Queued,
    Process,
}
#[derive(Default)]
pub(super) struct Gate {
    entered: Notify,
    release: Notify,
    blocking_release: Mutex<bool>,
    resumed: std::sync::Condvar,
}
impl Gate {
    fn resume(&self) {
        *self.blocking_release.lock().unwrap() = true;
        self.resumed.notify_all();
        self.release.notify_one();
    }
}
pub(super) struct TestHooks {
    gate: Mutex<Option<(Boundary, Arc<Gate>)>>,
    pub(super) imports: AtomicUsize,
    pub(super) processes: AtomicUsize,
    pub(super) finished: Semaphore,
    pub(super) fs_faults: Mutex<std::collections::BTreeSet<FileAction>>,
}
impl Default for TestHooks {
    fn default() -> Self {
        Self {
            gate: Mutex::new(None),
            imports: AtomicUsize::new(0),
            processes: AtomicUsize::new(0),
            finished: Semaphore::new(0),
            fs_faults: Mutex::new(std::collections::BTreeSet::new()),
        }
    }
}
impl TestHooks {
    pub(super) async fn checkpoint(&self, boundary: Boundary) {
        let gate = self
            .gate
            .lock()
            .unwrap()
            .as_ref()
            .filter(|(b, _)| *b == boundary)
            .map(|(_, g)| g.clone());
        if let Some(g) = gate {
            g.entered.notify_one();
            g.release.notified().await;
        }
    }
    pub(super) fn checkpoint_blocking(&self, boundary: Boundary) {
        let gate = self
            .gate
            .lock()
            .unwrap()
            .as_ref()
            .filter(|(b, _)| *b == boundary)
            .map(|(_, g)| g.clone());
        if let Some(g) = gate {
            g.entered.notify_one();
            let mut resumed = g.blocking_release.lock().unwrap();
            while !*resumed {
                resumed = g.resumed.wait(resumed).unwrap();
            }
        }
    }
    fn block(&self, boundary: Boundary) -> Arc<Gate> {
        let g = Arc::new(Gate::default());
        *self.gate.lock().unwrap() = Some((boundary, g.clone()));
        g
    }
}
async fn reached(g: &Gate) {
    tokio::time::timeout(std::time::Duration::from_secs(15), g.entered.notified())
        .await
        .expect("boundary reached");
}
async fn finished(e: &Engine) {
    tokio::time::timeout(
        std::time::Duration::from_secs(15),
        e.test_hooks.finished.acquire(),
    )
    .await
    .expect("operation finished")
    .unwrap()
    .forget();
}
async fn fixture() -> (tempfile::TempDir, Arc<Engine>, PathBuf) {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("images");
    std::fs::create_dir_all(&dir).unwrap();
    image::RgbImage::new(8, 8).save(dir.join("a.png")).unwrap();
    let engine = Engine::new(Bridge::offline(), tmp.path().join("app"), Arc::new(|_| {}));
    engine.open_project(&dir).unwrap();
    (tmp, engine, dir)
}

#[tokio::test]
async fn review_scoped_edits_reject_old_project_without_touching_disk() {
    let (tmp, engine, a) = fixture().await;
    let b = tmp.path().join("B");
    std::fs::create_dir_all(&b).unwrap();
    image::RgbImage::new(8, 8).save(b.join("b.png")).unwrap();
    engine.open_project(&b).unwrap();
    let before = engine.project().unwrap();
    assert!(engine.edit_scoped(&a, |p| {
        p.preset.gen.quality = "1080p".into();
        p.row_mut(1).unwrap().prompt = "fields from A".into();
    }).is_err());
    assert_eq!(engine.project().unwrap(), before);
    assert_eq!(project::load(&b).unwrap().unwrap(), before);
    engine.edit_scoped(&b, |p| p.preset.gen.quality = "1080p".into()).unwrap();
    assert_eq!(project::load(&b).unwrap().unwrap().preset.gen.quality, "1080p");
}

#[tokio::test]
async fn review_scoped_named_presets_reject_old_project() {
    let (tmp, engine, a) = fixture().await;
    let mut loaded = engine.project().unwrap().preset;
    loaded.gen.quality = "1080p".into();
    project::save_preset(&engine.app_dir(), "loaded", &loaded).unwrap();
    let b = tmp.path().join("B");
    std::fs::create_dir_all(&b).unwrap();
    image::RgbImage::new(8, 8).save(b.join("b.png")).unwrap();
    engine.open_project(&b).unwrap();
    assert!(engine.save_named_preset(&a, "stale").is_err());
    assert!(!project::list_presets(&engine.app_dir()).contains(&"stale".to_string()));
    assert!(engine.load_named_preset(&a, "loaded").is_err());
    assert_eq!(project::load(&b).unwrap().unwrap().preset.gen.quality, "720p");
    engine.load_named_preset(&b, "loaded").unwrap();
    engine.save_named_preset(&b, "fresh").unwrap();
    assert_eq!(project::load_preset(&engine.app_dir(), "fresh").unwrap().gen.quality, "1080p");
}

#[tokio::test]
async fn review_scoped_edit_failure_rolls_back() {
    let (_tmp, engine, a) = fixture().await;
    let before = engine.project().unwrap();
    let work = before.work_dir();
    std::fs::remove_dir_all(&work).unwrap();
    std::fs::write(&work, "block directory").unwrap();
    assert!(engine.edit_scoped(&a, |p| p.preset.gen.quality = "1080p".into()).is_err());
    assert_eq!(engine.project().unwrap(), before);
}
async fn connected_fixture() -> (
    tempfile::TempDir,
    Arc<Engine>,
    PathBuf,
    tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>,
    Arc<Mutex<Vec<bool>>>,
) {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("images");
    std::fs::create_dir(&dir).unwrap();
    image::RgbImage::new(8, 8).save(dir.join("a.png")).unwrap();
    let l = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = l.local_addr().unwrap();
    let (bridge, mut events) = Bridge::start(l, None).await;
    let statuses = Arc::new(Mutex::new(Vec::new()));
    let s = statuses.clone();
    let engine = Engine::new(
        bridge,
        tmp.path().join("app"),
        Arc::new(move |ev| {
            if let EngineEvent::Status(st) = ev {
                s.lock().unwrap().push(st.running)
            }
        }),
    );
    engine.open_project(&dir).unwrap();
    engine.edit(|p| p.common_prompt = "prompt".into()).unwrap();
    let mut req = format!("ws://{addr}").into_client_request().unwrap();
    req.headers_mut()
        .insert("Origin", "chrome-extension://fake".parse().unwrap());
    let (ws, _) = tokio_tungstenite::connect_async(req).await.unwrap();
    events.recv().await.unwrap();
    (tmp, engine, dir, ws, statuses)
}
fn video(tmp: &Path) -> PathBuf {
    let raw = tmp.join("tone.mp4");
    let ff = media::find_tool("ffmpeg", None).expect("FFmpeg fixture required");
    media::run_tool(
        &ff,
        &[
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=size=64x64:duration=0.1",
            "-c:v",
            "libx264",
            raw.to_str().unwrap(),
        ]
        .map(String::from),
    )
    .unwrap();
    raw
}
fn other(tmp: &Path) -> PathBuf {
    let dir = tmp.join("other");
    std::fs::create_dir(&dir).unwrap();
    image::RgbImage::new(8, 8).save(dir.join("b.png")).unwrap();
    dir
}
fn fail_saves(dir: &Path) {
    std::fs::create_dir(dir.join("_1click/project.json.tmp")).unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn review_concurrent_edits_are_durable_and_ordered() {
    let (_tmp, e, dir) = fixture().await;
    let b = Arc::new(std::sync::Barrier::new(12));
    let threads: Vec<_> = (0..12)
        .map(|_| {
            let e = e.clone();
            let b = b.clone();
            std::thread::spawn(move || {
                b.wait();
                for _ in 0..12 {
                    e.edit(|p| p.common_prompt.push('x')).unwrap();
                }
            })
        })
        .collect();
    for t in threads {
        t.join().unwrap();
    }
    assert_eq!(
        project::load(&dir).unwrap().unwrap().common_prompt.len(),
        144
    );
    assert_eq!(e.project().unwrap().common_prompt.len(), 144);
}
#[tokio::test]
async fn review_pause_during_encode_never_dispatches_and_emits_running() {
    let (_tmp, e, dir, mut ws, statuses) = connected_fixture().await;
    let g = e.test_hooks.block(Boundary::Encode);
    let e2 = e.clone();
    let task = tokio::spawn(async move { e2.start().await });
    reached(&g).await;
    let durable_status = project::load(&dir).unwrap().unwrap().rows[0].status.clone();
    let running_seen = statuses.lock().unwrap().contains(&true);
    e.pause().await;
    g.resume();
    task.await.unwrap().unwrap();
    // A transport fence proves all messages queued by start have drained; no timing assumption.
    e.bridge.send(&ToExt::JobQuery {
        job_id: "fence".into(),
    });
    let mut forbidden = Vec::new();
    loop {
        let msg: serde_json::Value =
            serde_json::from_str(&ws.next().await.unwrap().unwrap().into_text().unwrap()).unwrap();
        if msg["jobId"] == "fence" {
            break;
        }
        if msg["type"] == "job.submit" || msg["type"] == "image.put" {
            forbidden.push(msg);
        }
    }
    assert!(
        forbidden.is_empty(),
        "dispatched after pause: {forbidden:?}"
    );
    assert!(running_seen, "running was not emitted before encode");
    assert_eq!(durable_status, RowStatus::Sending);
    assert_eq!(e.project().unwrap().rows[0].status, RowStatus::Pending);
}
#[tokio::test]
async fn review_pause_during_import_cannot_publish_raw() {
    let (tmp, e, dir) = fixture().await;
    let raw = video(tmp.path());
    e.edit(|p| {
        p.preset.gen.auto_post_process = true; // tests the auto pipeline
        p.rows[0].status = RowStatus::Sending;
        p.rows[0].job_id = Some("job".into())
    })
    .unwrap();
    let g = e.test_hooks.block(Boundary::Import);
    e.clone()
        .on_bridge_event(BridgeEvent::Message(FromExt::ItemDownloaded {
            job_id: "job".into(),
            index: 1,
            file_path: raw.to_string_lossy().into(),
        }))
        .await;
    reached(&g).await;
    e.pause().await;
    g.resume();
    finished(&e).await;
    let row = e.project().unwrap().rows.remove(0);
    assert_eq!(row.status, RowStatus::Pending);
    assert!(row.raw_video.is_none());
    assert!(!dir.join("_1click/raw/001.mp4").exists());
}
#[tokio::test]
async fn review_queued_postprocess_cannot_mutate_new_project() {
    let (tmp, e, dir) = fixture().await;
    e.edit(|p| {
        p.rows[0].raw_video = Some("missing.mp4".into());
        p.rows[0].status = RowStatus::Downloaded
    })
    .unwrap();
    let slots = e.ffmpeg_slots.acquire_many(2).await.unwrap();
    let g = e.test_hooks.block(Boundary::Queued);
    e.reprocess(&[1]).await;
    reached(&g).await;
    let other = other(tmp.path());
    e.open_project(&other).unwrap();
    g.resume();
    drop(slots);
    finished(&e).await;
    assert_eq!(e.project().unwrap().rows[0].status, RowStatus::Pending);
    assert!(matches!(
        project::load(&dir).unwrap().unwrap().rows[0].status,
        RowStatus::Downloaded | RowStatus::PostProcessing
    ));
    assert!(!other.join("Output").exists());
}
#[tokio::test]
async fn review_running_postprocess_cannot_publish_into_replacement_project() {
    let (tmp, e, dir) = fixture().await;
    let raw = video(tmp.path());
    e.edit(|p| {
        p.rows[0].raw_video = Some(raw);
        p.rows[0].status = RowStatus::Done
    })
    .unwrap();
    let g = e.test_hooks.block(Boundary::Process);
    e.reprocess(&[1]).await;
    reached(&g).await;
    let other = other(tmp.path());
    e.open_project(&other).unwrap();
    g.resume();
    finished(&e).await;
    assert_eq!(e.project().unwrap().rows[0].status, RowStatus::Pending);
    assert!(!dir.join("Output/001_a.mp4").exists());
    assert!(!other.join("Output").exists());
}
#[tokio::test]
async fn review_duplicate_download_query_imports_and_processes_once() {
    let (tmp, e, _) = fixture().await;
    let raw = video(tmp.path());
    e.edit(|p| {
        p.preset.gen.auto_post_process = true; // tests the auto pipeline
        p.rows[0].status = RowStatus::Sending;
        p.rows[0].job_id = Some("job".into())
    })
    .unwrap();
    let g = e.test_hooks.block(Boundary::Import);
    let msg = || {
        BridgeEvent::Message(FromExt::ItemDownloaded {
            job_id: "job".into(),
            index: 1,
            file_path: raw.to_string_lossy().into(),
        })
    };
    e.clone().on_bridge_event(msg()).await;
    reached(&g).await;
    e.clone().on_bridge_event(msg()).await;
    e.clone()
        .on_bridge_event(BridgeEvent::Message(FromExt::JobStatus {
            job_id: "job".into(),
            known: true,
            done: vec![crate::bridge::DoneItem {
                index: 1,
                file_path: raw.to_string_lossy().into(),
            }],
            failed: vec![],
            pending: vec![],
        }))
        .await;
    g.resume();
    finished(&e).await;
    finished(&e).await;
    assert_eq!(e.test_hooks.imports.load(Ordering::SeqCst), 1);
    assert_eq!(e.test_hooks.processes.load(Ordering::SeqCst), 1);
    assert_eq!(e.project().unwrap().rows[0].status, RowStatus::Done);
}
#[tokio::test]
async fn review_save_failure_rolls_back_start_and_never_dispatches() {
    let (_tmp, e, dir, mut ws, _) = connected_fixture().await;
    fail_saves(&dir);
    let result = e.start().await;
    e.bridge.send(&ToExt::JobQuery {
        job_id: "fence".into(),
    });
    let mut forbidden = Vec::new();
    loop {
        let msg: serde_json::Value =
            serde_json::from_str(&ws.next().await.unwrap().unwrap().into_text().unwrap()).unwrap();
        if msg["jobId"] == "fence" {
            break;
        }
        if msg["type"] == "job.submit" || msg["type"] == "image.put" {
            forbidden.push(msg);
        }
    }
    assert!(result.is_err(), "save failure was not propagated");
    assert!(
        forbidden.is_empty(),
        "generation was dispatched: {forbidden:?}"
    );
    assert_eq!(e.project().unwrap().rows[0].status, RowStatus::Pending);
    assert!(!e.status().running);
    assert_eq!(
        project::load(&dir).unwrap().unwrap().rows[0].status,
        RowStatus::Pending
    );
}
#[tokio::test]
async fn review_failed_lifecycle_save_rolls_back_runner() {
    let (_tmp, e, dir) = fixture().await;
    e.edit(|p| {
        p.rows[0].status = RowStatus::Sending;
        p.rows[0].job_id = Some("job".into())
    })
    .unwrap();
    fail_saves(&dir);
    e.clone()
        .on_bridge_event(BridgeEvent::Message(FromExt::ItemProgress {
            job_id: "job".into(),
            index: 1,
            percent: 75,
        }))
        .await;
    assert_eq!(e.project().unwrap().rows[0].status, RowStatus::Sending);
    assert_eq!(
        project::load(&dir).unwrap().unwrap().rows[0].status,
        RowStatus::Sending
    );
}
#[tokio::test]
async fn review_failed_edit_save_rolls_back_memory() {
    let (_tmp, e, dir) = fixture().await;
    fail_saves(&dir);
    assert!(e.edit(|p| p.common_prompt = "unsaved".into()).is_err());
    assert_eq!(e.project().unwrap().common_prompt, "");
}

#[tokio::test]
async fn review_terminal_failure_during_import_cannot_resurrect_or_block_new_job() {
    let (tmp, e, dir) = fixture().await;
    let raw = video(tmp.path());
    e.edit(|p| {
        p.rows[0].status = RowStatus::Sending;
        p.rows[0].job_id = Some("old".into());
        p.common_prompt = "prompt".into()
    })
    .unwrap();
    let g = e.test_hooks.block(Boundary::Import);
    e.clone()
        .on_bridge_event(BridgeEvent::Message(FromExt::ItemDownloaded {
            job_id: "old".into(),
            index: 1,
            file_path: raw.to_string_lossy().into(),
        }))
        .await;
    reached(&g).await;
    e.clone()
        .on_bridge_event(BridgeEvent::Message(FromExt::ItemFailed {
            job_id: "old".into(),
            index: 1,
            error: "generation failed".into(),
        }))
        .await;
    g.resume();
    finished(&e).await;
    assert!(matches!(
        e.project().unwrap().rows[0].status,
        RowStatus::Failed {
            stage: crate::model::Stage::Generate,
            ..
        }
    ));
    assert!(e.project().unwrap().rows[0].raw_video.is_none());
    assert!(!dir.join("_1click/raw/001.mp4").exists());
    e.retry(&[1]).await;
    e.start_effects().unwrap();
    let job = e.project().unwrap().rows[0].job_id.clone().unwrap();
    let fx = e.effects_for(BridgeEvent::Message(FromExt::ItemDownloaded {
        job_id: job,
        index: 1,
        file_path: raw.to_string_lossy().into(),
    }));
    assert!(
        fx.1.iter()
            .any(|f| matches!(f, OwnedEffect::ImportRaw { .. })),
        "old import claim blocked a new job"
    );
}
#[tokio::test]
async fn review_raw_publication_save_failure_restores_previous_file() {
    let (tmp, e, dir) = fixture().await;
    let raw = video(tmp.path());
    let rawdir = dir.join("_1click").join("raw");
    std::fs::create_dir(&rawdir).unwrap();
    let final_path = rawdir.join("001.mp4");
    std::fs::write(&final_path, b"previous raw").unwrap();
    e.edit(|p| {
        p.preset.gen.auto_post_process = true; // tests the auto pipeline
        p.rows[0].status = RowStatus::Sending;
        p.rows[0].job_id = Some("job".into())
    })
    .unwrap();
    let g = e.test_hooks.block(Boundary::Import);
    e.clone()
        .on_bridge_event(BridgeEvent::Message(FromExt::ItemDownloaded {
            job_id: "job".into(),
            index: 1,
            file_path: raw.to_string_lossy().into(),
        }))
        .await;
    reached(&g).await;
    fail_saves(&dir);
    g.resume();
    finished(&e).await;
    assert_eq!(std::fs::read(&final_path).unwrap(), b"previous raw");
    assert_eq!(e.project().unwrap().rows[0].status, RowStatus::Sending);
    assert!(e.project().unwrap().rows[0].raw_video.is_none());
    assert_eq!(
        std::fs::read_dir(rawdir).unwrap().count(),
        1,
        "operation temporary/backup leaked"
    );
}
#[tokio::test]
async fn review_local_completion_emits_running_false_without_bridge_message() {
    let (tmp, e, _dir, _ws, statuses) = connected_fixture().await;
    let raw = video(tmp.path());
    e.edit(|p| {
        p.rows[0].raw_video = Some(raw);
        p.rows[0].status = RowStatus::Done
    })
    .unwrap();
    let g = e.test_hooks.block(Boundary::Process);
    e.reprocess(&[1]).await;
    reached(&g).await;
    let running_before = e.status().running;
    let status_before = statuses.lock().unwrap().last().copied();
    g.resume();
    finished(&e).await;
    assert_eq!(e.project().unwrap().rows[0].status, RowStatus::Done);
    assert!(running_before);
    assert_eq!(status_before, Some(true));
    assert!(!e.status().running);
    assert_eq!(statuses.lock().unwrap().last(), Some(&false));
}

#[tokio::test]
async fn repair_delayed_download_effect_does_not_adopt_restarted_job() {
    let (tmp, e, _) = fixture().await;
    let raw = video(tmp.path());
    e.edit(|p| {
        p.common_prompt = "prompt".into();
        p.rows[0].status = RowStatus::Sending;
        p.rows[0].job_id = Some("old".into())
    })
    .unwrap();
    let delayed = e.effects_for(BridgeEvent::Message(FromExt::ItemDownloaded {
        job_id: "old".into(),
        index: 1,
        file_path: raw.to_string_lossy().into(),
    }));
    e.pause().await;
    let _new = e.start_effects().unwrap();
    let claims = e.state.lock().unwrap().operations.clone();
    e.apply(delayed).await;
    assert_eq!(
        e.state.lock().unwrap().operations,
        claims,
        "old download replaced new job ownership"
    );
}
#[tokio::test]
async fn repair_delayed_download_after_terminal_failure_does_not_adopt_new_job() {
    let (tmp, e, _) = fixture().await;
    let raw = video(tmp.path());
    e.edit(|p| {
        p.common_prompt = "prompt".into();
        p.rows[0].status = RowStatus::Sending;
        p.rows[0].job_id = Some("old".into())
    })
    .unwrap();
    let delayed = e.effects_for(BridgeEvent::Message(FromExt::ItemDownloaded {
        job_id: "old".into(),
        index: 1,
        file_path: raw.to_string_lossy().into(),
    }));
    e.effects_for(BridgeEvent::Message(FromExt::ItemFailed {
        job_id: "old".into(),
        index: 1,
        error: "failed".into(),
    }));
    e.retry(&[1]).await;
    let _new = e.start_effects().unwrap();
    let claims = e.state.lock().unwrap().operations.clone();
    e.apply(delayed).await;
    assert_eq!(
        e.state.lock().unwrap().operations,
        claims,
        "old terminal job replaced new ownership"
    );
}
#[tokio::test]
async fn repair_delayed_postprocess_cannot_restart_canceled_work() {
    let (tmp, e, _) = fixture().await;
    let raw = video(tmp.path());
    e.edit(|p| {
        p.rows[0].raw_video = Some(raw);
        p.rows[0].status = RowStatus::Done
    })
    .unwrap();
    let delayed = e.with_runner(|r| r.reprocess(&[1]));
    e.pause().await;
    let before = e.project().unwrap();
    let claims = e.state.lock().unwrap().operations.clone();
    e.apply(delayed).await;
    assert_eq!(
        e.project().unwrap(),
        before,
        "delayed postprocess restarted paused work"
    );
    assert_eq!(e.state.lock().unwrap().operations, claims);
}
#[tokio::test]
async fn repair_delayed_submit_cannot_replace_new_encoder_claim() {
    let (_tmp, e, _dir, mut ws, _) = connected_fixture().await;
    let delayed = e.start_effects().unwrap();
    e.pause().await;
    let gate = e.test_hooks.block(Boundary::Encode);
    let e2 = e.clone();
    let task = tokio::spawn(async move { e2.start().await });
    reached(&gate).await;
    let claims = e.state.lock().unwrap().operations.clone();
    e.apply(delayed).await;
    let after = e.state.lock().unwrap().operations.clone();
    gate.resume();
    task.await.unwrap().unwrap();
    e.bridge.send(&ToExt::JobQuery {
        job_id: "fence".into(),
    });
    let mut submits = 0;
    loop {
        let m: serde_json::Value =
            serde_json::from_str(&ws.next().await.unwrap().unwrap().into_text().unwrap()).unwrap();
        if m["jobId"] == "fence" {
            break;
        }
        if m["type"] == "job.submit" {
            submits += 1;
        }
    }
    assert_eq!(after, claims, "old Submit replaced new encoder ownership");
    assert_eq!(submits, 1);
}
#[tokio::test]
async fn repair_failed_import_completion_can_replay_query_without_generation() {
    let (tmp, e, dir) = fixture().await;
    let raw = video(tmp.path());
    e.edit(|p| {
        p.preset.gen.auto_post_process = true; // tests the auto pipeline
        p.rows[0].status = RowStatus::Sending;
        p.rows[0].job_id = Some("job".into())
    })
    .unwrap();
    let g = e.test_hooks.block(Boundary::Import);
    let msg = || {
        BridgeEvent::Message(FromExt::ItemDownloaded {
            job_id: "job".into(),
            index: 1,
            file_path: raw.to_string_lossy().into(),
        })
    };
    e.clone().on_bridge_event(msg()).await;
    reached(&g).await;
    fail_saves(&dir);
    g.resume();
    finished(&e).await;
    std::fs::remove_dir(dir.join("_1click/project.json.tmp")).unwrap();
    let retry = e.effects_for(BridgeEvent::Message(FromExt::JobStatus {
        job_id: "job".into(),
        known: true,
        done: vec![crate::bridge::DoneItem {
            index: 1,
            file_path: raw.to_string_lossy().into(),
        }],
        failed: vec![],
        pending: vec![],
    }));
    assert!(
        !retry.1.is_empty(),
        "completed worker left importing guard claimed forever"
    );
    *e.test_hooks.gate.lock().unwrap() = None;
    e.apply(retry).await;
    finished(&e).await;
    finished(&e).await;
    assert_eq!(e.project().unwrap().rows[0].status, RowStatus::Done);
    assert_eq!(e.project().unwrap().rows[0].job_id.as_deref(), Some("job"));
}
#[tokio::test]
async fn repair_failed_postprocess_completion_can_reprocess_without_generation() {
    let (tmp, e, dir) = fixture().await;
    let raw = video(tmp.path());
    e.edit(|p| {
        p.rows[0].raw_video = Some(raw);
        p.rows[0].status = RowStatus::Done
    })
    .unwrap();
    let g = e.test_hooks.block(Boundary::Process);
    e.reprocess(&[1]).await;
    reached(&g).await;
    fail_saves(&dir);
    g.resume();
    finished(&e).await;
    std::fs::remove_dir(dir.join("_1click/project.json.tmp")).unwrap();
    let retry = e.with_runner(|r| r.reprocess(&[1]));
    assert!(
        !retry.1.is_empty(),
        "completed worker left PostProcessing permanently ineligible"
    );
    e.apply(retry).await;
    finished(&e).await;
    assert_eq!(e.project().unwrap().rows[0].status, RowStatus::Done);
    assert!(e.project().unwrap().rows[0].job_id.is_none());
}

async fn publication_fixture() -> (
    tempfile::TempDir,
    Arc<Engine>,
    PathBuf,
    Operation,
    PathBuf,
    PathBuf,
) {
    let (tmp, e, dir) = fixture().await;
    e.edit(|p| {
        p.rows[0].status = RowStatus::Sending;
        p.rows[0].job_id = Some("job".into())
    })
    .unwrap();
    let fx = e.effects_for(BridgeEvent::Message(FromExt::ItemDownloaded {
        job_id: "job".into(),
        index: 1,
        file_path: "unused".into(),
    }));
    let op =
        fx.1.into_iter()
            .find_map(|fx| {
                if let OwnedEffect::ImportRaw { op, .. } = fx {
                    Some(op)
                } else {
                    None
                }
            })
            .unwrap();
    let rawdir = dir.join("_1click").join("raw");
    std::fs::create_dir(&rawdir).unwrap();
    let final_path = rawdir.join("001.mp4");
    std::fs::write(&final_path, b"old raw").unwrap();
    let temp = Engine::temporary(&op, &rawdir);
    std::fs::write(&temp, b"new raw").unwrap();
    (tmp, e, dir, op, temp, final_path)
}
fn failure_messages(e: &Engine, fx: Effects) -> String {
    let mut text =
        fx.1.into_iter()
            .filter_map(|fx| {
                if let OwnedEffect::Notify(t) = fx {
                    Some(t)
                } else {
                    None
                }
            })
            .collect::<Vec<_>>()
            .join(" ");
    if let RowStatus::Failed { message, .. } = &e.project().unwrap().rows[0].status {
        text.push_str(message);
    }
    text
}
#[tokio::test]
async fn repair_failed_publish_restore_reports_and_preserves_backup() {
    let (_tmp, e, _dir, op, temp, final_path) = publication_fixture().await;
    let backup = final_path.with_extension("mp4.backup");
    e.test_hooks
        .fs_faults
        .lock()
        .unwrap()
        .extend([FileAction::Publish, FileAction::Restore]);
    let fx = e.finish_operation(&op, Ok(temp));
    let message = failure_messages(&e, fx);
    assert_eq!(std::fs::read(&backup).unwrap(), b"old raw");
    assert!(
        message.contains(&backup.to_string_lossy().to_string()),
        "backup path hidden: {message}"
    );
    assert!(
        message.contains("Restore"),
        "rollback error hidden: {message}"
    );
    assert!(!final_path.exists());
}
#[tokio::test]
async fn repair_failed_rollback_remove_reports_and_preserves_backup() {
    let (_tmp, e, dir, op, temp, final_path) = publication_fixture().await;
    let backup = final_path.with_extension("mp4.backup");
    fail_saves(&dir);
    e.test_hooks
        .fs_faults
        .lock()
        .unwrap()
        .insert(FileAction::RemovePublished);
    let fx = e.finish_operation(&op, Ok(temp));
    let message = failure_messages(&e, fx);
    assert_eq!(std::fs::read(&backup).unwrap(), b"old raw");
    assert_eq!(std::fs::read(&final_path).unwrap(), b"new raw");
    assert!(message.contains("RemovePublished"));
    assert!(message.contains(&backup.to_string_lossy().to_string()));
}
#[tokio::test]
async fn repair_failed_rollback_restore_reports_and_preserves_backup() {
    let (_tmp, e, dir, op, temp, final_path) = publication_fixture().await;
    let backup = final_path.with_extension("mp4.backup");
    fail_saves(&dir);
    e.test_hooks
        .fs_faults
        .lock()
        .unwrap()
        .insert(FileAction::Restore);
    let fx = e.finish_operation(&op, Ok(temp));
    let message = failure_messages(&e, fx);
    assert_eq!(std::fs::read(&backup).unwrap(), b"old raw");
    assert!(!final_path.exists());
    assert!(message.contains("Restore"));
    assert!(message.contains(&backup.to_string_lossy().to_string()));
}

#[tokio::test]
async fn repair_outstanding_backup_blocks_subsequent_publication() {
    let (_tmp, e, _dir, op, temp, final_path) = publication_fixture().await;
    let backup = final_path.with_extension("mp4.backup");
    std::fs::write(&backup, b"recoverable prior raw").unwrap();
    let fx = e.finish_operation(&op, Ok(temp));
    let message = failure_messages(&e, fx);
    assert_eq!(
        std::fs::read(&final_path).unwrap(),
        b"old raw",
        "published over an unresolved backup"
    );
    assert_eq!(std::fs::read(&backup).unwrap(), b"recoverable prior raw");
    assert!(message.contains(&backup.to_string_lossy().to_string()));
}
#[tokio::test]
async fn repair_failed_backup_cleanup_is_reported_and_protects_future_publish() {
    let (_tmp, e, _dir, op, temp, final_path) = publication_fixture().await;
    e.test_hooks
        .fs_faults
        .lock()
        .unwrap()
        .insert(FileAction::RemoveBackup);
    let fx = e.finish_operation(&op, Ok(temp));
    let message = failure_messages(&e, fx);
    let backup = std::fs::read_dir(final_path.parent().unwrap())
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .find(|p| p.extension().is_some_and(|ext| ext == "backup"))
        .expect("backup preserved");
    assert!(message.contains("RemoveBackup"));
    assert!(message.contains(&backup.to_string_lossy().to_string()));
    e.edit(|p| {
        p.rows[0].status = RowStatus::Sending;
        p.rows[0].job_id = Some("next".into())
    })
    .unwrap();
    let fx = e.effects_for(BridgeEvent::Message(FromExt::ItemDownloaded {
        job_id: "next".into(),
        index: 1,
        file_path: "unused".into(),
    }));
    let op =
        fx.1.into_iter()
            .find_map(|fx| {
                if let OwnedEffect::ImportRaw { op, .. } = fx {
                    Some(op)
                } else {
                    None
                }
            })
            .unwrap();
    let temp = Engine::temporary(&op, final_path.parent().unwrap());
    std::fs::write(&temp, b"third raw").unwrap();
    let fx = e.finish_operation(&op, Ok(temp));
    let message = failure_messages(&e, fx);
    assert_eq!(std::fs::read(&backup).unwrap(), b"old raw");
    assert_eq!(std::fs::read(&final_path).unwrap(), b"new raw");
    assert!(message.contains(&backup.to_string_lossy().to_string()));
}

#[test]
fn start_requires_both_ffmpeg_and_ffprobe() {
    let ff = std::path::Path::new("C:/ff/ffmpeg.exe");
    let fp = std::path::Path::new("C:/ff/ffprobe.exe");
    assert_eq!(super::missing_media_tools(Some(ff), Some(fp)), None);
    assert!(super::missing_media_tools(None, Some(fp)).unwrap().contains("FFmpeg"));
    let no_probe = super::missing_media_tools(Some(ff), None).unwrap();
    assert!(no_probe.contains("ffprobe") && no_probe.contains("đèn Extension"), "{no_probe}");
}
#[tokio::test]
async fn generated_rows_are_claimed_for_export() {
    let (tmp, e, dir) = fixture().await;
    let raw = video(tmp.path());
    e.edit(|p| {
        p.rows[0].raw_video = Some(raw);
        p.rows[0].status = RowStatus::Generated
    })
    .unwrap();
    e.reprocess(&[1]).await;
    assert_ne!(e.project().unwrap().rows[0].status, RowStatus::Generated, "export must claim a generated row");
    finished(&e).await;
    assert_eq!(e.project().unwrap().rows[0].status, RowStatus::Done);
    assert!(dir.join("Output/001_a.mp4").exists());
}

#[tokio::test]
async fn window_info_is_remembered_and_hide_setting_persists() {
    let (_tmp, e, _) = fixture().await;
    assert!(!e.status().chrome_window);
    e.clone().on_bridge_event(BridgeEvent::Message(FromExt::WindowInfo { window_id: 5, left: 1, top: 2, width: 300, height: 200 })).await;
    let st = e.status();
    assert!(st.chrome_window && !st.hide_chrome);
    assert_eq!(e.state.lock().unwrap().chrome_visible_requested, Some(true), "setting off: the window is shown");
    e.set_hide_chrome(true).unwrap();
    assert!(e.status().hide_chrome);
    assert_eq!(e.state.lock().unwrap().chrome_visible_requested, Some(false));
    assert!(project::load_settings(&e.app_dir()).hide_chrome, "persisted for the next launch");
    e.clone().on_bridge_event(BridgeEvent::Message(FromExt::JobRejected { job_id: "x".into(), error: "Cần đăng nhập Google".into() })).await;
    assert_eq!(e.state.lock().unwrap().chrome_visible_requested, Some(true), "a rejected job shows the window");
    e.restore_chrome();
    assert_eq!(e.state.lock().unwrap().chrome_visible_requested, Some(true));
}

#[test]
fn shared_images_are_uploaded_once_and_listed_per_prompt() {
    let (a, b, c) = (PathBuf::from("a.png"), PathBuf::from("b.png"), PathBuf::from("c.png"));
    let rows = vec![(1, vec![a.clone(), b.clone()]), (2, vec![a.clone(), b.clone()]), (3, vec![c.clone(), a.clone()])];
    let (uploads, items) = plan_uploads("j9", &rows);
    assert_eq!(uploads, vec![(a, "j9-img1".to_string()), (b, "j9-img2".to_string()), (c, "j9-img3".to_string())]);
    assert_eq!(items, vec![(1, vec!["j9-img1".to_string(), "j9-img2".to_string()]), (2, vec!["j9-img1".to_string(), "j9-img2".to_string()]), (3, vec!["j9-img3".to_string(), "j9-img1".to_string()])]);
}
