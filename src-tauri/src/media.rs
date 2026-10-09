//! FFmpeg/ffprobe wrappers, output naming and image preparation for upload.
use anyhow::{anyhow, bail, Result};
use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, PartialEq)]
pub struct Probe {
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub has_audio: bool,
}

#[derive(Deserialize)]
struct FfStream {
    codec_type: String,
    width: Option<u32>,
    height: Option<u32>,
}
#[derive(Deserialize)]
struct FfFormat {
    duration: Option<String>,
}
#[derive(Deserialize)]
struct FfOut {
    streams: Vec<FfStream>,
    format: FfFormat,
}

pub fn parse_probe(json: &str) -> Result<Probe> {
    let o: FfOut = serde_json::from_str(json)?;
    let v = o.streams.iter().find(|s| s.codec_type == "video").ok_or_else(|| anyhow!("File không có hình"))?;
    let duration: f64 = o.format.duration.as_deref().unwrap_or("0").parse().unwrap_or(0.0);
    if duration <= 0.0 {
        bail!("File video rỗng hoặc hỏng");
    }
    Ok(Probe { duration, width: v.width.unwrap_or(0), height: v.height.unwrap_or(0), has_audio: o.streams.iter().any(|s| s.codec_type == "audio") })
}

pub fn probe(ffprobe: &Path, file: &Path) -> Result<Probe> {
    let out = run_tool(ffprobe, &["-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration", "-of", "json"].iter().map(|s| s.to_string()).chain([file.to_string_lossy().into_owned()]).collect::<Vec<_>>())?;
    parse_probe(&out)
}

#[derive(Debug, Clone, PartialEq)]
pub struct MixParams {
    pub music: PathBuf,
    pub music_volume: f32,
    pub fade_in: f32,
    pub fade_out: f32,
}

fn s(p: &Path) -> String {
    p.to_string_lossy().into_owned()
}

/// Arguments for one output video: optional text overlay (PNG scaled to the video), optional
/// looped background music mixed under the original audio (or used alone when there is none),
/// and the original audio's gain, which applies with or without music.
pub fn build_args(input: &Path, overlay: Option<&Path>, mix: Option<&MixParams>, original_volume: f32, probe: &Probe, output: &Path) -> Vec<String> {
    let mut a: Vec<String> = ["-y", "-hide_banner", "-loglevel", "error", "-i"].iter().map(|x| x.to_string()).collect();
    a.push(s(input));
    let mut next = 1;
    let ov_idx = overlay.map(|p| {
        a.extend(["-i".to_string(), s(p)]);
        next += 1;
        next - 1
    });
    let mu_idx = mix.map(|m| {
        a.extend(["-stream_loop".to_string(), "-1".to_string(), "-i".to_string(), s(&m.music)]);
        next += 1;
        next - 1
    });
    let mut filters: Vec<String> = Vec::new();
    if let Some(i) = ov_idx {
        filters.push(format!("[{i}:v]scale={}:{}[ov];[0:v][ov]overlay=0:0:format=auto[v]", probe.width, probe.height));
    }
    if let (Some(i), Some(m)) = (mu_idx, mix) {
        let d = probe.duration;
        let mut chain = format!("[{i}:a]atrim=0:{d:.3},asetpts=PTS-STARTPTS,volume={}", m.music_volume);
        if m.fade_in > 0.0 {
            chain += &format!(",afade=t=in:st=0:d={}", m.fade_in);
        }
        if m.fade_out > 0.0 {
            chain += &format!(",afade=t=out:st={:.3}:d={}", (d - m.fade_out as f64).max(0.0), m.fade_out);
        }
        if probe.has_audio {
            filters.push(format!("{chain}[m];[0:a]volume={original_volume}[o];[o][m]amix=inputs=2:duration=first:normalize=0[a]"));
        } else {
            filters.push(format!("{chain}[a]"));
        }
    }
    // Without music the original track is copied untouched only at full volume.
    let gain_only = mu_idx.is_none() && probe.has_audio && (original_volume - 1.0).abs() > f32::EPSILON;
    if gain_only {
        filters.push(format!("[0:a]volume={original_volume}[a]"));
    }
    if !filters.is_empty() {
        a.extend(["-filter_complex".to_string(), filters.join(";")]);
    }
    let v: &[&str] = if ov_idx.is_some() { &["-map", "[v]", "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p"] } else { &["-map", "0:v", "-c:v", "copy"] };
    a.extend(v.iter().map(|x| x.to_string()));
    if mu_idx.is_some() || gain_only {
        a.extend(["-map", "[a]", "-c:a", "aac", "-b:a", "192k"].iter().map(|x| x.to_string()));
    } else if probe.has_audio {
        a.extend(["-map", "0:a", "-c:a", "copy"].iter().map(|x| x.to_string()));
    }
    a.extend(["-t".to_string(), format!("{:.3}", probe.duration), "-movflags".to_string(), "+faststart".to_string(), s(output)]);
    a
}

