//! Local control port for agents (the MCP server in `mcp.rs` connects here): a WebSocket on
//! 127.0.0.1 that requires the token stored in the app dir and refuses browser connections.

use crate::engine::Engine;
use crate::import::{self, AssignRule};
use crate::model::{Preset, Project, Row, RowStatus};
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::tungstenite::handshake::server::{ErrorResponse, Request, Response};
use tokio_tungstenite::tungstenite::http::StatusCode;
use tokio_tungstenite::tungstenite::Message;

pub const CONTROL_ADDR: &str = "127.0.0.1:17891";
const TOKEN_FILE: &str = "control-token";
/// How long an agent's export waits for the window to draw text overlays.
const OVERLAY_WAIT: Duration = Duration::from_secs(60);

/// The secret agents present; created once per user and kept in the app dir.
pub fn load_or_create_token(app_dir: &Path) -> std::io::Result<String> {
    let file = app_dir.join(TOKEN_FILE);
    if let Ok(t) = std::fs::read_to_string(&file) {
        let t = t.trim().to_string();
        if t.len() == 64 {
            return Ok(t);
        }
    }
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let token: String = (0..32).map(|_| format!("{:02x}", rng.gen::<u8>())).collect();
    std::fs::create_dir_all(app_dir)?;
    std::fs::write(&file, &token)?;
    Ok(token)
}

pub fn token_path(app_dir: &Path) -> PathBuf {
    app_dir.join(TOKEN_FILE)
}

/// Accepts agent connections until the app exits.
pub async fn serve(listener: TcpListener, engine: Arc<Engine>, token: String) {
    loop {
        if let Ok((stream, _)) = listener.accept().await {
            let (engine, token) = (engine.clone(), token.clone());
            tokio::spawn(async move { handle(stream, engine, token).await });
        }
    }
}

async fn handle(stream: TcpStream, engine: Arc<Engine>, token: String) {
    let check = |req: &Request, resp: Response| -> Result<Response, ErrorResponse> {
        let authorized = req.headers().get("authorization").and_then(|v| v.to_str().ok()) == Some(format!("Bearer {token}").as_str());
        // A browser always sends Origin; agents on this machine do not.
        if req.headers().contains_key("origin") || !authorized {
            let mut r = ErrorResponse::new(Some("forbidden".into()));
            *r.status_mut() = StatusCode::FORBIDDEN;
            return Err(r);
        }
        Ok(resp)
    };
    let Ok(mut ws) = tokio_tungstenite::accept_hdr_async(stream, check).await else { return };
    while let Some(Ok(msg)) = ws.next().await {
        let Message::Text(text) = msg else { continue };
        let req: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
        let id = req.get("id").cloned().unwrap_or(Value::Null);
        let method = req.get("method").and_then(Value::as_str).unwrap_or_default().to_string();
        let params = req.get("params").cloned().unwrap_or_else(|| json!({}));
        let reply = match dispatch(&engine, &method, params).await {
            Ok(result) => json!({ "id": id, "result": result }),
            Err(error) => json!({ "id": id, "error": error }),
        };
        if ws.send(Message::Text(reply.to_string().into())).await.is_err() {
            break;
        }
    }
}

fn name_of(p: &Path) -> String {
    p.file_name().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default()
}

fn status_json(s: &RowStatus) -> Value {
    serde_json::to_value(s).unwrap_or(Value::Null)
}

fn row_json(r: &Row) -> Value {
    json!({
        "stt": r.stt, "images": r.images.iter().map(|p| name_of(p)).collect::<Vec<_>>(), "prompt": r.prompt, "text": r.text,
        "music": r.music.as_deref().map(name_of), "status": status_json(&r.status), "output": r.output,
    })
}

fn summary(p: &Project) -> Value {
    let count = |f: &dyn Fn(&RowStatus) -> bool| p.rows.iter().filter(|r| f(&r.status)).count();
    json!({
        "folder": p.image_dir, "rows": p.rows.len(),
        "pending": count(&|s| *s == RowStatus::Pending),
        "running": count(&|s| s.is_active() || matches!(s, RowStatus::Downloaded | RowStatus::PostProcessing)),
        "generated": count(&|s| *s == RowStatus::Generated),
        "done": count(&|s| *s == RowStatus::Done),
        "failed": count(&|s| matches!(s, RowStatus::Failed { .. })),
    })
}

