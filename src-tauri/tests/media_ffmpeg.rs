//! Runs real ffmpeg/ffprobe from PATH; skipped (passes) when they are not installed.
use oneclick_video_tool_lib::media::*;
use std::path::{Path, PathBuf};

fn tools() -> Option<(PathBuf, PathBuf)> {
    Some((find_tool("ffmpeg", None)?, find_tool("ffprobe", None)?))
}

fn ff(ffmpeg: &Path, args: &[&str]) {
    run_tool(ffmpeg, &args.iter().map(|s| s.to_string()).collect::<Vec<_>>()).unwrap();
}

/// Red channel of one pixel of the first frame.
fn red_at(ffmpeg: &Path, file: &Path, x: u32, y: u32) -> u8 {
    let out = file.with_extension("rgb");
    ff(ffmpeg, &["-y", "-v", "error", "-i", file.to_str().unwrap(), "-frames:v", "1", "-vf", &format!("format=rgb24,crop=1:1:{x}:{y}"), "-f", "rawvideo", "-pix_fmt", "rgb24", out.to_str().unwrap()]);
    std::fs::read(out).unwrap()[0]
}

#[test]
fn overlay_is_scaled_to_video_and_music_is_mixed() {
    let Some((ffmpeg, ffprobe)) = tools() else { eprintln!("ffmpeg not found, skipping"); return };
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("thư mục thử");
    std::fs::create_dir_all(&dir).unwrap();
    let raw = dir.join("001.mp4");
    let music = dir.join("nhạc nền.mp3");
    let ov = dir.join("001.png");
    let out = dir.join("001_kết quả.mp4");
    // 1920x1080 video with audio (like Veo 1080p), music shorter than the video (must loop)
    ff(&ffmpeg, &["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=1920x1080:rate=24:duration=3", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", raw.to_str().unwrap()]);
    ff(&ffmpeg, &["-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=880:duration=1", music.to_str().unwrap()]);
    // overlay rendered at 1280x720 (the 720p preview size): opaque red left half, transparent right half
    let mut img = image::RgbaImage::new(1280, 720);
    for (x, _, p) in img.enumerate_pixels_mut() {
        *p = if x < 640 { image::Rgba([255, 0, 0, 255]) } else { image::Rgba([0, 0, 0, 0]) };
    }
    img.save(&ov).unwrap();

    let probe_in = probe(&ffprobe, &raw).unwrap();
    let mix = MixParams { music: music.clone(), music_volume: 0.3, original_volume: 1.0, fade_in: 0.5, fade_out: 0.5 };
    run_tool(&ffmpeg, &build_args(&raw, Some(&ov), Some(&mix), &probe_in, &out)).unwrap();

    let p = probe(&ffprobe, &out).unwrap();
    assert_eq!((p.width, p.height), (1920, 1080));
    assert!(p.has_audio);
    assert!((p.duration - 3.0).abs() < 0.2, "duration {}", p.duration);
    assert!(red_at(&ffmpeg, &out, 100, 540) > 200, "left half covered by the scaled overlay");
}

#[test]
fn video_without_audio_gets_music_only() {
    let Some((ffmpeg, ffprobe)) = tools() else { return };
    let tmp = tempfile::tempdir().unwrap();
    let raw = tmp.path().join("silent.mp4");
    let music = tmp.path().join("m.mp3");
    let out = tmp.path().join("out.mp4");
    ff(&ffmpeg, &["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=640x360:rate=24:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", raw.to_str().unwrap()]);
    ff(&ffmpeg, &["-y", "-v", "error", "-f", "lavfi", "-i", "sine=duration=5", music.to_str().unwrap()]);
    let pin = probe(&ffprobe, &raw).unwrap();
    assert!(!pin.has_audio);
    let mix = MixParams { music, music_volume: 0.5, original_volume: 1.0, fade_in: 0.0, fade_out: 0.5 };
    run_tool(&ffmpeg, &build_args(&raw, None, Some(&mix), &pin, &out)).unwrap();
    let p = probe(&ffprobe, &out).unwrap();
    assert!(p.has_audio);
    assert!((p.duration - 2.0).abs() < 0.2, "music trimmed to the video: {}", p.duration);
}
