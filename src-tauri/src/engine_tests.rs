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
}
impl Default for TestHooks {
    fn default() -> Self {
        Self {
            gate: Mutex::new(None),
            imports: AtomicUsize::new(0),
            processes: AtomicUsize::new(0),
            finished: Semaphore::new(0),
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
        fx.1.iter().any(|f| matches!(f, Effect::ImportRaw { .. })),
        "old import claim blocked a new job"
    );
}
#[tokio::test]
async fn review_raw_publication_save_failure_restores_previous_file() {
    let (tmp, e, dir) = fixture().await;
    let raw = video(tmp.path());
    let rawdir = dir.join("_1click/raw");
    std::fs::create_dir(&rawdir).unwrap();
    let final_path = rawdir.join("001.mp4");
    std::fs::write(&final_path, b"previous raw").unwrap();
    e.edit(|p| {
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
    let running_before=e.status().running;
    let status_before=statuses.lock().unwrap().last().copied();
    g.resume();
    finished(&e).await;
    assert_eq!(e.project().unwrap().rows[0].status, RowStatus::Done);
    assert!(running_before);
    assert_eq!(status_before,Some(true));
    assert!(!e.status().running);
    assert_eq!(statuses.lock().unwrap().last(), Some(&false));
}
