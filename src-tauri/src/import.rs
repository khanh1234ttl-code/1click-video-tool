//! Building rows from an image folder and filling prompts/text/music from paste or tables.
use crate::model::{Row, RowStatus};
use anyhow::{anyhow, bail, Result};
use std::fs;
use std::path::{Path, PathBuf};

pub const IMAGE_EXTS: [&str; 4] = ["jpg", "jpeg", "png", "webp"];

pub fn has_ext(p: &Path, exts: &[&str]) -> bool {
    p.extension().map_or(false, |e| exts.contains(&e.to_string_lossy().to_lowercase().as_str()))
}

fn file_name(p: &Path) -> String {
    p.file_name().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default()
}

/// Files in `dir` (not recursive) with one of `exts`, in natural order (1, 2, 10).
pub fn scan_files(dir: &Path, exts: &[&str]) -> Result<Vec<PathBuf>> {
    let mut v: Vec<PathBuf> = fs::read_dir(dir)?.filter_map(|e| e.ok()).map(|e| e.path()).filter(|p| p.is_file() && has_ext(p, exts)).collect();
    v.sort_by(|a, b| natord::compare_ignore_case(&file_name(a), &file_name(b)));
    Ok(v)
}

pub fn rows_from_images(paths: Vec<PathBuf>) -> Vec<Row> {
    paths.into_iter().enumerate().map(|(i, p)| Row::new(i as u32 + 1, p)).collect()
}

/// Next free STT: rows keep their STT for life (it names their output), so new rows go after the last.
pub fn next_stt(rows: &[Row]) -> u32 {
    rows.iter().map(|r| r.stt).max().unwrap_or(0) + 1
}

/// Appends `n` prompt rows without images; returns their STTs.
pub fn add_rows(rows: &mut Vec<Row>, n: usize) -> Vec<u32> {
    (0..n).map(|_| {
        let stt = next_stt(rows);
        rows.push(Row::empty(stt));
        stt
    }).collect()
}

/// The extension or FFmpeg is still working on this row.
pub fn busy(r: &Row) -> bool {
    r.status.is_active() || matches!(r.status, RowStatus::Downloaded | RowStatus::PostProcessing)
}

/// Removes the selected rows unless the extension or FFmpeg is still working on them.
/// Returns the STTs that were kept because they are busy.
pub fn delete_rows(rows: &mut Vec<Row>, stts: &[u32]) -> Vec<u32> {
    let kept: Vec<u32> = rows.iter().filter(|r| stts.contains(&r.stt) && busy(r)).map(|r| r.stt).collect();
    rows.retain(|r| !stts.contains(&r.stt) || busy(r));
    kept
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AssignRule {
    /// Every selected row uses the same images (e.g. 2 reference images for 10 prompts).
    All,
    /// Selected row i gets image i mod n (one image each).
    RoundRobin,
    /// One new row per image.
    OnePerImage,
}

/// Assigns `images` to the selected rows (`stts` empty = every row). Returns rows changed or added.
pub fn assign_images(rows: &mut Vec<Row>, images: &[PathBuf], rule: AssignRule, stts: &[u32]) -> usize {
    let selected = |r: &Row| stts.is_empty() || stts.contains(&r.stt);
    match rule {
        AssignRule::All => rows.iter_mut().filter(|r| selected(r)).map(|r| r.images = images.to_vec()).count(),
        AssignRule::RoundRobin if images.is_empty() => 0,
        AssignRule::RoundRobin => rows.iter_mut().filter(|r| selected(r)).enumerate().map(|(i, r)| r.images = vec![images[i % images.len()].clone()]).count(),
        AssignRule::OnePerImage => {
            for img in images {
                let stt = next_stt(rows);
                rows.push(Row::new(stt, img.clone()));
            }
            images.len()
        }
    }
}

/// One value per non-empty line, from the row `start_stt` on; rows are added when lines remain.
fn paste_lines(rows: &mut Vec<Row>, start_stt: u32, text: &str, mut set: impl FnMut(&mut Row, &str)) -> usize {
    let lines: Vec<&str> = text.lines().map(str::trim).filter(|l| !l.is_empty()).collect();
    let start = rows.iter().position(|r| r.stt == start_stt).unwrap_or(0);
    let missing = (start + lines.len()).saturating_sub(rows.len());
    add_rows(rows, missing);
    for (row, line) in rows[start..].iter_mut().zip(&lines) {
        set(row, line);
    }
    lines.len()
}

/// One prompt per non-empty line, assigned to rows starting at `start_stt`. Returns rows filled.
pub fn paste_prompts(rows: &mut Vec<Row>, start_stt: u32, text: &str) -> usize {
    paste_lines(rows, start_stt, text, |r, l| r.prompt = l.to_string())
}

/// One on-video text per non-empty line, assigned to rows starting at `start_stt`.
pub fn paste_texts(rows: &mut Vec<Row>, start_stt: u32, text: &str) -> usize {
    paste_lines(rows, start_stt, text, |r, l| r.text = l.to_string())
}

/// Sets each selected row's text from `template`: `{stt}` → STT, `{ten}` → image name without
/// extension. An empty `stts` means every row. Returns rows changed.
pub fn apply_text_template(rows: &mut [Row], template: &str, stts: &[u32]) -> usize {
    let mut n = 0;
    for r in rows.iter_mut().filter(|r| stts.is_empty() || stts.contains(&r.stt)) {
        r.text = template.replace("{stt}", &r.stt.to_string()).replace("{ten}", &r.image_stem());
        n += 1;
    }
    n
}

/// One table row = one prompt, in order. `images` lists image names from the `anh` cell.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct TableRecord {
    pub images: Vec<String>,
    pub prompt: Option<String>,
    pub text: Option<String>,
    pub music: Option<String>,
}

