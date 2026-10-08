//! Serde types shared by the engine, persistence and the UI (field names are camelCase in JSON).
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GenMode {
    ImageToVideo,
    ComponentsToVideo,
}

impl GenMode {
    /// Mode name understood by the extension's AUTO_FILL_VIDS payload.
    pub fn as_ext(&self) -> &'static str {
        match self {
            GenMode::ImageToVideo => "imageToVideo",
            GenMode::ComponentsToVideo => "componentsToVideo",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GenSettings {
    pub mode: GenMode,
    pub aspect_ratio: String,
    pub quality: String,
    pub concurrency: u8,
    pub max_retries: u8,
}

impl Default for GenSettings {
    fn default() -> Self {
        Self { mode: GenMode::ImageToVideo, aspect_ratio: "16:9".into(), quality: "720p".into(), concurrency: 3, max_retries: 2 }
    }
}

impl GenSettings {
    /// Frame size Veo produces for these settings (verified: 720p 16:9 = 1280x720).
    pub fn resolution(&self) -> (u32, u32) {
        let (w, h) = if self.quality == "1080p" { (1920, 1080) } else { (1280, 720) };
        if self.aspect_ratio == "9:16" { (h, w) } else { (w, h) }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TextAlign {
    Left,
    Center,
    Right,
}

/// Sizes are pixels at a 1080-pixel-high frame and scale with the video height.
/// `x`/`y` place the centre of the text block, as fractions (0..1) of the frame.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TextStyle {
    pub font_family: String,
    pub font_file: Option<PathBuf>,
    pub font_size: f32,
    pub bold: bool,
    pub color: String,
    pub stroke_color: String,
    pub stroke_width: f32,
    pub shadow: bool,
    pub box_enabled: bool,
    pub box_color: String,
    pub box_opacity: f32,
    pub box_radius: f32,
    pub box_padding: f32,
    pub align: TextAlign,
    pub max_width: f32,
    pub x: f32,
    pub y: f32,
}

impl Default for TextStyle {
    fn default() -> Self {
        Self {
            font_family: "Arial".into(),
            font_file: None,
            font_size: 64.0,
            bold: true,
            color: "#ffffff".into(),
            stroke_color: "#000000".into(),
            stroke_width: 4.0,
            shadow: true,
            box_enabled: false,
            box_color: "#000000".into(),
            box_opacity: 0.5,
            box_radius: 16.0,
            box_padding: 24.0,
            align: TextAlign::Center,
            max_width: 0.85,
            x: 0.5,
            y: 0.85,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MusicMode {
    Random,
    Sequential,
    Assigned,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MusicSettings {
    pub folder: Option<PathBuf>,
    pub mode: MusicMode,
    /// Used for rows without an assigned track when `mode` is `Assigned`.
    pub fallback: MusicMode,
    pub music_volume: f32,
    pub original_volume: f32,
    pub fade_in: f32,
    pub fade_out: f32,
}

impl Default for MusicSettings {
    fn default() -> Self {
        Self { folder: None, mode: MusicMode::Random, fallback: MusicMode::Random, music_volume: 0.25, original_volume: 1.0, fade_in: 1.0, fade_out: 1.5 }
    }
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OutputSettings {
    pub folder: Option<PathBuf>,
    pub overwrite: bool,
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Preset {
    pub gen: GenSettings,
    pub text: TextStyle,
    pub music: MusicSettings,
    pub output: OutputSettings,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Stage {
    Generate,
    Download,
    PostProcess,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "state", rename_all = "camelCase")]
pub enum RowStatus {
    Pending,
    Sending,
    Rendering { percent: u8 },
    Downloaded,
    PostProcessing,
    Done,
    Failed { stage: Stage, message: String },
}

impl RowStatus {
    /// Waiting on the extension (submitted, not downloaded yet).
    pub fn is_active(&self) -> bool {
        matches!(self, RowStatus::Sending | RowStatus::Rendering { .. })
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Row {
    pub stt: u32,
    pub image_path: PathBuf,
    #[serde(default)]
    pub prompt: String,
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub music: Option<PathBuf>,
    #[serde(default)]
    pub text_override: Option<TextStyle>,
    pub status: RowStatus,
    #[serde(default)]
    pub job_id: Option<String>,
    #[serde(default)]
    pub raw_video: Option<PathBuf>,
    #[serde(default)]
    pub resolved_music: Option<PathBuf>,
    #[serde(default)]
    pub output: Option<PathBuf>,
}

impl Row {
    pub fn new(stt: u32, image_path: PathBuf) -> Self {
        Self { stt, image_path, prompt: String::new(), text: String::new(), music: None, text_override: None, status: RowStatus::Pending, job_id: None, raw_video: None, resolved_music: None, output: None }
    }
    pub fn image_name(&self) -> String {
        self.image_path.file_name().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default()
    }
    pub fn image_stem(&self) -> String {
        self.image_path.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default()
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub version: u32,
    pub image_dir: PathBuf,
    #[serde(default)]
    pub common_prompt: String,
    #[serde(default)]
    pub preset: Preset,
    pub rows: Vec<Row>,
}

impl Project {
    pub fn new(image_dir: PathBuf, rows: Vec<Row>) -> Self {
        Self { version: 1, image_dir, common_prompt: String::new(), preset: Preset::default(), rows }
    }
    pub fn work_dir(&self) -> PathBuf {
        self.image_dir.join("_1click")
    }
    pub fn effective_prompt(&self, row: &Row) -> String {
        let own = row.prompt.trim();
        if own.is_empty() { self.common_prompt.trim().to_string() } else { own.to_string() }
    }
    pub fn text_style<'a>(&'a self, row: &'a Row) -> &'a TextStyle {
        row.text_override.as_ref().unwrap_or(&self.preset.text)
    }
    pub fn row(&self, stt: u32) -> Option<&Row> {
        self.rows.iter().find(|r| r.stt == stt)
    }
    pub fn row_mut(&mut self, stt: u32) -> Option<&mut Row> {
        self.rows.iter_mut().find(|r| r.stt == stt)
    }
}

pub fn path_str(p: &Path) -> String {
    p.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn row_status_json_shape() {
        let s = serde_json::to_string(&RowStatus::Rendering { percent: 40 }).unwrap();
        assert_eq!(s, r#"{"state":"rendering","percent":40}"#);
        let f = serde_json::to_string(&RowStatus::Failed { stage: Stage::PostProcess, message: "x".into() }).unwrap();
        assert_eq!(f, r#"{"state":"failed","stage":"postProcess","message":"x"}"#);
    }

    #[test]
    fn resolution_follows_aspect_and_quality() {
        let mut g = GenSettings::default();
        assert_eq!(g.resolution(), (1280, 720));
        g.aspect_ratio = "9:16".into();
        g.quality = "1080p".into();
        assert_eq!(g.resolution(), (1080, 1920));
    }

    #[test]
    fn effective_prompt_falls_back_to_common() {
        let mut p = Project::new("C:/x".into(), vec![Row::new(1, "C:/x/a.jpg".into())]);
        p.common_prompt = "  chung  ".into();
        assert_eq!(p.effective_prompt(&p.rows[0]), "chung");
        p.rows[0].prompt = "riêng".into();
        assert_eq!(p.effective_prompt(&p.rows[0].clone()), "riêng");
    }

    #[test]
    fn preset_missing_fields_use_defaults() {
        let p: Preset = serde_json::from_str(r#"{"gen":{"quality":"1080p"}}"#).unwrap();
        assert_eq!(p.gen.quality, "1080p");
        assert_eq!(p.gen.concurrency, 3);
        assert_eq!(p.text, TextStyle::default());
    }
}
