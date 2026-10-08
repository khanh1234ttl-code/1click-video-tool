//! Thin #[tauri::command] wrappers over the engine. Errors are Vietnamese strings for the UI.
use crate::engine::{Engine, Status};
use crate::model::{Preset, Project, TextStyle};
use crate::{import, music, project};
use base64::Engine as _;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::State;

type Eng<'a> = State<'a, Arc<Engine>>;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RowEdit {
    pub stt: u32,
    pub prompt: String,
    pub text: String,
    pub music: Option<String>,
    pub text_override: Option<TextStyle>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayPng {
    pub stt: u32,
    pub png_base64: Option<String>,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct FontInfo {
    pub name: String,
    pub path: String,
}

/// async: opening spawns tokio tasks, and Tauri runs sync commands outside the tokio runtime.
#[tauri::command]
pub async fn open_project(engine: Eng<'_>, dir: String) -> Result<Project, String> {
    engine.inner().open_project(Path::new(&dir))
}

#[tauri::command]
pub fn get_project(engine: Eng) -> Option<Project> {
    engine.project()
}

#[tauri::command]
pub fn update_row(engine: Eng, edit: RowEdit) -> Result<(), String> {
    engine.edit(|p| {
        if let Some(r) = p.row_mut(edit.stt) {
            r.prompt = edit.prompt;
            r.text = edit.text;
            r.music = edit.music.filter(|m| !m.is_empty()).map(PathBuf::from);
            r.text_override = edit.text_override;
        }
    })
}

#[tauri::command]
pub fn set_common_prompt(engine: Eng, text: String) -> Result<(), String> {
    engine.edit(|p| p.common_prompt = text)
}

#[tauri::command]
pub fn paste_prompts(engine: Eng, start_stt: u32, text: String) -> Result<usize, String> {
    let mut n = 0;
    engine.edit(|p| n = import::paste_prompts(&mut p.rows, start_stt, &text))?;
    Ok(n)
}

#[tauri::command]
pub fn import_table(engine: Eng, path: String) -> Result<Vec<String>, String> {
    let recs = import::parse_table(Path::new(&path)).map_err(|e| e.to_string())?;
    let mut unmatched = vec![];
    engine.edit(|p| {
        let music_dir = p.preset.music.folder.clone();
        unmatched = import::apply_table(&mut p.rows, &recs, music_dir.as_deref());
    })?;
    Ok(unmatched)
}

#[tauri::command]
pub fn set_preset(engine: Eng, preset: Preset) -> Result<(), String> {
    engine.edit(|p| p.preset = preset)
}

#[tauri::command]
pub fn list_presets(engine: Eng) -> Vec<String> {
    project::list_presets(&engine.app_dir())
}

#[tauri::command]
pub fn save_preset(engine: Eng, name: String) -> Result<(), String> {
    let p = engine.project().ok_or("Chưa mở dự án")?;
    project::save_preset(&engine.app_dir(), &name, &p.preset).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_preset(engine: Eng, name: String) -> Result<Preset, String> {
    let preset = project::load_preset(&engine.app_dir(), &name).map_err(|e| e.to_string())?;
    let copy = preset.clone();
    engine.edit(|p| p.preset = copy)?;
    Ok(preset)
}

#[tauri::command]
pub fn save_overlays(engine: Eng, items: Vec<OverlayPng>) -> Result<(), String> {
    let dir = engine.project().ok_or("Chưa mở dự án")?.work_dir().join("overlays");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    for it in items {
        let file = dir.join(format!("{:03}.png", it.stt));
        match it.png_base64 {
            Some(b) => {
                let bytes = base64::engine::general_purpose::STANDARD.decode(b.trim_start_matches("data:image/png;base64,")).map_err(|e| e.to_string())?;
                std::fs::write(&file, bytes).map_err(|e| e.to_string())?;
            }
            None => {
                let _ = std::fs::remove_file(&file);
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn start_run(engine: Eng<'_>) -> Result<(), String> {
    engine.inner().start().await
}

#[tauri::command]
pub async fn pause_run(engine: Eng<'_>) -> Result<(), String> {
    engine.inner().pause().await;
    Ok(())
}

#[tauri::command]
pub async fn retry_rows(engine: Eng<'_>, stts: Vec<u32>) -> Result<(), String> {
    engine.inner().retry(&stts).await;
    Ok(())
}

#[tauri::command]
pub async fn reprocess_rows(engine: Eng<'_>, stts: Vec<u32>) -> Result<(), String> {
    engine.inner().reprocess(&stts).await;
    Ok(())
}

#[tauri::command]
pub fn get_status(engine: Eng) -> Status {
    engine.status()
}

#[tauri::command]
pub fn set_ffmpeg_dir(engine: Eng, dir: String) -> Result<(), String> {
    engine.set_ffmpeg_dir(Path::new(&dir))
}

#[tauri::command]
pub fn reset_extension(engine: Eng) {
    engine.reset_extension()
}

pub fn fonts_in(dir: &Path) -> Vec<FontInfo> {
    import::scan_files(dir, &["ttf", "otf"]).unwrap_or_default().into_iter().map(|p| FontInfo { name: p.file_stem().unwrap_or_default().to_string_lossy().into_owned(), path: p.to_string_lossy().into_owned() }).collect()
}

#[tauri::command]
pub fn list_fonts() -> Vec<FontInfo> {
    let windir = std::env::var("WINDIR").unwrap_or_else(|_| "C:\\Windows".into());
    let mut v = fonts_in(&Path::new(&windir).join("Fonts"));
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        v.extend(fonts_in(&Path::new(&local).join("Microsoft\\Windows\\Fonts")));
    }
    v
}

#[tauri::command]
pub fn read_file_base64(path: String) -> Result<String, String> {
    std::fs::read(&path).map(|b| base64::engine::general_purpose::STANDARD.encode(b)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_music(engine: Eng) -> Vec<String> {
    let folder = engine.project().and_then(|p| p.preset.music.folder);
    music::list_tracks(folder.as_deref()).into_iter().map(|p| p.to_string_lossy().into_owned()).collect()
}

#[tauri::command]
pub fn open_path(path: String) -> Result<(), String> {
    tauri_plugin_opener::open_path(path, None::<&str>).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    #[test]
    fn fonts_are_listed_by_stem() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join("Bé Vui.ttf"), b"x").unwrap();
        std::fs::write(tmp.path().join("readme.txt"), b"x").unwrap();
        let f = super::fonts_in(tmp.path());
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].name, "Bé Vui");
    }
}