impl TableRecord {
    fn is_blank(&self) -> bool {
        self.images.is_empty() && self.prompt.is_none() && self.text.is_none() && self.music.is_none()
    }
}

fn header_key(h: &str) -> String {
    h.trim().trim_start_matches('\u{feff}').to_lowercase()
}

fn column(headers: &[String], names: &[&str]) -> Option<usize> {
    headers.iter().position(|h| names.contains(&header_key(h).as_str()))
}

/// Image names in one cell, separated by `;`, `,` or line breaks.
fn split_names(cell: &str) -> Vec<String> {
    cell.split([';', ',', '\n']).map(str::trim).filter(|s| !s.is_empty()).map(String::from).collect()
}

fn records_from_grid(grid: Vec<Vec<String>>) -> Result<Vec<TableRecord>> {
    let mut it = grid.into_iter();
    let headers = it.next().ok_or_else(|| anyhow!("Bảng trống"))?;
    let img = column(&headers, &["anh", "ảnh", "image", "file"]);
    let prompt = column(&headers, &["prompt"]);
    let text = column(&headers, &["text", "chữ", "chu"]);
    let music = column(&headers, &["nhac", "nhạc", "music"]);
    if img.or(prompt).or(text).or(music).is_none() {
        bail!("Bảng cần ít nhất một cột anh, prompt, text hoặc nhac");
    }
    let cell = |row: &Vec<String>, c: Option<usize>| c.and_then(|i| row.get(i)).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let mut recs: Vec<TableRecord> = it
        .map(|row| TableRecord { images: cell(&row, img).map(|c| split_names(&c)).unwrap_or_default(), prompt: cell(&row, prompt), text: cell(&row, text), music: cell(&row, music) })
        .collect();
    while recs.last().is_some_and(TableRecord::is_blank) {
        recs.pop();
    }
    Ok(recs)
}

fn parse_csv(bytes: Vec<u8>) -> Result<Vec<TableRecord>> {
    let text = String::from_utf8(bytes).map_err(|_| anyhow!("File CSV phải lưu dạng UTF-8 (trong Excel chọn 'CSV UTF-8'), hoặc dùng file .xlsx"))?;
    let text = text.trim_start_matches('\u{feff}');
    let mut rdr = csv::ReaderBuilder::new().has_headers(false).flexible(true).from_reader(text.as_bytes());
    let grid = rdr.records().filter_map(|r| r.ok()).map(|r| r.iter().map(String::from).collect()).collect();
    records_from_grid(grid)
}

