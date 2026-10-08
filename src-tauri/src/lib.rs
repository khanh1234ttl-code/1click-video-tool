pub mod bridge;
pub mod commands;
pub mod engine;
pub mod import;
pub mod media;
pub mod model;
pub mod music;
pub mod project;
pub mod runner;

use engine::{Engine, EngineEvent};
use std::sync::Arc;
use tauri::{Emitter, Manager};

pub const BRIDGE_ADDR: &str = "127.0.0.1:17890";

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let app_dir = project::app_dir();
            let allowed = project::load_settings(&app_dir).allowed_extension_id;
            let engine = tauri::async_runtime::block_on(async move {
                let notify: Arc<dyn Fn(EngineEvent) + Send + Sync> = Arc::new(move |ev| {
                    let _ = match ev {
                        EngineEvent::Project(p) => handle.emit("project", p),
                        EngineEvent::Status(s) => handle.emit("status", s),
                        EngineEvent::Toast(t) => handle.emit("toast", t),
                    };
                });
                match tokio::net::TcpListener::bind(BRIDGE_ADDR).await {
                    Ok(listener) => {
                        let (bridge, rx) = bridge::Bridge::start(listener, allowed).await;
                        let engine = Engine::new(bridge, app_dir, notify);
                        engine.spawn_event_loop(rx);
                        engine
                    }
                    Err(e) => {
                        let engine = Engine::new(bridge::Bridge::offline(), app_dir, notify.clone());
                        notify(EngineEvent::Toast(format!("Cổng {BRIDGE_ADDR} đang bị chiếm ({e}). Tắt tool đang chạy khác rồi mở lại.")));
                        engine
                    }
                }
            });
            app.manage(engine);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::open_project, commands::get_project, commands::update_row, commands::set_common_prompt,
            commands::paste_prompts, commands::import_table, commands::set_preset, commands::list_presets,
            commands::save_preset, commands::load_preset, commands::save_overlays, commands::start_run,
            commands::pause_run, commands::retry_rows, commands::reprocess_rows, commands::get_status,
            commands::set_ffmpeg_dir, commands::reset_extension, commands::list_fonts, commands::read_file_base64,
            commands::list_music, commands::open_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running 1Click Video Tool");
}
