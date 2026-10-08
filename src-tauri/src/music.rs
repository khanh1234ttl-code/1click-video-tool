//! Background-music selection per row.
use crate::import::scan_files;
use crate::model::MusicMode;
use rand::seq::SliceRandom;
use rand::Rng;
use std::path::{Path, PathBuf};

pub const MUSIC_EXTS: [&str; 5] = ["mp3", "m4a", "wav", "aac", "ogg"];

pub fn list_tracks(folder: Option<&Path>) -> Vec<PathBuf> {
    folder.and_then(|f| scan_files(f, &MUSIC_EXTS).ok()).unwrap_or_default()
}

/// One pick per slot. A slot's assigned track wins when the file exists (any mode); other slots
/// use `fallback` when `mode` is Assigned, otherwise `mode`. Random never repeats a track until
/// all were used, and never repeats back-to-back across rounds.
pub fn pick_music(assigned: &[Option<PathBuf>], mode: MusicMode, fallback: MusicMode, tracks: &[PathBuf], rng: &mut impl Rng) -> Vec<Option<PathBuf>> {
    let auto = if mode == MusicMode::Assigned { fallback } else { mode };
    let mut bag: Vec<usize> = Vec::new();
    let mut seq = 0usize;
    let mut last: Option<usize> = None;
    assigned
        .iter()
        .map(|a| {
            if let Some(p) = a.as_ref().filter(|p| p.exists()) {
                return Some(p.clone());
            }
            if tracks.is_empty() {
                return None;
            }
            let idx = if auto == MusicMode::Sequential {
                let i = seq % tracks.len();
                seq += 1;
                i
            } else {
                if bag.is_empty() {
                    bag = (0..tracks.len()).collect();
                    bag.shuffle(rng);
                    let n = bag.len();
                    if n > 1 && Some(bag[n - 1]) == last {
                        bag.swap(0, n - 1);
                    }
                }
                bag.pop().expect("bag refilled above")
            };
            last = Some(idx);
            Some(tracks[idx].clone())
        })
        .collect()
}
/// Writes tracks (natural order, wrapping) into the selected rows' `music`, in STT order.
/// An empty `stts` means every row.
pub fn assign_in_order(rows: &mut [crate::model::Row], tracks: &[PathBuf], stts: &[u32]) -> Result<usize, String> {
    if tracks.is_empty() {
        return Err("Chưa có file nhạc trong folder nhạc".into());
    }
    let mut n = 0;
    for r in rows.iter_mut().filter(|r| stts.is_empty() || stts.contains(&r.stt)) {
        r.music = Some(tracks[n % tracks.len()].clone());
        n += 1;
    }
    Ok(n)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::{rngs::StdRng, SeedableRng};

    fn tracks(n: usize) -> Vec<PathBuf> {
        (0..n).map(|i| PathBuf::from(format!("t{i}.mp3"))).collect()
    }

    #[test]
    fn random_uses_every_track_before_repeating() {
        let t = tracks(4);
        let mut rng = StdRng::seed_from_u64(7);
        let picks = pick_music(&vec![None; 8], MusicMode::Random, MusicMode::Random, &t, &mut rng);
        let first: std::collections::HashSet<_> = picks[..4].iter().cloned().collect();
        assert_eq!(first.len(), 4);
        assert_ne!(picks[3], picks[4], "no immediate repeat across rounds");
    }

    #[test]
    fn sequential_cycles_in_order() {
        let t = tracks(2);
        let mut rng = StdRng::seed_from_u64(1);
        let picks = pick_music(&vec![None; 3], MusicMode::Sequential, MusicMode::Random, &t, &mut rng);
        assert_eq!(picks, vec![Some(t[0].clone()), Some(t[1].clone()), Some(t[0].clone())]);
    }

    #[test]
    fn assigned_existing_track_wins_and_missing_falls_back() {
        let tmp = tempfile::tempdir().unwrap();
        let mine = tmp.path().join("của tôi.mp3");
        std::fs::write(&mine, b"x").unwrap();
        let t = tracks(1);
        let mut rng = StdRng::seed_from_u64(1);
        let assigned = vec![Some(mine.clone()), Some(tmp.path().join("đã xoá.mp3")), None];
        let picks = pick_music(&assigned, MusicMode::Assigned, MusicMode::Sequential, &t, &mut rng);
        assert_eq!(picks, vec![Some(mine), Some(t[0].clone()), Some(t[0].clone())]);
    }

    #[test]
    fn no_tracks_gives_none() {
        let mut rng = StdRng::seed_from_u64(1);
        assert_eq!(pick_music(&vec![None; 2], MusicMode::Random, MusicMode::Random, &[], &mut rng), vec![None, None]);
        assert!(list_tracks(Some(Path::new("Z:/không/tồn/tại"))).is_empty());
        assert!(list_tracks(None).is_empty());
    }

    #[test]
    fn assign_in_order_uses_natural_order_and_wraps() {
        let tmp = tempfile::tempdir().unwrap();
        for n in ["10.mp3", "2.mp3", "1.mp3"] { std::fs::write(tmp.path().join(n), b"x").unwrap(); }
        let tracks = list_tracks(Some(tmp.path()));
        let mut rows = crate::import::rows_from_images((1..=5).map(|i| PathBuf::from(format!("{i}.png"))).collect());
        assert_eq!(assign_in_order(&mut rows, &tracks, &[]), Ok(5));
        let names: Vec<_> = rows.iter().map(|r| r.music.as_ref().unwrap().file_name().unwrap().to_string_lossy().into_owned()).collect();
        assert_eq!(names, ["1.mp3", "2.mp3", "10.mp3", "1.mp3", "2.mp3"]);
        rows[0].music = None;
        assert_eq!(assign_in_order(&mut rows, &tracks, &[1, 3]), Ok(2));
        assert_eq!(rows[2].music.as_ref().unwrap().file_name().unwrap(), "2.mp3", "selection restarts at the first track");
    }

    #[test]
    fn assign_in_order_without_tracks_changes_nothing() {
        let mut rows = crate::import::rows_from_images(vec!["1.png".into()]);
        assert_eq!(assign_in_order(&mut rows, &[], &[]), Err("Chưa có file nhạc trong folder nhạc".to_string()));
        assert_eq!(rows[0].music, None);
    }
}