fn open_project(engine: &Engine) -> Result<Project, String> {
    engine.project().ok_or_else(|| "Chưa mở dự án. Gọi open_project với folder ảnh trước.".into())
}

fn strings(params: &Value, key: &str) -> Vec<String> {
    params.get(key).and_then(Value::as_array).map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect()).unwrap_or_default()
}

fn stts(params: &Value) -> Vec<u32> {
    params.get("stts").and_then(Value::as_array).map(|a| a.iter().filter_map(|v| v.as_u64().map(|n| n as u32)).collect()).unwrap_or_default()
}

/// Image names (as in the folder, with or without extension) or absolute paths.
fn resolve_images(project: &Project, names: &[String]) -> Result<Vec<PathBuf>, String> {
    let library = import::scan_files(&project.image_dir, &import::IMAGE_EXTS).map_err(|e| e.to_string())?;
    let mut missing = vec![];
    let found: Vec<PathBuf> = names.iter().filter_map(|n| {
        let p = PathBuf::from(n);
        let hit = if p.is_absolute() && p.is_file() { Some(p) } else { import::resolve_image(&library, n) };
        if hit.is_none() { missing.push(n.clone()); }
        hit
    }).collect();
    if missing.is_empty() { Ok(found) } else { Err(format!("Không tìm thấy ảnh trong folder: {}", missing.join(", "))) }
}

fn resolve_music(project: &Project, name: &str) -> Option<PathBuf> {
    if name.trim().is_empty() {
        return None;
    }
    let p = PathBuf::from(name);
    Some(match &project.preset.music.folder {
        Some(dir) if p.is_relative() => dir.join(p),
        _ => p,
    })
}

fn merge(dst: &mut Value, src: &Value) {
    match (dst, src) {
        (Value::Object(d), Value::Object(s)) => {
            for (k, v) in s {
                merge(d.entry(k.clone()).or_insert(Value::Null), v);
            }
        }
        (d, s) => *d = s.clone(),
    }
}

async fn wait_until_idle(engine: &Arc<Engine>, timeout: Duration) -> Value {
    let deadline = tokio::time::Instant::now() + timeout;
    while engine.status().running && tokio::time::Instant::now() < deadline {
        tokio::time::sleep(Duration::from_secs(2)).await;
    }
    let p = engine.project();
    json!({ "running": engine.status().running, "project": p.as_ref().map(summary), "rows": p.map(|p| p.rows.iter().map(row_json).collect::<Vec<_>>()) })
}

