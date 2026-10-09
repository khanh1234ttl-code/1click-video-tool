//! The Chromium + extension bundled with the installer: the "Vids browser" customers sign into.
use std::path::{Path, PathBuf};

pub const VIDS_URL: &str = "https://docs.google.com/videos/create";

/// Files the installer ships next to the app (Tauri resource dir).
#[derive(Debug, Clone, PartialEq)]
pub struct Bundle {
    pub dir: PathBuf,
}

impl Bundle {
    pub fn chromium(&self) -> PathBuf {
        chromium_in(&self.dir, cfg!(target_os = "macos"))
    }
    pub fn extension(&self) -> PathBuf {
        self.dir.join("extension")
    }
    pub fn ffmpeg_dir(&self) -> PathBuf {
        self.dir.join("ffmpeg")
    }
    /// Whether this install carries its own browser (developer builds do not).
    pub fn has_browser(&self) -> bool {
        self.chromium().is_file() && self.extension().join("manifest.json").is_file()
    }

    /// Opens Google Vids in the bundled Chromium with the tool's profile and the extension loaded.
    /// A second call reuses the running browser (Chromium hands the URL to it).
    pub fn open(&self, profile: &Path) -> Result<(), String> {
        if !self.has_browser() {
            return Err("Bản cài này không kèm trình duyệt Vids".into());
        }
        std::fs::create_dir_all(profile).map_err(|e| format!("Không tạo được profile trình duyệt: {e}"))?;
        std::process::Command::new(self.chromium())
            .args(browser_args(profile, &self.extension()))
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("Không mở được trình duyệt Vids: {e}"))
    }
}

/// The Chromium executable inside the resource dir (an app bundle on macOS).
pub fn chromium_in(dir: &Path, macos: bool) -> PathBuf {
    let base = dir.join("chromium");
    if macos { base.join("Chromium.app").join("Contents").join("MacOS").join("Chromium") } else { base.join("chrome.exe") }
}

/// Command-line for the Vids browser: its own profile, the extension, straight to Google Vids.
pub fn browser_args(profile: &Path, extension: &Path) -> Vec<String> {
    vec![
        format!("--user-data-dir={}", profile.display()),
        format!("--load-extension={}", extension.display()),
        "--no-first-run".into(),
        "--no-default-browser-check".into(),
        VIDS_URL.into(),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn browser_opens_vids_with_its_own_profile_and_the_extension() {
        let args = browser_args(Path::new("C:/data/chromium-profile"), Path::new("C:/app/extension"));
        assert_eq!(args, vec![
            "--user-data-dir=C:/data/chromium-profile".to_string(),
            "--load-extension=C:/app/extension".to_string(),
            "--no-first-run".to_string(),
            "--no-default-browser-check".to_string(),
            "https://docs.google.com/videos/create".to_string(),
        ]);
    }

    #[test]
    fn bundle_paths() {
        let b = Bundle { dir: PathBuf::from("C:/app/res") };
        assert_eq!(b.chromium(), PathBuf::from("C:/app/res").join("chromium").join("chrome.exe"));
        assert_eq!(b.extension(), PathBuf::from("C:/app/res").join("extension"));
        assert_eq!(b.ffmpeg_dir(), PathBuf::from("C:/app/res").join("ffmpeg"));
    }

    #[test]
    fn chromium_lives_in_an_app_bundle_on_mac() {
        let dir = Path::new("/Applications/1Click Video Tool.app/Contents/Resources");
        assert_eq!(chromium_in(dir, true), dir.join("chromium").join("Chromium.app").join("Contents").join("MacOS").join("Chromium"));
        assert_eq!(chromium_in(dir, false), dir.join("chromium").join("chrome.exe"));
    }
}