fn parse_xlsx(path: &Path) -> Result<Vec<TableRecord>> {
    use calamine::{open_workbook_auto, Reader};
    let mut wb = open_workbook_auto(path)?;
    let range = wb.worksheet_range_at(0).ok_or_else(|| anyhow!("File Excel không có sheet nào"))??;
    let grid = range.rows().map(|r| r.iter().map(|c| c.to_string()).collect()).collect();
    records_from_grid(grid)
}

pub fn parse_table(path: &Path) -> Result<Vec<TableRecord>> {
    match path.extension().map(|e| e.to_string_lossy().to_lowercase()).as_deref() {
        Some("csv") => parse_csv(fs::read(path)?),
        Some("xlsx") | Some("xls") => parse_xlsx(path),
        _ => bail!("Chỉ hỗ trợ file .csv hoặc .xlsx"),
    }
}

/// Finds an image of the library by file name, or by name without extension when that is
/// unambiguous (case-insensitive).
pub fn resolve_image(library: &[PathBuf], name: &str) -> Option<PathBuf> {
    let key = name.trim().to_lowercase();
    let lower = |s: Option<&std::ffi::OsStr>| s.map(|s| s.to_string_lossy().to_lowercase()).unwrap_or_default();
    if let Some(p) = library.iter().find(|p| lower(p.file_name()) == key) {
        return Some(p.clone());
    }
    let mut stems = library.iter().filter(|p| lower(p.file_stem()) == key);
    let first = stems.next()?;
    stems.next().is_none().then(|| first.clone())
}

/// Fills prompt rows in STT order from table records (record i → prompt i), adding rows as
/// needed. Blank cells leave fields unchanged. Image names come from `library`; relative music
/// names resolve inside `music_dir`. Returns the image names that were not found.
pub fn apply_table(rows: &mut Vec<Row>, recs: &[TableRecord], music_dir: Option<&Path>, library: &[PathBuf]) -> Vec<String> {
    rows.sort_by_key(|r| r.stt);
    let mut unmatched = Vec::new();
    for (i, rec) in recs.iter().enumerate() {
        if rec.is_blank() {
            continue;
        }
        if i >= rows.len() {
            add_rows(rows, i + 1 - rows.len());
        }
        let row = &mut rows[i];
        let mut found = Vec::new();
        for name in &rec.images {
            match resolve_image(library, name) {
                Some(p) => found.push(p),
                None => unmatched.push(format!("{name} (dòng {})", i + 2)),
            }
        }
        if !found.is_empty() {
            row.images = found;
        }
        fill_row(row, rec, music_dir);
    }
    unmatched
}