/// Runs one agent request. Names and parameters match the MCP tools in `mcp.rs`.
pub async fn dispatch(engine: &Arc<Engine>, method: &str, params: Value) -> Result<Value, String> {
    match method {
        "status" => {
            let s = engine.status();
            Ok(json!({
                "connected": s.connected, "extensionVersion": s.ext_version, "ffmpeg": s.ffmpeg.is_some(), "running": s.running,
                "hideChrome": s.hide_chrome, "bundledBrowser": s.bundled_browser, "project": engine.project().as_ref().map(summary),
            }))
        }
        "open_project" => {
            let folder = params.get("folder").and_then(Value::as_str).ok_or("Thiếu folder")?;
            Ok(summary(&engine.open_project(Path::new(folder))?))
        }
        "get_project" => {
            let p = open_project(engine)?;
            let mut settings = serde_json::to_value(&p.preset).map_err(|e| e.to_string())?;
            settings["commonPrompt"] = json!(p.common_prompt);
            Ok(json!({ "summary": summary(&p), "settings": settings, "rows": p.rows.iter().map(row_json).collect::<Vec<_>>() }))
        }
        "list_images" => {
            let p = open_project(engine)?;
            let library = import::scan_files(&p.image_dir, &import::IMAGE_EXTS).map_err(|e| e.to_string())?;
            Ok(json!(library.iter().map(|p| name_of(p)).collect::<Vec<_>>()))
        }
        "add_prompts" => {
            let p = open_project(engine)?;
            let prompts = strings(&params, "prompts");
            if prompts.is_empty() {
                return Err("Thiếu prompts".into());
            }
            let images = resolve_images(&p, &strings(&params, "images"))?;
            let texts = strings(&params, "texts");
            let mut added = vec![];
            engine.edit_scoped(&p.image_dir, |p| {
                for (i, prompt) in prompts.iter().enumerate() {
                    let stt = import::next_stt(&p.rows);
                    let mut row = Row::empty(stt);
                    row.prompt = prompt.clone();
                    row.images = images.clone();
                    row.text = texts.get(i).cloned().unwrap_or_default();
                    p.rows.push(row);
                    added.push(stt);
                }
            })?;
            Ok(json!({ "stts": added }))
        }
        "update_rows" => {
            let p = open_project(engine)?;
            let rows = params.get("rows").and_then(Value::as_array).cloned().unwrap_or_default();
            let mut edits = vec![];
            for r in &rows {
                let stt = r.get("stt").and_then(Value::as_u64).ok_or("Mỗi dòng cần stt")? as u32;
                if p.row(stt).is_none() {
                    return Err(format!("Không có dòng {stt}"));
                }
                let images = match r.get("images") {
                    Some(_) => Some(resolve_images(&p, &strings(r, "images"))?),
                    None => None,
                };
                let music = r.get("music").and_then(Value::as_str).map(|m| resolve_music(&p, m));
                edits.push((stt, r.get("prompt").and_then(Value::as_str).map(String::from), r.get("text").and_then(Value::as_str).map(String::from), images, music));
            }
            engine.edit_scoped(&p.image_dir, |p| {
                for (stt, prompt, text, images, music) in edits {
                    let row = p.row_mut(stt).expect("checked above");
                    if let Some(v) = prompt { row.prompt = v; }
                    if let Some(v) = text { row.text = v; }
                    if let Some(v) = images { row.images = v; }
                    if let Some(v) = music { row.music = v; }
                }
            })?;
            Ok(json!({ "updated": rows.len() }))
        }
        "delete_rows" => {
            let p = open_project(engine)?;
            let wanted = stts(&params);
            let mut kept = vec![];
            engine.edit_scoped(&p.image_dir, |p| kept = import::delete_rows(&mut p.rows, &wanted))?;
            Ok(json!({ "keptBecauseRunning": kept }))
        }
        "assign_images" => {
            let p = open_project(engine)?;
            let images = resolve_images(&p, &strings(&params, "images"))?;
            let rule: AssignRule = serde_json::from_value(params.get("rule").cloned().unwrap_or(json!("all"))).map_err(|_| "rule phải là all, roundRobin hoặc onePerImage")?;
            let wanted = stts(&params);
            let mut n = 0;
            engine.edit_scoped(&p.image_dir, |p| n = import::assign_images(&mut p.rows, &images, rule, &wanted))?;
            Ok(json!({ "rows": n }))
        }
        "set_settings" => {
            let p = open_project(engine)?;
            let mut preset = serde_json::to_value(&p.preset).map_err(|e| e.to_string())?;
            for key in ["gen", "text", "music", "output"] {
                if let Some(v) = params.get(key) {
                    merge(&mut preset[key], v);
                }
            }
            let preset: Preset = serde_json::from_value(preset).map_err(|e| format!("Thiết lập không hợp lệ: {e}"))?;
            let common = params.get("commonPrompt").and_then(Value::as_str).map(String::from);
            engine.edit_scoped(&p.image_dir, |p| {
                p.preset = preset;
                if let Some(c) = common { p.common_prompt = c; }
            })?;
            Ok(json!({ "ok": true }))
        }
        "apply_text_template" => {
            let p = open_project(engine)?;
            let template = params.get("template").and_then(Value::as_str).ok_or("Thiếu template")?.to_string();
            let wanted = stts(&params);
            let mut n = 0;
            engine.edit_scoped(&p.image_dir, |p| n = import::apply_text_template(&mut p.rows, &template, &wanted))?;
            Ok(json!({ "rows": n }))
        }
        "assign_music_in_order" => {
            let p = open_project(engine)?;
            let tracks = crate::music::list_tracks(p.preset.music.folder.as_deref());
            let wanted = stts(&params);
            let mut res = Ok(0);
            engine.edit_scoped(&p.image_dir, |p| res = crate::music::assign_in_order(&mut p.rows, &tracks, &wanted))?;
            Ok(json!({ "rows": res? }))
        }
        "import_table" => {
            let p = open_project(engine)?;
            let path = params.get("path").and_then(Value::as_str).ok_or("Thiếu path")?;
            let recs = import::parse_table(Path::new(path)).map_err(|e| e.to_string())?;
            let library = import::scan_files(&p.image_dir, &import::IMAGE_EXTS).map_err(|e| e.to_string())?;
            let mut unmatched = vec![];
            engine.edit_scoped(&p.image_dir, |p| {
                let music_dir = p.preset.music.folder.clone();
                unmatched = import::apply_table(&mut p.rows, &recs, music_dir.as_deref(), &library);
            })?;
            Ok(json!({ "unmatched": unmatched }))
        }
        "start_generation" => {
            let p = open_project(engine)?;
            if p.preset.gen.auto_post_process {
                let pending = p.rows.iter().filter(|r| r.status == RowStatus::Pending).map(|r| r.stt).collect();
                engine.request_overlays(pending, OVERLAY_WAIT).await?;
            }
            engine.start().await?;
            Ok(summary(&open_project(engine)?))
        }
        "stop_generation" => {
            engine.pause().await;
            Ok(json!({ "ok": true }))
        }
        "retry_failed" => {
            let p = open_project(engine)?;
            let mut wanted = stts(&params);
            if wanted.is_empty() {
                wanted = p.rows.iter().filter(|r| matches!(r.status, RowStatus::Failed { .. })).map(|r| r.stt).collect();
            }
            engine.request_overlays(wanted.clone(), OVERLAY_WAIT).await?;
            engine.retry(&wanted).await;
            if engine.status().connected {
                let _ = engine.start().await;
            }
            Ok(json!({ "retried": wanted }))
        }
        "export_videos" => {
            let p = open_project(engine)?;
            let ready: Vec<u32> = p.rows.iter().filter(|r| r.raw_video.is_some()).map(|r| r.stt).collect();
            let wanted = stts(&params);
            let todo: Vec<u32> = if wanted.is_empty() { ready } else { wanted.into_iter().filter(|s| ready.contains(s)).collect() };
            if todo.is_empty() {
                return Err("Chưa có video gốc để xuất. Tạo video trước (start_generation).".into());
            }
            engine.request_overlays(todo.clone(), OVERLAY_WAIT).await?;
            engine.reprocess(&todo).await;
            Ok(json!({ "exporting": todo }))
        }
        "wait_until_idle" => {
            let secs = params.get("timeoutSeconds").and_then(Value::as_u64).unwrap_or(600).min(3600);
            Ok(wait_until_idle(engine, Duration::from_secs(secs)).await)
        }
        "open_vids_browser" => engine.open_vids_browser().map(|_| json!({ "ok": true })),
        "set_hide_chrome" => {
            let hide = params.get("hide").and_then(Value::as_bool).ok_or("Thiếu hide (true/false)")?;
            engine.set_hide_chrome(hide).map(|_| json!({ "hideChrome": hide }))
        }
        other => Err(format!("Không có lệnh {other}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bridge::Bridge;
    use crate::engine::{Engine, EngineEvent};
    use serde_json::json;
    use std::sync::{Arc, Mutex};
    use tokio_tungstenite::tungstenite::client::IntoClientRequest;

    fn fixture() -> (tempfile::TempDir, Arc<Engine>, std::path::PathBuf, Arc<Mutex<Vec<EngineEvent>>>) {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("ảnh");
        std::fs::create_dir_all(&dir).unwrap();
        for n in ["1.png", "2.png"] {
            image::RgbImage::new(8, 8).save(dir.join(n)).unwrap();
        }
        let events = Arc::new(Mutex::new(vec![]));
        let ev = events.clone();
        let engine = Engine::new(Bridge::offline(), tmp.path().join("app"), Arc::new(move |e| ev.lock().unwrap().push(e)));
        (tmp, engine, dir, events)
    }

    #[tokio::test]
    async fn prompts_images_and_settings_through_the_control_methods() {
        let (_tmp, e, dir, _) = fixture();
        let opened = dispatch(&e, "open_project", json!({ "folder": dir })).await.unwrap();
        assert_eq!(opened["rows"], 2);
        let added = dispatch(&e, "add_prompts", json!({ "prompts": ["a", "b"], "images": ["1.png", "2"], "texts": ["Tập 3"] })).await.unwrap();
        assert_eq!(added["stts"], json!([3, 4]));
        let p = e.project().unwrap();
        assert_eq!(p.rows[2].images, vec![dir.join("1.png"), dir.join("2.png")]);
        assert_eq!((p.rows[2].text.as_str(), p.rows[3].text.as_str()), ("Tập 3", ""));
        dispatch(&e, "update_rows", json!({ "rows": [{ "stt": 1, "prompt": "x", "text": "T", "images": ["2.png"] }] })).await.unwrap();
        let r1 = e.project().unwrap().rows[0].clone();
        assert_eq!((r1.prompt.as_str(), r1.text.as_str(), r1.images.clone()), ("x", "T", vec![dir.join("2.png")]));
        dispatch(&e, "set_settings", json!({ "gen": { "quality": "1080p" }, "text": { "fontSize": 80 }, "commonPrompt": "chung" })).await.unwrap();
        let p = e.project().unwrap();
        assert_eq!((p.preset.gen.quality.as_str(), p.preset.text.font_size, p.common_prompt.as_str()), ("1080p", 80.0, "chung"));
        assert_eq!(p.preset.gen.aspect_ratio, "16:9", "unspecified settings are kept");
        let got = dispatch(&e, "get_project", json!({})).await.unwrap();
        assert_eq!(got["rows"][0]["images"], json!(["2.png"]));
        assert_eq!(got["settings"]["gen"]["quality"], "1080p");
    }

    #[tokio::test]
    async fn bad_requests_are_explained() {
        let (_tmp, e, dir, _) = fixture();
        assert!(dispatch(&e, "nope", json!({})).await.unwrap_err().contains("nope"));
        dispatch(&e, "open_project", json!({ "folder": dir })).await.unwrap();
        let err = dispatch(&e, "add_prompts", json!({ "prompts": ["a"], "images": ["zzz.png"] })).await.unwrap_err();
        assert!(err.contains("zzz.png"), "{err}");
        assert_eq!(e.project().unwrap().rows.len(), 2, "nothing added on error");
        let err = dispatch(&e, "update_rows", json!({ "rows": [{ "stt": 99, "prompt": "x" }] })).await.unwrap_err();
        assert!(err.contains("99"), "{err}");
    }

    #[tokio::test]
    async fn export_waits_for_the_window_to_draw_the_text() {
        let (_tmp, e, dir, events) = fixture();
        dispatch(&e, "open_project", json!({ "folder": dir })).await.unwrap();
        let waiter = { let e = e.clone(); tokio::spawn(async move { e.request_overlays(vec![1], std::time::Duration::from_secs(5)).await }) };
        let id = loop {
            if let Some(id) = events.lock().unwrap().iter().find_map(|ev| match ev { EngineEvent::RenderOverlays { request_id, stts } if stts == &vec![1] => Some(*request_id), _ => None }) { break id; }
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        };
        e.overlays_rendered(id, None);
        assert_eq!(waiter.await.unwrap(), Ok(()));
        let err = e.request_overlays(vec![1], std::time::Duration::from_millis(50)).await.unwrap_err();
        assert!(err.contains("cửa sổ"), "{err}");
    }

    async fn connect(addr: std::net::SocketAddr, auth: Option<&str>, origin: Option<&str>) -> Result<tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>, ()> {
        let mut req = format!("ws://{addr}").into_client_request().unwrap();
        if let Some(a) = auth { req.headers_mut().insert("Authorization", format!("Bearer {a}").parse().unwrap()); }
        if let Some(o) = origin { req.headers_mut().insert("Origin", o.parse().unwrap()); }
        tokio_tungstenite::connect_async(req).await.map(|(ws, _)| ws).map_err(|_| ())
    }

    #[tokio::test]
    async fn only_local_agents_with_the_token_get_in() {
        use futures_util::{SinkExt, StreamExt};
        let (_tmp, e, _dir, _) = fixture();
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(serve(listener, e, "s3cret".into()));
        assert!(connect(addr, None, None).await.is_err(), "no token");
        assert!(connect(addr, Some("wrong"), None).await.is_err(), "wrong token");
        assert!(connect(addr, Some("s3cret"), Some("https://evil.example")).await.is_err(), "web pages are refused");
        let mut ws = connect(addr, Some("s3cret"), None).await.unwrap();
        ws.send(tokio_tungstenite::tungstenite::Message::Text(r#"{"id":7,"method":"status","params":{}}"#.into())).await.unwrap();
        let reply: serde_json::Value = serde_json::from_str(&ws.next().await.unwrap().unwrap().into_text().unwrap()).unwrap();
        assert_eq!(reply["id"], 7);
        assert_eq!(reply["result"]["connected"], false);
    }

    #[test]
    fn token_is_created_once_and_reused() {
        let tmp = tempfile::tempdir().unwrap();
        let a = load_or_create_token(tmp.path()).unwrap();
        assert_eq!(a.len(), 64);
        assert_eq!(load_or_create_token(tmp.path()).unwrap(), a);
    }
}
