//! Building rows from an image folder and filling prompts/text/music from paste or tables.
use crate::model::Row;
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

fn paste_lines(rows: &mut [Row], start_stt: u32, text: &str, mut set: impl FnMut(&mut Row, &str)) -> usize {
    let lines: Vec<&str> = text.lines().map(str::trim).filter(|l| !l.is_empty()).collect();
    let start = rows.iter().position(|r| r.stt == start_stt).unwrap_or(0);
    let mut n = 0;
    for (row, line) in rows[start..].iter_mut().zip(lines) {
        set(row, line);
        n += 1;
    }
    n
}

/// One prompt per non-empty line, assigned to rows starting at `start_stt`. Returns rows filled.
pub fn paste_prompts(rows: &mut [Row], start_stt: u32, text: &str) -> usize {
    paste_lines(rows, start_stt, text, |r, l| r.prompt = l.to_string())
}

/// One on-video text per non-empty line, assigned to rows starting at `start_stt`.
pub fn paste_texts(rows: &mut [Row], start_stt: u32, text: &str) -> usize {
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

#[derive(Debug, Clone, PartialEq, Default)]
pub struct TableRecord {
    pub image: String,
    pub prompt: Option<String>,
    pub text: Option<String>,
    pub music: Option<String>,
}

fn header_key(h: &str) -> String {
    h.trim().trim_start_matches('\u{feff}').to_lowercase()
}

fn column(headers: &[String], names: &[&str]) -> Option<usize> {
    headers.iter().position(|h| names.contains(&header_key(h).as_str()))
}

fn records_from_grid(grid: Vec<Vec<String>>) -> Result<Vec<TableRecord>> {
    let mut it = grid.into_iter();
    let headers = it.next().ok_or_else(|| anyhow!("Bảng trống"))?;
    let img = column(&headers, &["anh", "ảnh", "image", "file"]);
    let prompt = column(&headers, &["prompt"]);
    let text = column(&headers, &["text", "chữ", "chu"]);
    let music = column(&headers, &["nhac", "nhạc", "music"]);
    let cell = |row: &Vec<String>, c: Option<usize>| c.and_then(|i| row.get(i)).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let Some(img) = img else {
        // No image column: data row i goes to video i (an empty `image` marks order matching).
        if prompt.or(text).or(music).is_none() {
            bail!("Bảng cần ít nhất một cột prompt, text hoặc nhac");
        }
        return Ok(it.map(|row| TableRecord { image: String::new(), prompt: cell(&row, prompt), text: cell(&row, text), music: cell(&row, music) }).collect());
    };
    Ok(it
        .filter_map(|row| {
            let image = cell(&row, Some(img))?;
            Some(TableRecord { image, prompt: cell(&row, prompt), text: cell(&row, text), music: cell(&row, music) })
        })
        .collect())
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

/// Fills rows from table records matched by image file name or stem (case-insensitive), or by
/// position when the table had no image column. Blank cells leave fields unchanged. Relative
/// music names are resolved inside `music_dir`. Returns what could not be matched.
pub fn apply_table(rows: &mut [Row], recs: &[TableRecord], music_dir: Option<&Path>) -> Vec<String> {
    let mut unmatched = Vec::new();
    for (i, rec) in recs.iter().enumerate() {
        if rec.image.is_empty() {
            match rows.get_mut(i) {
                Some(row) => fill_row(row, rec, music_dir),
                None => unmatched.push(format!("dòng {} (không có video thứ {})", i + 2, i + 1)),
            }
            continue;
        }
        let key = rec.image.trim().to_lowercase();
        let exact = rows.iter().position(|r| r.image_name().to_lowercase() == key);
        let matched = exact.or_else(|| {
            let mut matches = rows.iter().enumerate().filter(|(_, r)| r.image_stem().to_lowercase() == key);
            let first = matches.next()?.0;
            matches.next().is_none().then_some(first)
        });
        let Some(row) = matched.map(|i| &mut rows[i]) else {
            unmatched.push(rec.image.clone());
            continue;
        };
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

    #[test]
    fn review_exact_filename_beats_ambiguous_stem() {
        let mut rows = rows_from_images(vec!["a.jpg".into(), "a.png".into()]);
        let records = vec![TableRecord { image: "a.png".into(), prompt: Some("PNG".into()), ..Default::default() }];
        assert!(apply_table(&mut rows, &records, None).is_empty());
        assert_eq!(rows[0].prompt, "");
        assert_eq!(rows[1].prompt, "PNG");
        let records = vec![TableRecord { image: "a".into(), prompt: Some("ambiguous".into()), ..Default::default() }];
        assert_eq!(apply_table(&mut rows, &records, None), vec!["a"]);
        assert_eq!(rows[1].prompt, "PNG");
    }

    #[test]
    fn review_unique_dotted_stem_matches_without_image_extension() {
        let mut rows = rows_from_images(vec!["a.v1.png".into()]);
        let rec = TableRecord { image: " A.V1 ".into(), prompt: Some("dotted stem".into()), ..Default::default() };
        assert!(apply_table(&mut rows, &[rec], None).is_empty());
        assert_eq!(rows[0].prompt, "dotted stem");
    }

    #[test]
    fn review_exact_filename_wins_over_another_images_dotted_stem() {
        let mut rows = rows_from_images(vec!["a.png.jpg".into(), "a.png".into()]);
        let rec = TableRecord { image: "A.PNG".into(), prompt: Some("exact".into()), ..Default::default() };
        assert!(apply_table(&mut rows, &[rec], None).is_empty());
        assert_eq!(rows[0].prompt, "");
        assert_eq!(rows[1].prompt, "exact");
    }

    #[test]
    fn review_ambiguous_dotted_stem_does_not_mutate_either_row() {
        let mut rows = rows_from_images(vec!["a.v1.jpg".into(), "a.v1.png".into()]);
        let rec = TableRecord { image: "A.V1".into(), prompt: Some("ambiguous".into()), ..Default::default() };
        assert_eq!(apply_table(&mut rows, &[rec], None), vec!["A.V1"]);
        assert!(rows.iter().all(|r| r.prompt.is_empty()));
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
        let n = paste_prompts(&mut rows, 2, "  một \n\n hai \n ba \n");
        assert_eq!(n, 2);
        assert_eq!(rows[0].prompt, "");
        assert_eq!(rows[1].prompt, "một");
        assert_eq!(rows[2].prompt, "hai");
    }

    #[test]
    fn csv_with_bom_and_vietnamese_headers() {
        let tmp = tempfile::tempdir().unwrap();
        let f = tmp.path().join("ds.csv");
        fs::write(&f, "\u{feff}Ảnh,Prompt,Chữ,Nhạc\nA.JPG,mèo đi dạo,Tập 1,bai1.mp3\n,bỏ qua,,\nb,chó chạy,,\n").unwrap();
        let recs = parse_table(&f).unwrap();
        assert_eq!(recs.len(), 2);
        assert_eq!(recs[0], TableRecord { image: "A.JPG".into(), prompt: Some("mèo đi dạo".into()), text: Some("Tập 1".into()), music: Some("bai1.mp3".into()) });
        assert_eq!(recs[1].text, None);
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
        assert_eq!(recs, vec![TableRecord { image: "a.jpg".into(), prompt: Some("một con cáo".into()), text: None, music: None }]);
    }

    #[test]
    fn apply_matches_by_name_or_stem_and_reports_unmatched() {
        let mut rows = rows_from_images(vec!["C:/i/A.jpg".into(), "C:/i/b.png".into()]);
        let recs = vec![
            TableRecord { image: "a.JPG".into(), prompt: Some("p1".into()), text: None, music: Some("x.mp3".into()) },
            TableRecord { image: "b".into(), prompt: None, text: Some("t2".into()), music: None },
            TableRecord { image: "zzz.jpg".into(), prompt: Some("?".into()), text: None, music: None },
        ];
        let unmatched = apply_table(&mut rows, &recs, Some(Path::new("C:/nhac")));
        assert_eq!(unmatched, vec!["zzz.jpg".to_string()]);
        assert_eq!(rows[0].prompt, "p1");
        assert_eq!(rows[0].music, Some(PathBuf::from("C:/nhac").join("x.mp3")));
        assert_eq!(rows[1].text, "t2");
    }

    #[test]
    fn paste_texts_fills_from_start_row() {
        let mut rows = rows_from_images(vec!["1.png".into(), "2.png".into(), "3.png".into()]);
        assert_eq!(paste_texts(&mut rows, 2, "Hai\n\n  Ba  \nBốn"), 2);
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
            vec!["Thừa".into(), "".into()],
        ];
        let recs = records_from_grid(grid).unwrap();
        let mut rows = rows_from_images(vec!["1.png".into(), "2.png".into(), "3.png".into()]);
        rows[1].text = "giữ nguyên".into();
        let unmatched = apply_table(&mut rows, &recs, Some(Path::new("D:/m")));
        assert_eq!(rows[0].text, "Một");
        assert_eq!(rows[0].music, Some(PathBuf::from("D:/m").join("a.mp3")));
        assert_eq!(rows[1].text, "giữ nguyên", "blank cells never erase");
        assert_eq!(rows[2].text, "Ba");
        assert_eq!(unmatched, vec!["dòng 5 (không có video thứ 4)".to_string()]);
    }

    #[test]
    fn table_needs_a_data_column() {
        let err = records_from_grid(vec![vec!["ghi chú".to_string()], vec!["x".into()]]).unwrap_err();
        assert!(err.to_string().contains("ít nhất một cột prompt, text hoặc nhac"), "{err}");
    }

    #[test]
    fn shipped_samples_import_as_documented() {
        let samples = Path::new(env!("CARGO_MANIFEST_DIR")).join("../samples");
        let by_name = parse_table(&samples.join("mau-nhap-theo-ten-anh.xlsx")).unwrap();
        assert_eq!(by_name.len(), 3);
        assert_eq!(by_name[0], TableRecord { image: "01_thuyen-buom.png".into(), prompt: Some("the sailboat drifts gently on the waves at sunset, water sparkles".into()), text: Some("Tập 1".into()), music: Some("nhac-1.mp3".into()) });
        assert_eq!(by_name[1].music, None, "blank music cell stays blank");
        assert_eq!(parse_table(&samples.join("mau-nhap-theo-ten-anh.csv")).unwrap(), by_name);
        let by_order = parse_table(&samples.join("mau-nhap-theo-thu-tu.xlsx")).unwrap();
        assert_eq!(by_order.len(), 3);
        assert!(by_order.iter().all(|r| r.image.is_empty()), "no anh column: matched by order");
        let mut rows = rows_from_images(vec!["a.png".into(), "b.png".into(), "c.png".into()]);
        assert!(apply_table(&mut rows, &by_order, None).is_empty());
        assert_eq!(rows.iter().map(|r| r.text.as_str()).collect::<Vec<_>>(), ["Tập 1", "Tập 2", "Tập 3"]);
    }
}