/// Runs a console tool without flashing a window; on failure returns the last 20 stderr lines.
pub fn run_tool(tool: &Path, args: &[String]) -> Result<String> {
    let mut cmd = Command::new(tool);
    cmd.args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    let out = cmd.output().map_err(|e| anyhow!("Không chạy được {}: {e}", tool.display()))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        let lines: Vec<&str> = err.lines().collect();
        bail!("{}", lines[lines.len().saturating_sub(20)..].join("\n"));
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// `configured` if it exists, otherwise `<name>.exe` found on PATH.
pub fn find_tool(name: &str, configured: Option<&Path>) -> Option<PathBuf> {
    find_tool_in(name, configured, None)
}

/// The user's chosen file first, then the copy bundled with the installer, then PATH.
pub fn find_tool_in(name: &str, configured: Option<&Path>, bundled: Option<&Path>) -> Option<PathBuf> {
    if let Some(c) = configured.filter(|c| c.is_file()) {
        return Some(c.to_path_buf());
    }
    let exe = format!("{name}.exe");
    if let Some(b) = bundled.map(|d| d.join(&exe)).filter(|p| p.is_file()) {
        return Some(b);
    }
    std::env::var_os("PATH").and_then(|paths| std::env::split_paths(&paths).map(|d| d.join(&exe)).find(|p| p.is_file()))
}

pub fn sanitize_stem(stem: &str) -> String {
    let s: String = stem.chars().map(|c| if c.is_control() || "<>:\"/\\|?*".contains(c) { '_' } else { c }).collect();
    let s = s.trim().trim_matches('.').trim().to_string();
    if s.is_empty() { "video".into() } else { s }
}

pub fn output_path(dir: &Path, stt: u32, stem: &str, overwrite: bool) -> PathBuf {
    let base = format!("{stt:03}_{}", sanitize_stem(stem));
    let p = dir.join(format!("{base}.mp4"));
    if overwrite || !p.exists() {
        return p;
    }
    (2..).map(|n| dir.join(format!("{base} ({n}).mp4"))).find(|q| !q.exists()).expect("unbounded range")
}

/// JPEG (quality 90, longest side ≤ 1920) as a data URL, with the original stem + ".jpg" as name
/// (the extension matches that name against @mentions in reference-image prompts).
pub fn encode_image_for_upload(path: &Path) -> Result<(String, String)> {
    use base64::Engine;
    use image::{codecs::jpeg::JpegEncoder, imageops::FilterType};
    let mut img = image::open(path).map_err(|e| anyhow!("Không đọc được ảnh {}: {e}", path.display()))?;
    if img.width().max(img.height()) > 1920 {
        img = img.resize(1920, 1920, FilterType::Triangle);
    }
    let mut buf = Vec::new();
    JpegEncoder::new_with_quality(&mut buf, 90).encode_image(&img.to_rgb8())?;
    let stem = path.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_else(|| "image".into());
    Ok((format!("{stem}.jpg"), format!("data:image/jpeg;base64,{}", base64::engine::general_purpose::STANDARD.encode(buf))))
}
#[cfg(test)]
mod tests {
    use super::*;

    const PROBE_JSON: &str = r#"{"streams":[{"codec_type":"video","width":1280,"height":720},{"codec_type":"audio"}],"format":{"duration":"10.005000"}}"#;

    fn probe_720(has_audio: bool) -> Probe {
        Probe { duration: 10.005, width: 1280, height: 720, has_audio }
    }

    fn mix() -> MixParams {
        MixParams { music: "C:/nhạc/bài 1.mp3".into(), music_volume: 0.25, fade_in: 1.0, fade_out: 1.5 }
    }

    #[test]
    fn parses_probe() {
        assert_eq!(parse_probe(PROBE_JSON).unwrap(), probe_720(true));
        assert!(parse_probe(r#"{"streams":[{"codec_type":"video"}],"format":{}}"#).is_err());
    }

    #[test]
    fn args_overlay_and_mix() {
        let a = build_args(Path::new("in.mp4"), Some(Path::new("ov.png")), Some(&mix()), 1.0, &probe_720(true), Path::new("out.mp4"));
        let fc = &a[a.iter().position(|x| x == "-filter_complex").unwrap() + 1];
        assert!(fc.contains("[1:v]scale=1280:720[ov];[0:v][ov]overlay=0:0:format=auto[v]"), "{fc}");
        assert!(fc.contains("[2:a]atrim=0:10.005"), "{fc}");
        assert!(fc.contains("afade=t=out:st=8.505:d=1.5"), "{fc}");
        assert!(fc.contains("[o][m]amix=inputs=2:duration=first:normalize=0[a]"), "{fc}");
        assert!(a.windows(2).any(|w| w[0] == "-stream_loop" && w[1] == "-1"));
        assert!(a.windows(2).any(|w| w[0] == "-map" && w[1] == "[a]"));
        assert_eq!(a.last().unwrap(), "out.mp4");
    }

    #[test]
    fn args_without_original_audio() {
        let a = build_args(Path::new("in.mp4"), None, Some(&mix()), 1.0, &probe_720(false), Path::new("out.mp4"));
        let fc = &a[a.iter().position(|x| x == "-filter_complex").unwrap() + 1];
        assert!(fc.starts_with("[1:a]atrim"), "{fc}");
        assert!(!fc.contains("amix"), "{fc}");
        assert!(a.windows(2).any(|w| w[0] == "-c:v" && w[1] == "copy"));
    }

    #[test]
    fn args_text_only_copies_original_audio() {
        let a = build_args(Path::new("in.mp4"), Some(Path::new("ov.png")), None, 1.0, &probe_720(true), Path::new("out.mp4"));
        assert!(a.windows(2).any(|w| w[0] == "-map" && w[1] == "0:a"));
        assert!(a.windows(2).any(|w| w[0] == "-c:a" && w[1] == "copy"));
    }

    #[test]
    fn zero_fades_are_omitted() {
        let m = MixParams { fade_in: 0.0, fade_out: 0.0, ..mix() };
        let a = build_args(Path::new("in.mp4"), None, Some(&m), 1.0, &probe_720(true), Path::new("out.mp4"));
        assert!(!a.iter().any(|x| x.contains("afade")));
    }

    #[test]
    fn output_names() {
        assert_eq!(sanitize_stem("Cảnh: 1/2?"), "Cảnh_ 1_2_");
        assert_eq!(sanitize_stem("  ..  "), "video");
        let tmp = tempfile::tempdir().unwrap();
        let p1 = output_path(tmp.path(), 7, "mèo con", false);
        assert_eq!(p1.file_name().unwrap(), "007_mèo con.mp4");
        std::fs::write(&p1, b"x").unwrap();
        assert_eq!(output_path(tmp.path(), 7, "mèo con", false).file_name().unwrap(), "007_mèo con (2).mp4");
        assert_eq!(output_path(tmp.path(), 7, "mèo con", true), p1);
    }

    #[test]
    fn large_image_is_resized_for_upload() {
        let tmp = tempfile::tempdir().unwrap();
        let src = tmp.path().join("ảnh lớn.png");
        image::RgbImage::from_pixel(3000, 1500, image::Rgb([200, 30, 30])).save(&src).unwrap();
        let (name, data) = encode_image_for_upload(&src).unwrap();
        assert_eq!(name, "ảnh lớn.jpg");
        assert!(data.starts_with("data:image/jpeg;base64,"));
        use base64::Engine;
        let bytes = base64::engine::general_purpose::STANDARD.decode(&data[23..]).unwrap();
        let img = image::load_from_memory(&bytes).unwrap();
        assert_eq!((img.width(), img.height()), (1920, 960));
    }

    fn filter_of(a: &[String]) -> Option<&String> {
        a.iter().position(|x| x == "-filter_complex").map(|i| &a[i + 1])
    }

    #[test]
    fn no_music_reduced_original_volume_is_filtered_and_reencoded() {
        for (vol, expected) in [(0.0, "[0:a]volume=0[a]"), (0.5, "[0:a]volume=0.5[a]")] {
            let a = build_args(Path::new("in.mp4"), None, None, vol, &probe_720(true), Path::new("out.mp4"));
            assert_eq!(filter_of(&a).map(String::as_str), Some(expected));
            assert!(a.windows(2).any(|w| w[0] == "-map" && w[1] == "[a]"), "{a:?}");
            assert!(a.windows(2).any(|w| w[0] == "-c:a" && w[1] == "aac"), "{a:?}");
        }
    }

    #[test]
    fn no_music_full_original_volume_copies_audio() {
        let a = build_args(Path::new("in.mp4"), None, None, 1.0, &probe_720(true), Path::new("out.mp4"));
        assert_eq!(filter_of(&a), None);
        assert!(a.windows(2).any(|w| w[0] == "-map" && w[1] == "0:a"));
        assert!(a.windows(2).any(|w| w[0] == "-c:a" && w[1] == "copy"));
    }

    #[test]
    fn no_audio_and_no_music_maps_no_audio() {
        let a = build_args(Path::new("in.mp4"), None, None, 0.3, &probe_720(false), Path::new("out.mp4"));
        assert!(!a.iter().any(|x| x == "0:a" || x == "[a]" || x == "-c:a"), "{a:?}");
    }

    #[test]
    fn music_mix_uses_the_original_volume_parameter() {
        let a = build_args(Path::new("in.mp4"), None, Some(&mix()), 0.4, &probe_720(true), Path::new("out.mp4"));
        assert!(filter_of(&a).unwrap().contains("[0:a]volume=0.4[o]"), "{a:?}");
    }

    #[test]
    fn bundled_tools_come_after_the_users_choice_and_before_path() {
        let tmp = tempfile::tempdir().unwrap();
        let bundled = tmp.path().join("ffmpeg");
        std::fs::create_dir_all(&bundled).unwrap();
        std::fs::write(bundled.join("ffprobe.exe"), b"x").unwrap();
        let chosen = tmp.path().join("chosen.exe");
        std::fs::write(&chosen, b"x").unwrap();
        assert_eq!(find_tool_in("ffprobe", None, Some(&bundled)), Some(bundled.join("ffprobe.exe")));
        assert_eq!(find_tool_in("ffprobe", Some(&chosen), Some(&bundled)), Some(chosen));
        assert_eq!(find_tool_in("ffmpeg", None, Some(&bundled)), find_tool("ffmpeg", None), "not bundled: falls back to PATH");
    }
}
