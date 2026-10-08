pub mod bridge;
pub mod media;
pub mod model;
pub mod music;
pub mod import;
pub mod project;
pub mod runner;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running 1Click Video Tool");
}
