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

/// Loads `<image_dir>/_1click/project.json`. When the folder was moved, every stored path inside
/// the old folder is moved along with it; paths elsewhere (a shared music folder) are kept.
pub fn load(image_dir: &Path) -> Result<Option<Project>> {
    let file = image_dir.join("_1click").join(PROJECT_FILE);
    if !file.exists() {
        return Ok(None);
    }
    let mut p: Project = serde_json::from_slice(&fs::read(&file)?).with_context(|| format!("project.json hỏng: {}", file.display()))?;
    if p.image_dir != image_dir {
        rebase_project(&mut p, image_dir);
    }
    Ok(Some(p))
}

/// Moves the saved project and its work files (raw videos, overlays) into `_1click/cu-<time>/`,
/// so the folder opens as a new project without losing or overwriting earlier videos.
/// Returns the archive folder, or None when there was no saved project.
pub fn archive(image_dir: &Path) -> Result<Option<PathBuf>> {
    let work = image_dir.join("_1click");
    if !work.join(PROJECT_FILE).exists() {
        return Ok(None);
    }
    let secs = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let mut to = work.join(format!("cu-{secs}"));
    let mut n = 1;
    while to.exists() {
        n += 1;
        to = work.join(format!("cu-{secs}-{n}"));
    }
    fs::create_dir_all(&to)?;
    for entry in fs::read_dir(&work)?.flatten() {
        let name = entry.file_name();
        if name.to_string_lossy().starts_with("cu-") {
            continue;
        }
        fs::rename(entry.path(), to.join(&name)).with_context(|| format!("Không chuyển được {} vào {}", entry.path().display(), to.display()))?;
    }
    Ok(Some(to))
}

fn rebase_project(p: &mut Project, new_dir: &Path) {
    let old_dir = std::mem::replace(&mut p.image_dir, new_dir.to_path_buf());
    let rebase = |path: &mut PathBuf| {
        if let Ok(rel) = path.strip_prefix(&old_dir) {
            *path = new_dir.join(rel);
        }
    };
    let preset = &mut p.preset;
    for path in [&mut preset.music.folder, &mut preset.output.folder, &mut preset.text.font_file].into_iter().flatten() {
        rebase(path);
    }
    for row in &mut p.rows {
        for image in &mut row.images {
            rebase(image);
        }
        let font = row.text_override.as_mut().and_then(|t| t.font_file.as_mut());
        for path in [row.music.as_mut(), row.raw_video.as_mut(), row.resolved_music.as_mut(), row.output.as_mut(), font].into_iter().flatten() {
            rebase(path);
        }
    }
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
    /// Hide the Chrome window that runs Google Vids.
    pub hide_chrome: bool,
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
    fn moved_project_rebases_paths_inside_the_old_folder() {
        let tmp = tempfile::tempdir().unwrap();
        let old = tmp.path().join("cũ");
        let elsewhere = tmp.path().join("nhạc chung").join("song.mp3");
        std::fs::create_dir_all(&old).unwrap();
        let mut row = Row::new(1, old.join("ảnh 1.png"));
        row.images.push(old.join("ảnh 2.png"));
        row.raw_video = Some(old.join("_1click").join("raw").join("001.mp4"));
        row.output = Some(old.join("Output").join("001_ảnh 1.mp4"));
        row.resolved_music = Some(old.join("music").join("a.mp3"));
        row.music = Some(elsewhere.clone());
        let mut p = Project::new(old.clone(), vec![row]);
        p.preset.music.folder = Some(old.join("music"));
        p.preset.output.folder = Some(old.join("Thành phẩm"));
        p.preset.text.font_file = Some(old.join("font.ttf"));
        save(&p).unwrap();

        let new = tmp.path().join("mới");
        std::fs::rename(&old, &new).unwrap();
        let back = load(&new).unwrap().unwrap();
        let r = &back.rows[0];
        assert_eq!(back.image_dir, new);
        assert_eq!(r.images, vec![new.join("ảnh 1.png"), new.join("ảnh 2.png")]);
        assert_eq!(r.raw_video, Some(new.join("_1click").join("raw").join("001.mp4")));
        assert_eq!(r.output, Some(new.join("Output").join("001_ảnh 1.mp4")));
        assert_eq!(r.resolved_music, Some(new.join("music").join("a.mp3")));
        assert_eq!(r.music, Some(elsewhere), "paths outside the project folder stay as they are");
        assert_eq!(back.preset.music.folder, Some(new.join("music")));
        assert_eq!(back.preset.output.folder, Some(new.join("Thành phẩm")));
        assert_eq!(back.preset.text.font_file, Some(new.join("font.ttf")));
    }

    #[test]
    fn moved_project_rebases_mixed_separator_paths() {
        let tmp = tempfile::tempdir().unwrap();
        let old = tmp.path().join("a");
        std::fs::create_dir_all(&old).unwrap();
        // Rows written by older builds join with '\' after a '/'-style image_dir.
        let mixed = PathBuf::from(format!("{}\\01.png", old.to_string_lossy().replace('\\', "/")));
        let p = Project::new(PathBuf::from(old.to_string_lossy().replace('\\', "/")), vec![Row::new(1, mixed)]);
        save(&p).unwrap();
        let new = tmp.path().join("b");
        std::fs::rename(&old, &new).unwrap();
        assert_eq!(load(&new).unwrap().unwrap().rows[0].images, vec![new.join("01.png")]);
    }

    #[test]
    fn archive_moves_old_work_aside_and_keeps_earlier_archives() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("ảnh");
        std::fs::create_dir_all(&dir).unwrap();
        save(&Project::new(dir.clone(), vec![Row::new(1, dir.join("1.png"))])).unwrap();
        let work = dir.join("_1click");
        std::fs::create_dir_all(work.join("raw")).unwrap();
        std::fs::write(work.join("raw").join("001.mp4"), b"v").unwrap();
        std::fs::create_dir_all(work.join("cu-1")).unwrap();

        let to = archive(&dir).unwrap().unwrap();
        assert!(load(&dir).unwrap().is_none(), "the folder opens as a new project afterwards");
        assert!(to.starts_with(&work) && to.file_name().unwrap().to_string_lossy().starts_with("cu-"));
        assert!(to.join(PROJECT_FILE).exists());
        assert!(to.join("raw").join("001.mp4").exists(), "old videos are kept, not overwritten by new 001.mp4");
        assert!(work.join("cu-1").exists() && !to.join("cu-1").exists(), "older archives stay where they are");
        assert!(archive(&dir).unwrap().is_none(), "nothing to archive");
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
