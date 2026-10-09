//! Full pipeline without Google: a fake extension answers job.submit by producing test videos
//! (out of order) with ffmpeg; the engine must post-process each into the right output file.
use futures_util::{SinkExt, StreamExt};
use oneclick_video_tool_lib::{bridge::*, engine::*, media, model::*};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio_tungstenite::tungstenite::{client::IntoClientRequest, Message};

#[tokio::test(flavor = "multi_thread")]
async fn review_no_music_honors_original_mute() {
    let ffmpeg = media::find_tool("ffmpeg", None).expect("ffmpeg required");
    let tmp = tempfile::tempdir().unwrap();
    image::RgbImage::new(16, 16).save(tmp.path().join("a.png")).unwrap();
    let raw = tmp.path().join("tone.mp4");
    media::run_tool(&ffmpeg, &["-y", "-v", "error", "-f", "lavfi", "-i", "color=size=64x64:duration=1", "-f", "lavfi", "-i", "sine=duration=1", "-shortest", "-c:v", "libx264", "-c:a", "aac", raw.to_str().unwrap()].map(String::from)).unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let (bridge, _) = Bridge::start(listener, None).await;
    let engine = Engine::new(bridge, tmp.path().join("app"), Arc::new(|_| {}));
    engine.open_project(tmp.path()).unwrap();
    engine.edit(|p| { p.rows[0].status = RowStatus::Done; p.rows[0].raw_video = Some(raw); p.preset.music.original_volume = 0.0; }).unwrap();
    engine.reprocess(&[1]).await;
    let deadline = tokio::time::Instant::now() + Duration::from_secs(15);
    let out = loop {
        let p = engine.project().unwrap();
        if let Some(out) = p.rows[0].output.clone() { break out; }
        assert!(tokio::time::Instant::now() < deadline, "{:?}", p.rows[0]);
        tokio::time::sleep(Duration::from_millis(20)).await;
    };
    let pcm = tmp.path().join("samples.f32");
    media::run_tool(&ffmpeg, &["-y", "-v", "error", "-i", out.to_str().unwrap(), "-vn", "-f", "f32le", pcm.to_str().unwrap()].map(String::from)).unwrap();
    let bytes = std::fs::read(pcm).unwrap();
    let peak = bytes.chunks_exact(4).map(|s| f32::from_le_bytes(s.try_into().unwrap()).abs()).fold(0.0, f32::max);
    assert!(peak < 0.00001, "muted audio peak was {peak}");
}

