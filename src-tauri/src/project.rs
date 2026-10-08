//! Persistence: project.json inside `<image folder>/_1click`, presets and app settings in %APPDATA%.
use crate::model::{Preset, Project};
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

pub const PROJECT_FILE: &str = "project.json";

fn write_atomic(path: &Path, bytes: &[u8]) -> Result<()> {
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, bytes).with_context(|| format!("Không ghi được {}", tmp.display()))?;
    fs::rename(&tmp, path).with_context(|| format!("Không ghi được {}", path.display()))?;
    Ok(())
}

pub fn save(project: &Project) -> Result<()> {
    let dir = project.work_dir();
    fs::create_dir_all(&dir)?;
    write_atomic(&dir.join(PROJECT_FILE), &serde_json::to_vec_pretty(project)?)
}

/// Loads `<image_dir>/_1click/project.json`; the stored image_dir is replaced by `image_dir`
/// so a moved folder keeps working.
pub fn load(image_dir: &Path) -> Result<Option<Project>> {
    let file = image_dir.join("_1click").join(PROJECT_FILE);
    if !file.exists() {
        return Ok(None);
    }
    let mut p: Project = serde_json::from_slice(&fs::read(&file)?).with_context(|| format!("project.json hỏng: {}", file.display()))?;
    p.image_dir = image_dir.to_path_buf();
    Ok(Some(p))
}

pub fn app_dir() -> PathBuf {
    PathBuf::from(std::env::var("APPDATA").unwrap_or_else(|_| ".".into())).join("1ClickVideoTool")
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AppSettings {
    pub ffmpeg: Option<PathBuf>,
    pub ffprobe: Option<PathBuf>,
    pub allowed_extension_id: Option<String>,
}

pub fn load_settings(app_dir: &Path) -> AppSettings {
    fs::read(app_dir.join("settings.json")).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default()
}

pub fn save_settings(app_dir: &Path, s: &AppSettings) -> Result<()> {
    fs::create_dir_all(app_dir)?;
    write_atomic(&app_dir.join("settings.json"), &serde_json::to_vec_pretty(s)?)
}

fn sanitize_name(name: &str) -> String {
    let s: String = name.trim().chars().map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' { c } else { '_' }).collect();
    if s.is_empty() { "preset".into() } else { s }
}

fn presets_dir(app_dir: &Path) -> PathBuf {
    app_dir.join("presets")
}

pub fn list_presets(app_dir: &Path) -> Vec<String> {
    let mut names: Vec<String> = fs::read_dir(presets_dir(app_dir))
        .map(|rd| rd.filter_map(|e| e.ok()).map(|e| e.path()).filter(|p| p.extension().map_or(false, |x| x == "json")).filter_map(|p| p.file_stem().map(|s| s.to_string_lossy().into_owned())).collect())
        .unwrap_or_default();
    names.sort_by(|a, b| natord::compare_ignore_case(a, b));
    names
}

pub fn save_preset(app_dir: &Path, name: &str, preset: &Preset) -> Result<()> {
    let dir = presets_dir(app_dir);
    fs::create_dir_all(&dir)?;
    write_atomic(&dir.join(format!("{}.json", sanitize_name(name))), &serde_json::to_vec_pretty(preset)?)
}

pub fn load_preset(app_dir: &Path, name: &str) -> Result<Preset> {
    let file = presets_dir(app_dir).join(format!("{}.json", sanitize_name(name)));
    Ok(serde_json::from_slice(&fs::read(&file).with_context(|| format!("Không có preset {name}"))?)?)
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Project, Row};

    #[test]
    fn save_then_load_roundtrip_in_unicode_folder() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("thư mục thử");
        std::fs::create_dir_all(&dir).unwrap();
        let mut p = Project::new(dir.clone(), vec![Row::new(1, dir.join("ảnh 1.jpg"))]);
        p.common_prompt = "Một con mèo".into();
        save(&p).unwrap();
        save(&p).unwrap(); // second save replaces the existing file
        let back = load(&dir).unwrap().unwrap();
        assert_eq!(back, p);
        assert!(!dir.join("_1click").join("project.json.tmp").exists());
    }

    #[test]
    fn load_missing_project_is_none() {
        let tmp = tempfile::tempdir().unwrap();
        assert!(load(tmp.path()).unwrap().is_none());
    }

    #[test]
    fn presets_roundtrip_and_sanitize_names() {
        let tmp = tempfile::tempdir().unwrap();
        let mut preset = crate::model::Preset::default();
        preset.gen.quality = "1080p".into();
        save_preset(tmp.path(), "Kênh: TikTok/9x16", &preset).unwrap();
        assert_eq!(list_presets(tmp.path()), vec!["Kênh_ TikTok_9x16".to_string()]);
        assert_eq!(load_preset(tmp.path(), "Kênh_ TikTok_9x16").unwrap(), preset);
    }

    #[test]
    fn settings_default_when_missing() {
        let tmp = tempfile::tempdir().unwrap();
        assert_eq!(load_settings(tmp.path()), AppSettings::default());
        let s = AppSettings { allowed_extension_id: Some("abc".into()), ..Default::default() };
        save_settings(tmp.path(), &s).unwrap();
        assert_eq!(load_settings(tmp.path()), s);
    }
}