fn fill_row(row: &mut Row, rec: &TableRecord, music_dir: Option<&Path>) {
    if let Some(p) = &rec.prompt {
        row.prompt = p.clone();
    }
    if let Some(t) = &rec.text {
        row.text = t.clone();
    }
    if let Some(m) = &rec.music {
        let p = PathBuf::from(m);
        row.music = Some(match music_dir {
            Some(d) if p.is_relative() => d.join(p),
            _ => p,
        });
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn touch(dir: &Path, name: &str) {
        fs::write(dir.join(name), b"x").unwrap();
    }
    fn lib(names: &[&str]) -> Vec<PathBuf> {
        names.iter().map(PathBuf::from).collect()
    }

    #[test]
    fn review_exact_filename_beats_ambiguous_stem() {
        let l = lib(&["a.jpg", "a.png"]);
        assert_eq!(resolve_image(&l, "a.png"), Some(PathBuf::from("a.png")));
        assert_eq!(resolve_image(&l, "a"), None, "two images share the stem");
    }

    #[test]
    fn review_unique_dotted_stem_matches_without_image_extension() {
        assert_eq!(resolve_image(&lib(&["a.v1.png"]), " A.V1 "), Some(PathBuf::from("a.v1.png")));
    }

    #[test]
    fn review_exact_filename_wins_over_another_images_dotted_stem() {
        assert_eq!(resolve_image(&lib(&["a.png.jpg", "a.png"]), "A.PNG"), Some(PathBuf::from("a.png")));
    }

    #[test]
    fn review_ambiguous_dotted_stem_does_not_mutate_either_row() {
        let l = lib(&["a.v1.jpg", "a.v1.png"]);
        let mut rows = rows_from_images(l.clone());
        let rec = TableRecord { images: vec!["A.V1".into()], prompt: Some("p".into()), ..Default::default() };
        assert_eq!(apply_table(&mut rows, &[rec], None, &l), vec!["A.V1 (dòng 2)"]);
        assert_eq!(rows[0].images, vec![PathBuf::from("a.v1.jpg")], "unresolved names leave images unchanged");
    }

    #[test]
    fn scan_is_natural_and_filters_extensions() {
        let tmp = tempfile::tempdir().unwrap();
        for n in ["ảnh 10.jpg", "ảnh 2.PNG", "ảnh 1.webp", "ghi chú.txt"] {
            touch(tmp.path(), n);
        }
        fs::create_dir(tmp.path().join("_1click")).unwrap();
        let names: Vec<String> = scan_files(tmp.path(), &IMAGE_EXTS).unwrap().iter().map(|p| p.file_name().unwrap().to_string_lossy().into_owned()).collect();
        assert_eq!(names, vec!["ảnh 1.webp", "ảnh 2.PNG", "ảnh 10.jpg"]);
    }

    #[test]
    fn paste_fills_from_start_row_and_skips_blank_lines() {
        let mut rows = rows_from_images(vec!["a.jpg".into(), "b.jpg".into(), "c.jpg".into()]);
        let n = paste_prompts(&mut rows, 2, "  một \n\n hai \n");
        assert_eq!(n, 2);
        assert_eq!(rows[0].prompt, "");
        assert_eq!(rows[1].prompt, "một");
        assert_eq!(rows[2].prompt, "hai");
        assert_eq!(rows.len(), 3);
    }

    #[test]
    fn paste_adds_rows_for_extra_lines_without_touching_images() {
        let mut rows = rows_from_images(vec!["a.jpg".into(), "b.jpg".into()]);
        assert_eq!(paste_prompts(&mut rows, 2, "một\nhai\nba"), 3);
        assert_eq!(rows.iter().map(|r| (r.stt, r.prompt.as_str())).collect::<Vec<_>>(), [(1, ""), (2, "một"), (3, "hai"), (4, "ba")]);
        assert_eq!(rows[1].images, vec![PathBuf::from("b.jpg")]);
        assert!(rows[2].images.is_empty() && rows[3].images.is_empty());
    }

    #[test]
    fn rows_are_added_after_the_last_stt_and_busy_rows_are_kept() {
        let mut rows = rows_from_images(vec!["a.jpg".into(), "b.jpg".into(), "c.jpg".into()]);
        rows.remove(1);
        assert_eq!(add_rows(&mut rows, 2), vec![4, 5]);
        rows[0].status = RowStatus::Rendering { percent: 10 };
        assert_eq!(delete_rows(&mut rows, &[1, 3, 5]), vec![1]);
        assert_eq!(rows.iter().map(|r| r.stt).collect::<Vec<_>>(), [1, 4], "STTs are never renumbered");
    }

    #[test]
    fn assign_images_by_rule() {
        let (a, b) = (PathBuf::from("a.png"), PathBuf::from("b.png"));
        let mut rows: Vec<Row> = (1..=3).map(Row::empty).collect();
        assert_eq!(assign_images(&mut rows, &[a.clone(), b.clone()], AssignRule::All, &[]), 3);
        assert!(rows.iter().all(|r| r.images == vec![a.clone(), b.clone()]));
        assert_eq!(assign_images(&mut rows, &[a.clone(), b.clone()], AssignRule::RoundRobin, &[1, 2, 3]), 3);
        assert_eq!(rows.iter().map(|r| r.images.clone()).collect::<Vec<_>>(), [vec![a.clone()], vec![b.clone()], vec![a.clone()]]);
        assert_eq!(assign_images(&mut rows, &[b.clone()], AssignRule::All, &[2]), 1);
        assert_eq!(rows[0].images, vec![a.clone()]);
        assert_eq!(assign_images(&mut rows, &[a.clone(), b.clone()], AssignRule::OnePerImage, &[]), 2);
        assert_eq!(rows.iter().map(|r| r.stt).collect::<Vec<_>>(), [1, 2, 3, 4, 5]);
        assert_eq!(rows[4].images, vec![b.clone()]);
        assert_eq!(assign_images(&mut rows, &[], AssignRule::RoundRobin, &[]), 0);
    }

    #[test]
    fn csv_with_bom_and_vietnamese_headers() {
        let tmp = tempfile::tempdir().unwrap();
        let f = tmp.path().join("ds.csv");
        fs::write(&f, "\u{feff}Ảnh,Prompt,Chữ,Nhạc\nA.JPG,mèo đi dạo,Tập 1,bai1.mp3\n,không ảnh,,\n\"b; c.png\",chó chạy,,\n,,,\n").unwrap();
        let recs = parse_table(&f).unwrap();
        assert_eq!(recs.len(), 3, "trailing blank rows are dropped");
        assert_eq!(recs[0], TableRecord { images: vec!["A.JPG".into()], prompt: Some("mèo đi dạo".into()), text: Some("Tập 1".into()), music: Some("bai1.mp3".into()) });
        assert!(recs[1].images.is_empty());
        assert_eq!(recs[2].images, vec!["b".to_string(), "c.png".to_string()]);
    }

    #[test]
    fn csv_not_utf8_gives_vietnamese_hint() {
        let tmp = tempfile::tempdir().unwrap();
        let f = tmp.path().join("ds.csv");
        fs::write(&f, [b'a', b'n', b'h', b'\n', 0xE1, b'\n']).unwrap();
        let err = parse_table(&f).unwrap_err().to_string();
        assert!(err.contains("UTF-8"), "{err}");
    }

    #[test]
    fn xlsx_is_read() {
        let tmp = tempfile::tempdir().unwrap();
        let f = tmp.path().join("ds.xlsx");
        let mut wb = rust_xlsxwriter::Workbook::new();
        let ws = wb.add_worksheet();
        for (c, h) in ["anh", "prompt", "text", "nhac"].iter().enumerate() {
            ws.write_string(0, c as u16, *h).unwrap();
        }
        ws.write_string(1, 0, "a.jpg").unwrap();
        ws.write_string(1, 1, "một con cáo").unwrap();
        wb.save(&f).unwrap();
        let recs = parse_table(&f).unwrap();
        assert_eq!(recs, vec![TableRecord { images: vec!["a.jpg".into()], prompt: Some("một con cáo".into()), text: None, music: None }]);
    }

    #[test]
    fn table_rows_are_prompts_in_order_with_several_images() {
        let l = lib(&["C:/i/A.jpg", "C:/i/b.png", "C:/i/c.png"]);
        let mut rows = rows_from_images(l[..2].to_vec());
        let recs = vec![
            TableRecord { images: vec!["a.JPG".into(), "c".into()], prompt: Some("p1".into()), text: None, music: Some("x.mp3".into()) },
            TableRecord { images: vec![], prompt: None, text: Some("t2".into()), music: None },
            TableRecord { images: vec!["zzz.jpg".into(), "b".into()], prompt: Some("p3".into()), text: None, music: None },
        ];
        let unmatched = apply_table(&mut rows, &recs, Some(Path::new("C:/nhac")), &l);
        assert_eq!(unmatched, vec!["zzz.jpg (dòng 4)".to_string()]);
        assert_eq!(rows[0].images, vec![l[0].clone(), l[2].clone()]);
        assert_eq!(rows[0].music, Some(PathBuf::from("C:/nhac").join("x.mp3")));
        assert_eq!((rows[1].text.as_str(), rows[1].images.clone()), ("t2", vec![l[1].clone()]), "no anh: images kept");
        assert_eq!((rows[2].stt, rows[2].prompt.as_str(), rows[2].images.clone()), (3, "p3", vec![l[1].clone()]), "row added");
    }

    #[test]
    fn paste_texts_fills_from_start_row() {
        let mut rows = rows_from_images(vec!["1.png".into(), "2.png".into(), "3.png".into()]);
        assert_eq!(paste_texts(&mut rows, 2, "Hai\n\n  Ba  "), 2);
        assert_eq!(rows.iter().map(|r| r.text.as_str()).collect::<Vec<_>>(), ["", "Hai", "Ba"]);
    }

    #[test]
    fn text_template_numbers_and_names() {
        let mut rows = rows_from_images(vec!["D:/a/cảnh 1.png".into(), "D:/a/cảnh 2.png".into()]);
        assert_eq!(apply_text_template(&mut rows, "Tập {stt} – {ten}", &[]), 2);
        assert_eq!(rows[1].text, "Tập 2 – cảnh 2");
        assert_eq!(apply_text_template(&mut rows, "X{stt}", &[1]), 1);
        assert_eq!((rows[0].text.as_str(), rows[1].text.as_str()), ("X1", "Tập 2 – cảnh 2"));
    }

    #[test]
    fn table_without_image_column_matches_by_order() {
        let grid = vec![
            vec!["text".to_string(), "nhac".to_string()],
            vec!["Một".into(), "a.mp3".into()],
            vec!["".into(), "".into()],
            vec!["Ba".into(), "".into()],
            vec!["Bốn".into(), "".into()],
        ];
        let recs = records_from_grid(grid).unwrap();
        let mut rows = rows_from_images(vec!["1.png".into(), "2.png".into(), "3.png".into()]);
        rows[1].text = "giữ nguyên".into();
        let unmatched = apply_table(&mut rows, &recs, Some(Path::new("D:/m")), &[]);
        assert!(unmatched.is_empty());
        assert_eq!(rows[0].text, "Một");
        assert_eq!(rows[0].music, Some(PathBuf::from("D:/m").join("a.mp3")));
        assert_eq!(rows[1].text, "giữ nguyên", "blank cells never erase");
        assert_eq!(rows[2].text, "Ba");
        assert_eq!((rows[3].stt, rows[3].text.as_str()), (4, "Bốn"), "extra rows become new prompts");
    }

    #[test]
    fn table_needs_a_data_column() {
        let err = records_from_grid(vec![vec!["ghi chú".to_string()], vec!["x".into()]]).unwrap_err();
        assert!(err.to_string().contains("ít nhất một cột anh, prompt, text hoặc nhac"), "{err}");
    }

    #[test]
    fn shipped_samples_import_as_documented() {
        let samples = Path::new(env!("CARGO_MANIFEST_DIR")).join("../samples");
        let by_name = parse_table(&samples.join("mau-nhap-theo-ten-anh.xlsx")).unwrap();
        assert_eq!(by_name.len(), 3);
        assert_eq!(by_name[0], TableRecord { images: vec!["01_thuyen-buom.png".into()], prompt: Some("the sailboat drifts gently on the waves at sunset, water sparkles".into()), text: Some("Tập 1".into()), music: Some("nhac-1.mp3".into()) });
        assert_eq!(by_name[1].music, None, "blank music cell stays blank");
        assert_eq!(parse_table(&samples.join("mau-nhap-theo-ten-anh.csv")).unwrap(), by_name);
        let by_order = parse_table(&samples.join("mau-nhap-theo-thu-tu.xlsx")).unwrap();
        assert_eq!(by_order.len(), 3);
        assert!(by_order.iter().all(|r| r.images.is_empty()), "no anh column: images unchanged");
        let mut rows = rows_from_images(vec!["a.png".into(), "b.png".into(), "c.png".into()]);
        assert!(apply_table(&mut rows, &by_order, None, &[]).is_empty());
        assert_eq!(rows.iter().map(|r| r.text.as_str()).collect::<Vec<_>>(), ["Tập 1", "Tập 2", "Tập 3"]);
        let shared = parse_table(&samples.join("mau-nhieu-anh.xlsx")).unwrap();
        assert!(shared.len() >= 3 && shared.iter().all(|r| r.images.len() == 2), "2 reference images per prompt");
    }
}