#[tokio::test(flavor = "multi_thread")]
async fn generated_row_exports_on_reprocess() {
    let ffmpeg = media::find_tool("ffmpeg", None).expect("ffmpeg required");
    let tmp = tempfile::tempdir().unwrap();
    image::RgbImage::new(16, 16).save(tmp.path().join("a.png")).unwrap();
    let raw = tmp.path().join("tone.mp4");
    media::run_tool(&ffmpeg, &["-y", "-v", "error", "-f", "lavfi", "-i", "color=size=64x64:duration=1", "-f", "lavfi", "-i", "sine=duration=1", "-shortest", "-c:v", "libx264", "-c:a", "aac", raw.to_str().unwrap()].map(String::from)).unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let (bridge, _) = Bridge::start(listener, None).await;
    let engine = Engine::new(bridge, tmp.path().join("app"), Arc::new(|_| {}));
    engine.open_project(tmp.path()).unwrap();
    engine.edit(|p| { p.rows[0].status = RowStatus::Generated; p.rows[0].raw_video = Some(raw); }).unwrap();
    engine.reprocess(&[1]).await;
    let deadline = tokio::time::Instant::now() + Duration::from_secs(15);
    loop {
        let p = engine.project().unwrap();
        if p.rows[0].status == RowStatus::Done { assert!(p.rows[0].output.as_ref().unwrap().is_file()); break; }
        assert!(tokio::time::Instant::now() < deadline, "{:?}", p.rows[0]);
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn batch_runs_end_to_end() {
    let Some(ffmpeg) = media::find_tool("ffmpeg", None) else { eprintln!("ffmpeg missing, skip"); return };
    let tmp = tempfile::tempdir().unwrap();
    let images = tmp.path().join("thư mục thử");
    let music_dir = tmp.path().join("nhạc");
    let downloads = tmp.path().join("AFF cám").join("THÁNG 10");
    for d in [&images, &music_dir, &downloads] {
        std::fs::create_dir_all(d).unwrap();
    }
    for i in 1..=3 {
        image::RgbImage::from_pixel(64, 36, image::Rgb([10 * i as u8, 50, 90])).save(images.join(format!("cảnh {i}.png"))).unwrap();
    }
    let music_file = music_dir.join("bài 1.mp3");
    media::run_tool(&ffmpeg, &["-y", "-v", "error", "-f", "lavfi", "-i", "sine=duration=1", music_file.to_str().unwrap()].map(String::from)).unwrap();

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let (bridge, rx) = Bridge::start(listener, None).await;
    let toasts = Arc::new(Mutex::new(Vec::<String>::new()));
    let t2 = toasts.clone();
    let engine = Engine::new(bridge, tmp.path().join("appdata"), Arc::new(move |e| if let EngineEvent::Toast(t) = e { t2.lock().unwrap().push(t) }));
    engine.spawn_event_loop(rx);

    engine.open_project(&images).unwrap();
    engine.edit(|p| {
        p.preset.gen.auto_post_process = true; // one-pass pipeline
        p.common_prompt = "một cảnh đẹp".into();
        p.rows[0].text = "Tập 1".into();
        p.preset.music.folder = Some(music_dir.clone());
        p.preset.output.folder = Some(tmp.path().join("Output"));
    }).unwrap();
    // overlay for row 1 (the UI normally renders it): opaque red left half
    let ovdir = images.join("_1click").join("overlays");
    std::fs::create_dir_all(&ovdir).unwrap();
    let mut ov = image::RgbaImage::new(1280, 720);
    for (x, _, p) in ov.enumerate_pixels_mut() {
        *p = if x < 640 { image::Rgba([255, 0, 0, 255]) } else { image::Rgba([0, 0, 0, 0]) };
    }
    ov.save(ovdir.join("001.png")).unwrap();

    // fake extension
    let mut req = format!("ws://{addr}").into_client_request().unwrap();
    req.headers_mut().insert("Origin", "chrome-extension://fakeext".parse().unwrap());
    let (ws, _) = tokio_tungstenite::connect_async(req).await.unwrap();
    let (mut tx, mut rx_ws) = ws.split();
    tx.send(Message::Text(r#"{"type":"hello","extVersion":"test"}"#.into())).await.unwrap();
    tokio::time::sleep(Duration::from_millis(200)).await;
    assert!(engine.status().connected);

    engine.start().await.unwrap();
    let mut images_seen = 0;
    let (job_id, items) = loop {
        let msg: serde_json::Value = serde_json::from_str(&rx_ws.next().await.unwrap().unwrap().into_text().unwrap()).unwrap();
        match msg["type"].as_str().unwrap() {
            "image.put" => {
                images_seen += 1;
                assert!(msg["base64"].as_str().unwrap().starts_with("data:image/jpeg;base64,"));
            }
            "job.submit" => break (msg["jobId"].as_str().unwrap().to_string(), msg["items"].as_array().unwrap().clone()),
            "window.query" => {} // asked on connect; this fake runs no Chrome window
            other => panic!("unexpected {other}"),
        }
    };
    assert_eq!(images_seen, 3);
    assert_eq!(items.len(), 3);
    assert_eq!(items[0]["prompt"], "một cảnh đẹp");
    tx.send(Message::Text(format!(r#"{{"type":"job.accepted","jobId":"{job_id}"}}"#).into())).await.unwrap();

    for idx in [3u32, 1, 2] {
        let file = downloads.join(format!("{idx:03}_mot-canh_a.mp4"));
        let sine = format!("sine=frequency={}:duration=2", 200 * idx);
        media::run_tool(&ffmpeg, &["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=1280x720:rate=24:duration=2", "-f", "lavfi", "-i", sine.as_str(), "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", file.to_str().unwrap()].map(String::from)).unwrap();
        tx.send(Message::Text(format!(r#"{{"type":"item.progress","jobId":"{job_id}","index":{idx},"percent":50}}"#).into())).await.unwrap();
        let msg = serde_json::json!({"type": "item.downloaded", "jobId": job_id, "index": idx, "filePath": file});
        tx.send(Message::Text(msg.to_string().into())).await.unwrap();
    }

    let deadline = tokio::time::Instant::now() + Duration::from_secs(90);
    loop {
        let p = engine.project().unwrap();
        if p.rows.iter().all(|r| matches!(r.status, RowStatus::Done | RowStatus::Failed { .. })) {
            for r in &p.rows {
                assert_eq!(r.status, RowStatus::Done, "row {} {:?}", r.stt, r.status);
            }
            break;
        }
        assert!(tokio::time::Instant::now() < deadline, "timeout: {:?}", p.rows.iter().map(|r| r.status.clone()).collect::<Vec<_>>());
        tokio::time::sleep(Duration::from_millis(300)).await;
    }

    let p = engine.project().unwrap();
    let ffprobe = media::find_tool("ffprobe", None).unwrap();
    for r in &p.rows {
        let out = r.output.clone().unwrap();
        assert_eq!(out.file_name().unwrap().to_string_lossy(), format!("{:03}_cảnh {}.mp4", r.stt, r.stt));
        let pr = media::probe(&ffprobe, &out).unwrap();
        assert!(pr.has_audio && (pr.duration - 2.0).abs() < 0.2);
        assert!(r.raw_video.as_ref().unwrap().starts_with(images.join("_1click").join("raw")));
    }
    // project.json was saved with the final state
    let saved = oneclick_video_tool_lib::project::load(&images).unwrap().unwrap();
    assert!(saved.rows.iter().all(|r| r.status == RowStatus::Done));
    assert!(toasts.lock().unwrap().is_empty(), "{:?}", toasts.lock().unwrap());
}
