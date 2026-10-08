# Two-step UI, batch text/music, 9:16 preview — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the tool into "1. Tạo video" (generate raw videos only) and "2. Hậu kỳ" (text + music, export any number of times), add batch text/music tools, fix the distorted 9:16 preview, and make the GUI compact.

**Architecture:** Backend gains a terminal `Generated` row state and a `gen.autoPostProcess` flag; export reuses `reprocess_rows`. Batch tools are pure functions in `import.rs`/`music.rs` behind scoped Tauri commands. Frontend replaces the Nguồn/Preset/Chạy tabs with `GenerateTab` and `PostTab`, sharing one per-project `PresetStore` (the debounce/flush/scope logic moved out of `PresetTab`).

**Tech Stack:** Tauri 2, Rust (tokio, serde, calamine, natord), Svelte 5 runes, Vitest 2 + happy-dom.

**Spec:** `docs/superpowers/specs/2026-10-09-two-step-ui-design.md`

## Global Constraints

- User-facing text is Vietnamese.
- Branch `feat/video-tool`; commit locally after each task; never push or merge.
- TDD: write the failing test, watch it fail, then implement. Never delete or weaken a regression test to get green; port tests whose UI moved and keep their meaning.
- Never hold a std `Mutex` guard across `.await`.
- Do not modify the Chrome extension. No live Veo generation in this plan.
- Code blocks preceded by a `**File:** <path>` line can be copied with `python -I scripts/extract-plan-block.py <plan> "<marker>" <out>`.
- Verification commands:
  - Rust: `cd src-tauri && cargo test`.
  - UI: `npm test && npm run build && npx tsc --noEmit`.
  - Extension: `npm run test:ext`.

## Review Focus

1. **Old projects**: `project.json` without `autoPostProcess` and with `Done` rows must open. Done rows stay Done and remain exportable.
2. **Export flush**: Export right after editing a style, aspect ratio or font size must use the new values, both the flushed preset and an unsaved per-row override. The overlay PNG size must match the video.
3. **Preview without video**: a `Generated` row whose raw file was deleted must not break the preview, which falls back to the image. On reopen the row goes back to Pending.
4. **Missing music folder**: "Gán nhạc lần lượt" with no music folder or an empty one shows an error and changes nothing.
5. **Excel by order with more rows than videos**: report the extra data rows, fill the rest. A blank cell never erases existing text.

---

### Task 1: Backend — `Generated` state and `autoPostProcess`

**Files:**
- Modify: `src-tauri/src/model.rs` (GenSettings, RowStatus)
- Modify: `src-tauri/src/runner.rs` (`on_raw_ready`, `reprocess`, `recover_after_load`, tests)
- Modify: `src-tauri/src/engine.rs` (`claim_locked` eligibility)
- Modify: `src-tauri/src/engine_tests.rs` (claim test)
- Modify: `src-tauri/tests/e2e.rs` (batch test turns auto on; new generated-export test)

**Interfaces:**
- Produces:
  - `RowStatus::Generated`, serialized as JSON `{"state":"generated"}`.
  - `GenSettings.auto_post_process: bool`, serialized as JSON `autoPostProcess`, default `false`.
  - `Runner::reprocess` accepts `Generated` rows.

- [ ] **Step 1: Write failing runner tests** (append inside `mod tests` in `runner.rs`)

**File:** runner tests (Task 1)
```rust
    #[test]
    fn raw_ready_without_auto_ends_generated() {
        let (mut r, _job) = started(1);
        let fx = r.on_raw_ready(1, Ok("C:/i/_1click/raw/001.mp4".into()));
        assert_eq!(status(&r, 1), RowStatus::Generated);
        assert!(!fx.contains(&Effect::PostProcess(1)));
        assert!(fx.contains(&Effect::Save));
        assert!(!r.running, "only generated rows left: not running");
    }

    #[test]
    fn raw_ready_with_auto_post_processes() {
        let (mut r, _job) = started(1);
        r.project.preset.gen.auto_post_process = true;
        let fx = r.on_raw_ready(1, Ok("raw".into()));
        assert_eq!(status(&r, 1), RowStatus::Downloaded);
        assert!(fx.contains(&Effect::PostProcess(1)));
    }

    #[test]
    fn reprocess_exports_generated_rows() {
        let mut r = runner(2);
        r.project.rows[0].status = RowStatus::Generated;
        r.project.rows[0].raw_video = Some("raw1".into());
        let fx = r.reprocess(&[1, 2]);
        assert!(fx.contains(&Effect::PostProcess(1)));
        assert!(!fx.contains(&Effect::PostProcess(2)), "row 2 has no raw video");
    }

    #[test]
    fn recover_keeps_generated_and_resets_missing_raw() {
        let tmp = tempfile::tempdir().unwrap();
        let raw = tmp.path().join("001.mp4");
        std::fs::write(&raw, b"x").unwrap();
        let mut r = runner(2);
        r.project.rows[0].status = RowStatus::Generated;
        r.project.rows[0].raw_video = Some(raw);
        r.project.rows[1].status = RowStatus::Generated;
        r.project.rows[1].raw_video = Some(tmp.path().join("gone.mp4"));
        let fx = r.recover_after_load();
        assert!(!fx.iter().any(|f| matches!(f, Effect::PostProcess(_))));
        assert_eq!(status(&r, 1), RowStatus::Generated);
        assert_eq!(status(&r, 2), RowStatus::Pending);
        assert_eq!(r.project.rows[1].raw_video, None);
        assert!(!r.running);
    }

    #[test]
    fn stop_leaves_generated_rows_alone() {
        let mut r = runner(1);
        r.project.rows[0].status = RowStatus::Generated;
        r.project.rows[0].raw_video = Some("raw".into());
        r.pause();
        assert_eq!(status(&r, 1), RowStatus::Generated);
    }

    #[test]
    fn old_project_json_defaults_auto_post_process_off() {
        let p: crate::model::Project = serde_json::from_str(r#"{"version":1,"imageDir":"C:/i","rows":[{"stt":1,"imagePath":"C:/i/a.png","status":{"state":"done"},"rawVideo":"C:/i/_1click/raw/001.mp4"}],"preset":{"gen":{"mode":"imageToVideo","aspectRatio":"16:9","quality":"720p","concurrency":3,"maxRetries":0}}}"#).unwrap();
        assert!(!p.preset.gen.auto_post_process);
        assert_eq!(p.rows[0].status, RowStatus::Done);
        let json = serde_json::to_value(RowStatus::Generated).unwrap();
        assert_eq!(json, serde_json::json!({"state": "generated"}));
    }
```

- [ ] **Step 2: Run, expect compile failure** — `cd src-tauri && cargo test --lib runner::` → FAIL: `no variant Generated`, `no field auto_post_process`.

- [ ] **Step 3: Implement the model change.** In `model.rs`:
  - add `pub auto_post_process: bool,` after `max_retries` in `GenSettings`;
  - add `auto_post_process: false` to `GenSettings::default()`;
  - add `Generated,` after `Downloaded,` in `RowStatus`, with doc comment `/// Raw video saved; waiting for the user's export (step 2).`.

  Check whether `Project` has a container-level `#[serde(default)]` for `preset`/`common_prompt`. If the old-project test fails on a missing field, add `#[serde(default)]` on those fields only.

- [ ] **Step 4: Implement runner changes** in `runner.rs`.

**File:** runner on_raw_ready (Task 1)
```rust
    pub fn on_raw_ready(&mut self, stt: u32, result: Result<PathBuf, String>) -> Vec<Effect> {
        self.importing.remove(&stt);
        let auto = self.project.preset.gen.auto_post_process;
        let Some(r) = self.project.row_mut(stt) else { return vec![] };
        let fx = match result {
            Ok(p) => {
                r.raw_video = Some(p);
                self.failure_streak = 0;
                if auto {
                    r.status = RowStatus::Downloaded;
                    vec![Effect::PostProcess(stt), Effect::Save, Effect::Changed]
                } else {
                    r.status = RowStatus::Generated;
                    vec![Effect::Save, Effect::Changed]
                }
            }
            Err(e) => {
                r.status = RowStatus::Failed { stage: Stage::Download, message: e };
                vec![Effect::Save, Effect::Changed]
            }
        };
        self.refresh_running();
        fx
    }
```
  - In `reprocess`, change the status filter to `RowStatus::Done | RowStatus::Downloaded | RowStatus::Generated | RowStatus::Failed { stage: Stage::PostProcess, .. }`.
  - In `recover_after_load`, add this branch inside the loop, before the existing `if`:

**File:** runner recover generated (Task 1)
```rust
            if r.status == RowStatus::Generated && !r.raw_video.as_ref().is_some_and(|p| p.exists()) {
                r.status = RowStatus::Pending;
                r.raw_video = None;
                continue;
            }
```

- [ ] **Step 5: Run runner tests** — `cargo test --lib runner::` → PASS.

  Existing tests that call `on_raw_ready` and expect `PostProcess` now fail: `recover_after_load_requeues_postprocessing`, and the duplicate-download and job-status tests if they assert `PostProcess`.
  - Fix them by setting `r.project.preset.gen.auto_post_process = true` right after `started(..)`, which keeps their original meaning (they test the auto pipeline).
  - Ledger: `Task 1: Ruling: auto-pipeline runner tests now enable autoPostProcess explicitly — default changed to off by spec §3 — cost if wrong: none`.

- [ ] **Step 6: Failing engine claim test** — append to `engine_tests.rs`, after reading how its existing tests build an engine (helper names there).

  The test:
  - opens a project whose row 1 is `Generated` with `raw_video` pointing at a real temp file;
  - calls `engine.reprocess(&[1]).await`;
  - waits until row 1 is `PostProcessing`, `Done` or `Failed{PostProcess}`, so it was claimed;
  - asserts the row is not still `Generated`.

  Name it `generated_rows_are_claimed_for_export`. Without ffmpeg configured, a `Failed{PostProcess}` result still proves the claim. Run it → FAIL (row stays `Generated`).

- [ ] **Step 7: Implement claim eligibility** — in `engine.rs` `claim_locked`, change the postprocess `matches!` to include `RowStatus::Generated`. Run `cargo test --lib` → PASS.

- [ ] **Step 8: e2e.** In `tests/e2e.rs`:
  - in `batch_runs_end_to_end`, add `p.preset.gen.auto_post_process = true;` inside the `engine.edit` closure;
  - add a test that copies `review_no_music_honors_original_mute`, named `generated_row_exports_on_reprocess`. Its row is `RowStatus::Generated` with the tone raw video and default volumes, and it asserts the output file exists and the status is `Done`.

  Run `cargo test` → all PASS.

- [ ] **Step 9: Commit**
```bash
git add src-tauri && git commit -m "feat: Generated state and autoPostProcess so generation stops before export"
```

### Task 2: Backend — batch text, music in order, Excel by order

**Files:**
- Modify: `src-tauri/src/import.rs` (paste_texts, apply_text_template, by-order table)
- Modify: `src-tauri/src/music.rs` (assign_in_order)
- Modify: `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs` (3 new commands)
- Modify: `docs/superpowers/specs/2026-10-09-two-step-ui-design.md` §4 last bullet (see ruling)

**Interfaces:**
- Produces (Tauri, camelCase args):
  - `paste_texts(startStt, text, imageDir) -> usize`;
  - `apply_text_template(template, stts, imageDir) -> usize`;
  - `assign_music_in_order(stts, imageDir) -> usize`;
  - `import_table(path) -> Vec<String>`, now also accepting tables without an `anh` column.

- [ ] **Step 1: Failing tests** (append to `import.rs` tests and `music.rs` tests; create `#[cfg(test)] mod tests` in `music.rs` if absent)

**File:** import tests (Task 2)
```rust
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
```

**File:** music tests (Task 2)
```rust
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
```

- [ ] **Step 2: Run** `cargo test --lib import:: music::` → FAIL (functions not defined).

- [ ] **Step 3: Implement** in `import.rs`: replace `paste_prompts` with a shared helper, and add the template function and the by-order table.

**File:** import batch fns (Task 2)
```rust
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
```
  - In `records_from_grid`:
    - make the image column optional: `let img = column(...);`.
    - When `img` is `None`, require `prompt.or(text).or(music).is_some()`, else `bail!("Bảng cần ít nhất một cột prompt, text hoặc nhac")`, and keep **every** data row, using `image: String::new()`.
    - When `img` is `Some`, keep the old `filter_map` behaviour, which skips rows without an image name.
  - In `apply_table`:
    - iterate with `enumerate()`;
    - when `rec.image.is_empty()`, target `rows.get_mut(i)` (rows are in STT order); if there is none, push `format!("dòng {} (không có video thứ {})", i + 2, i + 1)`;
    - otherwise keep the name matching.
  - Update the doc comments.

- [ ] **Step 4: Implement** in `music.rs`:

**File:** music assign_in_order (Task 2)
```rust
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
```

- [ ] **Step 5: Commands** — add to `commands.rs` and register them in `lib.rs` `generate_handler!`.

**File:** batch commands (Task 2)
```rust
#[tauri::command]
pub fn paste_texts(engine: Eng, start_stt: u32, text: String, image_dir: String) -> Result<usize, String> {
    let mut n = 0;
    engine.edit_scoped(Path::new(&image_dir), |p| n = import::paste_texts(&mut p.rows, start_stt, &text))?;
    Ok(n)
}

#[tauri::command]
pub fn apply_text_template(engine: Eng, template: String, stts: Vec<u32>, image_dir: String) -> Result<usize, String> {
    let mut n = 0;
    engine.edit_scoped(Path::new(&image_dir), |p| n = import::apply_text_template(&mut p.rows, &template, &stts))?;
    Ok(n)
}

#[tauri::command]
pub fn assign_music_in_order(engine: Eng, stts: Vec<u32>, image_dir: String) -> Result<usize, String> {
    let tracks = crate::music::list_tracks(engine.project().ok_or("Chưa mở dự án")?.preset.music.folder.as_deref());
    if tracks.is_empty() {
        return Err("Chưa có file nhạc trong folder nhạc".into());
    }
    let mut res = Ok(0);
    engine.edit_scoped(Path::new(&image_dir), |p| res = crate::music::assign_in_order(&mut p.rows, &tracks, &stts))?;
    res
}
```

- [ ] **Step 6: Spec correction.** Spec §4 says batch edits are rejected while rows run "giống update_row", but `update_row` does not reject them. Editing text or music of a running row is harmless, because overlays and music are resolved at export.
  - Edit the spec bullet to: "giống `update_row`: không chặn khi dòng đang chạy; thay đổi có hiệu lực ở lần xuất sau".
  - Ledger: `Task 2: Ruling: batch edits are not blocked during runs (matches update_row; spec §4 corrected) — cost if wrong: a text edit lands mid-export and shows only on the next export`.

- [ ] **Step 7: Run** `cargo test` → all PASS (the old table tests still pass, since `anh` tables are unchanged).

- [ ] **Step 8: Commit**
```bash
git add src-tauri docs/superpowers/specs && git commit -m "feat: batch text, template, music in order and Excel by order"
```

### Task 3: Frontend foundation — types, API, PresetStore

**Files:**
- Modify: `src/lib/types.ts`, `src/lib/api.ts`, `src/lib/textLayout.ts` (statusLabel)
- Create: `src/lib/presetStore.svelte.ts`, `src/lib/presetStore.test.ts`
- Create: `src/lib/exportOverlays.ts`
- Modify: every test fixture that builds `gen` (add `autoPostProcess: false`)

**Interfaces:**
- Produces:
  - `class PresetStore { preset: Preset; name: string; presets: string[]; readonly imageDir: string; flush(): Promise<void>; save(name: string): Promise<void>; load(name: string): Promise<void>; destroy(): void }`;
  - `renderOverlays(project: Project, stts: number[]): Promise<void>` in `exportOverlays.ts`;
  - `api.pasteTexts(startStt, text, imageDir)`, `api.applyTextTemplate(template, stts, imageDir)`, `api.assignMusicInOrder(stts, imageDir)`;
  - `statusLabel({state:"generated"}) === "Đã tạo"`.

- [ ] **Step 1: Types and API.**
  - `types.ts`:
    - add `autoPostProcess: boolean` to `GenSettings`;
    - add `| { state: "generated" }` to `RowStatus`.
  - `api.ts`, add:

**File:** api additions (Task 3)
```ts
  pasteTexts: (startStt: number, text: string, imageDir: string) => invoke<number>("paste_texts", { startStt, text, imageDir }),
  applyTextTemplate: (template: string, stts: number[], imageDir: string) => invoke<number>("apply_text_template", { template, stts, imageDir }),
  assignMusicInOrder: (stts: number[], imageDir: string) => invoke<number>("assign_music_in_order", { stts, imageDir }),
```
  - `textLayout.ts` `statusLabel`: add `case "generated": return "Đã tạo";`.
  - Add `generated` to the `textLayout.test.ts` status assertions if that file tests labels. Otherwise add `expect(statusLabel({ state: "generated" })).toBe("Đã tạo")` to it.
  - Run `npx vitest run src/lib/textLayout.test.ts`: it should FAIL before the label is added and PASS after.

- [ ] **Step 2: Failing PresetStore tests.** These are the store-level guarantees ported from `PresetTab.test.ts`, with the same meaning:

**File:** src/lib/presetStore.test.ts (Task 3)
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync, tick } from "svelte";
import { PresetStore } from "./presetStore.svelte";
import type { Project } from "./types";

const boundary = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: boundary.invoke, convertFileSrc: (p: string) => p }));
vi.mock("@tauri-apps/api/event", () => ({ listen: async () => () => {} }));

export function fixture(dir = "A"): Project {
  return { version: 1, imageDir: dir, commonPrompt: "", preset: {
    gen: { mode: "imageToVideo", aspectRatio: "16:9", quality: "720p", concurrency: 3, maxRetries: 0, autoPostProcess: false },
    text: { fontFamily: "Arial", fontFile: null, fontSize: 50, bold: false, color: "#ffffff", strokeColor: "#000000", strokeWidth: 0, shadow: false, boxEnabled: false, boxColor: "#000000", boxOpacity: 0, boxRadius: 0, boxPadding: 0, align: "center", maxWidth: .8, x: .5, y: .5 },
    music: { folder: null, mode: "random", fallback: "random", musicVolume: .25, originalVolume: 1, fadeIn: 1, fadeOut: 1 },
    output: { folder: null, overwrite: false },
  }, rows: [] };
}
const deferred = <T = void>() => { let resolve!: (v: T) => void; const promise = new Promise<T>((y) => { resolve = y; }); return { promise, resolve }; };
let writes: { type: string; args: any }[], toasts: string[], store: PresetStore | null, active: string;
async function settle() { for (let i = 0; i < 20; i++) { await tick(); await Promise.resolve(); } }
const make = () => (store = new PresetStore(fixture("A"), (t) => toasts.push(t)));
function edit(quality: "720p" | "1080p") { store!.preset.gen.quality = quality; flushSync(); }

beforeEach(() => {
  vi.useFakeTimers(); writes = []; toasts = []; store = null; active = "A";
  boundary.invoke.mockReset().mockImplementation(async (type: string, args: any) => {
    if (["set_preset", "save_preset", "load_preset"].includes(type) && args.imageDir !== active) throw new Error("Dự án đã thay đổi");
    if (["set_preset", "save_preset", "load_preset"].includes(type)) writes.push({ type, args: structuredClone(args) });
    if (type === "list_presets") return ["First", "Second"];
    if (type === "load_preset") { const p = fixture().preset; p.gen.quality = args.name === "Second" ? "1080p" : "720p"; return p; }
  });
});
afterEach(() => { store?.destroy(); vi.useRealTimers(); });

describe("PresetStore", () => {
  it("debounces an edit into one scoped write", async () => {
    make(); edit("1080p"); await vi.advanceTimersByTimeAsync(400); await settle();
    expect(writes).toEqual([{ type: "set_preset", args: { preset: expect.objectContaining({ gen: expect.objectContaining({ quality: "1080p" }) }), imageDir: "A" } }]);
  });
  it("flushes 1080p before an immediate named Save", async () => {
    make(); edit("1080p"); await store!.save("Test"); await settle();
    expect(writes.map((w) => w.type)).toEqual(["set_preset", "save_preset"]);
    expect(writes[0].args.preset.gen.quality).toBe("1080p"); expect(toasts).toContain("Đã lưu preset");
  });
  it.each(["set_preset", "save_preset"])("does not announce success when %s fails", async (failed) => {
    const original = boundary.invoke.getMockImplementation()!;
    boundary.invoke.mockImplementation((type: string, args: any) => type === failed ? Promise.reject(new Error("disk failed")) : original(type, args));
    make(); edit("1080p"); await store!.save("Test"); await settle();
    expect(toasts).not.toContain("Đã lưu preset"); expect(toasts.some((t) => t.includes("disk failed"))).toBe(true);
  });
  it("leaves no write timer after destroy", async () => {
    make(); edit("1080p"); store!.destroy(); store = null;
    await vi.advanceTimersByTimeAsync(400); expect(writes).toEqual([]);
  });
  it("flushes local edits before loading and never writes an older snapshot after load", async () => {
    make(); edit("1080p"); await store!.load("First"); await vi.advanceTimersByTimeAsync(400); await settle();
    expect(writes.map((w) => w.type)).toEqual(["set_preset", "load_preset"]);
    expect(writes[0].args.preset.gen.quality).toBe("1080p"); expect(store!.preset.gen.quality).toBe("720p");
  });
  it("serializes a pending autosave before a newer immediate Save", async () => {
    const gate = deferred(); const original = boundary.invoke.getMockImplementation()!; let calls = 0;
    boundary.invoke.mockImplementation(async (type: string, args: any) => { if (type === "set_preset" && ++calls === 1) await gate.promise; return original(type, args); });
    make(); edit("1080p"); await vi.advanceTimersByTimeAsync(400); edit("720p");
    const saving = store!.save("Test"); await settle(); expect(writes).toEqual([]);
    gate.resolve(); await saving; await settle();
    expect(writes.map((w) => w.type)).toEqual(["set_preset", "set_preset", "save_preset"]);
    expect(writes[1].args.preset.gen.quality).toBe("720p");
  });
  it("orders two pending loads and does not restore a pre-load edit between them", async () => {
    const gate = deferred(); const original = boundary.invoke.getMockImplementation()!; let loads = 0;
    boundary.invoke.mockImplementation(async (type: string, args: any) => { if (type === "load_preset" && ++loads === 1) await gate.promise; return original(type, args); });
    make(); edit("1080p"); const a = store!.load("First"); const b = store!.load("Second"); await settle();
    gate.resolve(); await a; await b; await vi.advanceTimersByTimeAsync(400); await settle();
    expect(writes.map((w) => w.type)).toEqual(["set_preset", "load_preset", "load_preset"]);
    expect(store!.name).toBe("Second"); expect(store!.preset.gen.quality).toBe("1080p");
  });
  it("discards a queued load after destroy without a backend call", async () => {
    const gate = deferred(); const original = boundary.invoke.getMockImplementation()!;
    boundary.invoke.mockImplementation(async (type: string, args: any) => { if (type === "set_preset") await gate.promise; return original(type, args); });
    make(); edit("1080p"); await vi.advanceTimersByTimeAsync(400); const load = store!.load("First");
    store!.destroy(); store = null; gate.resolve(); await load; await settle();
    expect(writes.map((w) => w.type)).toEqual(["set_preset"]); expect(toasts).toEqual([]);
  });
  it("flush writes an edit made while the first write is pending", async () => {
    const gate = deferred(); const original = boundary.invoke.getMockImplementation()!; let calls = 0;
    boundary.invoke.mockImplementation(async (type: string, args: any) => { if (type === "set_preset" && ++calls === 1) await gate.promise; return original(type, args); });
    make(); edit("1080p"); const f = store!.flush(); await settle(); edit("720p"); gate.resolve(); await f; await settle();
    expect(writes.map((w) => w.args.preset.gen.quality)).toEqual(["1080p", "720p"]);
  });
});
```

- [ ] **Step 3: Run** `npx vitest run src/lib/presetStore.test.ts` → FAIL (module missing).

- [ ] **Step 4: Implement PresetStore.** The logic is moved verbatim from `PresetTab.svelte`; only the debounce effect is wrapped in `$effect.root`.

**File:** src/lib/presetStore.svelte.ts (Task 3)
```ts
import { tick } from "svelte";
import { api } from "./api";
import type { Preset, Project } from "./types";

/**
 * The open project's preset as edited in the UI. Edits are debounced into ordered writes scoped
 * to this project's folder; flush() waits until the backend holds exactly what the UI shows.
 */
export class PresetStore {
  preset = $state() as Preset;
  name = $state("");
  presets: string[] = $state([]);
  readonly imageDir: string;
  #toast: (t: string) => void;
  #live = true;
  #queue: Promise<void> = Promise.resolve();
  #lastWritten: string;
  #observed: string;
  #loadRevision = 0;
  #loading = false;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #stop: () => void;

  constructor(project: Project, toast: (t: string) => void) {
    this.imageDir = project.imageDir;
    this.#toast = toast;
    this.preset = structuredClone($state.snapshot(project.preset)) as Preset;
    this.#lastWritten = this.#observed = JSON.stringify(this.preset);
    this.#stop = $effect.root(() => {
      $effect(() => {
        const snap = $state.snapshot(this.preset) as Preset;
        const json = JSON.stringify(snap);
        if (json === this.#observed) return;
        this.#observed = json;
        clearTimeout(this.#timer);
        this.#timer = setTimeout(() => this.#enqueue(() => this.#write(snap)).catch((e) => this.#toast(String(e))), 400);
      });
    });
    api.listPresets().then((p) => { if (this.#live) this.presets = p; }).catch((e) => toast(String(e)));
  }

  destroy() {
    this.#live = false;
    clearTimeout(this.#timer);
    this.#loadRevision++;
    this.#stop();
  }

  #enqueue(work: () => Promise<void>) {
    const result = this.#queue.then(async () => {
      if (!this.#live) throw new Error("Dự án đã thay đổi");
      await work();
    });
    // Failed writes remain dirty and are retried by the next explicit flush.
    this.#queue = result.catch(() => {});
    return result;
  }

  async #write(snap: Preset) {
    const json = JSON.stringify(snap);
    if (json === this.#lastWritten) return;
    await api.setPreset(snap, this.imageDir);
    this.#lastWritten = json;
  }

  async flush(): Promise<void> {
    do {
      await tick();
      clearTimeout(this.#timer);
      if (this.#loading) await this.#queue;
      const snap = $state.snapshot(this.preset) as Preset;
      await this.#enqueue(() => this.#write(snap));
      await tick();
    } while (JSON.stringify($state.snapshot(this.preset)) !== this.#lastWritten);
    clearTimeout(this.#timer);
  }

  async save(name: string) {
    if (!name.trim()) return this.#toast("Nhập tên preset");
    await tick();
    clearTimeout(this.#timer);
    if (this.#loading) await this.#queue;
    const snap = $state.snapshot(this.preset) as Preset;
    try {
      await this.#enqueue(async () => {
        await this.#write(snap);
        if (!this.#live) throw new Error("Dự án đã thay đổi");
        await api.savePreset(name, this.imageDir);
      });
      if (!this.#live) return;
      this.name = name;
      this.#toast("Đã lưu preset");
      this.presets = await api.listPresets();
    } catch (e) { if (this.#live) this.#toast(String(e)); }
  }

  async load(name: string) {
    await tick();
    clearTimeout(this.#timer);
    const snap = $state.snapshot(this.preset) as Preset;
    const flushLocal = !this.#loading;
    const revision = ++this.#loadRevision;
    this.#loading = true;
    try {
      await this.#enqueue(async () => {
        // A second queued load must not restore the pre-load local snapshot.
        if (flushLocal) await this.#write(snap);
        if (!this.#live) throw new Error("Dự án đã thay đổi");
        const loaded = await api.loadPreset(name, this.imageDir);
        if (!this.#live || revision !== this.#loadRevision) return;
        this.#lastWritten = this.#observed = JSON.stringify(loaded);
        this.preset = loaded;
        this.name = name;
      });
    } catch (e) { if (this.#live) this.#toast(String(e)); }
    finally { if (revision === this.#loadRevision) this.#loading = false; }
  }
}
```

**File:** src/lib/exportOverlays.ts (Task 3)
```ts
import { api } from "./api";
import { renderOverlayPng } from "./overlay";
import { resolutionFor } from "./textLayout";
import type { Project } from "./types";

/** Renders each row's text overlay at the video's size from a durable project snapshot. */
export async function renderOverlays(project: Project, stts: number[]) {
  const { w, h } = resolutionFor(project.preset.gen);
  const items = [];
  for (const row of project.rows.filter((r) => stts.includes(r.stt))) {
    items.push({ stt: row.stt, pngBase64: await renderOverlayPng(row.textOverride ?? project.preset.text, row.text, w, h) });
  }
  await api.saveOverlays(items);
}
```

- [ ] **Step 5: Run** `npx vitest run src/lib` → PASS. Add `autoPostProcess: false` to the gen fixtures in the existing test files (`RunTab.test.ts`, `SourceTab.test.ts`, `PresetTab.test.ts`, `TextPreview.test.ts` if present), then run `npm test && npx tsc --noEmit` → PASS.

- [ ] **Step 6: Commit**
```bash
git add src && git commit -m "feat: PresetStore, export overlay helper and Generated label"
```

### Task 4: TextPreview — correct aspect ratio and video background

**Files:**
- Modify: `src/components/TextPreview.svelte`
- Modify: `src/components/TextPreview.test.ts`

**Interfaces:**
- Produces: `TextPreview` props `{ style (bindable), text, w, h, imagePath?: string|null, videoPath?: string|null, maxHeight?: string = "55vh" }`.

- [ ] **Step 1: Failing tests** (append to `TextPreview.test.ts`; reuse its mount helper and props helper)

**File:** TextPreview tests (Task 4)
```ts
describe("frame sizing and background", () => {
  it("keeps a 9:16 frame narrow enough for its height instead of stretching to full width", async () => {
    const t = document.createElement("div"); document.body.append(t);
    const c = mount(TextPreview, { target: t, props: { style: baseStyle(), text: "A", w: 720, h: 1280, maxHeight: "55vh" } });
    await tick();
    const frame = t.querySelector<HTMLDivElement>(".frame")!;
    expect(frame.getAttribute("style")).toContain("aspect-ratio: 720 / 1280");
    expect(frame.getAttribute("style")).toContain("width: min(100%, calc(55vh * 720 / 1280))");
    unmount(c); t.remove();
  });
  it("plays the raw video behind the text when one exists", async () => {
    const t = document.createElement("div"); document.body.append(t);
    const c = mount(TextPreview, { target: t, props: { style: baseStyle(), text: "A", w: 1280, h: 720, imagePath: "A/1.png", videoPath: "A/_1click/raw/001.mp4" } });
    await tick();
    const video = t.querySelector("video")!;
    expect(video.getAttribute("src")).toBe("A/_1click/raw/001.mp4");
    expect(video.muted).toBe(true);
    video.dispatchEvent(new Event("error")); await tick();
    expect(t.querySelector("video")).toBeNull();
    unmount(c); t.remove();
  });
  it("shows only the image when there is no raw video", async () => {
    const t = document.createElement("div"); document.body.append(t);
    const c = mount(TextPreview, { target: t, props: { style: baseStyle(), text: "A", w: 1280, h: 720, imagePath: "A/1.png" } });
    await tick();
    expect(t.querySelector("video")).toBeNull();
    expect(t.querySelector<HTMLDivElement>(".frame")!.getAttribute("style")).toContain("A/1.png");
    unmount(c); t.remove();
  });
});
```
  If `TextPreview.test.ts` has no `baseStyle()` helper, add one that returns the TextStyle fixture used in `presetStore.test.ts`.

- [ ] **Step 2: Run** `npx vitest run src/components/TextPreview.test.ts` → FAIL (no width formula, no video).

- [ ] **Step 3: Implement.** Replace the markup and style of `TextPreview.svelte`, keeping the script's effect and `moveTo` unchanged:

**File:** TextPreview markup (Task 4)
```svelte
<div class="frame" style="aspect-ratio: {w} / {h}; width: min(100%, calc({maxHeight} * {w} / {h})); background-image: {imagePath ? `url('${convertFileSrc(imagePath)}')` : 'none'}">
  {#if videoPath && !videoFailed}
    <video src={convertFileSrc(videoPath)} muted loop autoplay playsinline onerror={() => (videoFailed = true)}></video>
  {/if}
  <canvas bind:this={canvas} width={w} height={h}
    onpointerdown={(e) => { dragging = true; canvas.setPointerCapture(e.pointerId); moveTo(e); }}
    onpointermove={(e) => dragging && moveTo(e)}
    onpointerup={() => (dragging = false)}></canvas>
</div>
<div class="snaps">
  {#each SNAPS as y}{#each SNAPS as x}
    <button title="Hít vị trí" onclick={() => (style = { ...style, x, y })}>·</button>
  {/each}{/each}
</div>

<style>
  .frame { position: relative; margin: 0 auto; background: #222 center/cover no-repeat; border-radius: 8px; overflow: hidden; }
  video, canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  video { object-fit: cover; }
  canvas { cursor: move; }
  .snaps { display: grid; grid-template-columns: repeat(3, 24px); gap: 3px; margin: 6px auto 0; width: max-content; }
  .snaps button { padding: 0; height: 18px; }
</style>
```
  - Props line: `let { style = $bindable(), text, w, h, imagePath = null, videoPath = null, maxHeight = "55vh" }: { style: TextStyle; text: string; w: number; h: number; imagePath?: string | null; videoPath?: string | null; maxHeight?: string } = $props();`.
  - Add `let videoFailed = $state(false);` and `$effect(() => { videoPath; videoFailed = false; });` so a new row retries its video.

- [ ] **Step 4: Run** `npm test` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components && git commit -m "fix: keep the preview frame at its aspect ratio and play the raw video behind it"
```

### Task 5: Step 1 — GenerateTab, GenSettingsBar, App with two steps

**Files:**
- Create: `src/components/GenSettingsBar.svelte`, `src/tabs/GenerateTab.svelte`, `src/tabs/GenerateTab.test.ts`, `src/App.test.ts`
- Modify: `src/App.svelte`
- Delete (after porting their tests): `src/tabs/SourceTab.svelte`, `src/tabs/SourceTab.test.ts`, `src/tabs/RunTab.svelte`, `src/tabs/RunTab.test.ts`
- `src/tabs/reactiveStatus.svelte.ts` stays (used by GenerateTab tests).

**Interfaces:**
- Consumes: `PresetStore`, `renderOverlays`, `api.*`, `statusLabel`.
- Produces:
  - `GenerateTab` props `{ project: Project; store: PresetStore; status: Status; toast; beforeNavigate?: () => Promise<void>; onBusyChange?: (b: boolean) => void }`;
  - `App` header buttons "1. Tạo video" / "2. Hậu kỳ", the preset select (`aria-label="Nạp preset"`), the input placeholder "Tên preset" with button "Lưu", and the connection button `.conn`.

- [ ] **Step 1: Failing GenerateTab tests.** Port the RunTab and SourceTab tests into `src/tabs/GenerateTab.test.ts`, with these renames and changes:
  - "Bắt đầu" → "Bắt đầu tạo", "Thử lại" → "Thử lại", "Dừng" → "Dừng";
  - mount `GenerateTab` with `store: new PresetStore(project, toast)` and destroy it in `afterEach`;
  - `calls()` filters out `list_presets`, `get_project` and `list_music`;
  - the Start expectation becomes `["start_run"]` when `autoPostProcess` is false, and `["save_overlays", "start_run"]` when true. Add both cases.
  
  The "second Start/Retry blocked" test drops "Chỉ hậu kỳ lại", which now lives in step 2, and asserts Start and Retry only.
  
  Add these tests:

**File:** GenerateTab extra tests (Task 5)
```ts
  it("does not render overlays on Start when auto post-processing is off", async () => {
    await mountGen(idle);
    button("Bắt đầu tạo").click(); await settle();
    expect(calls()).toEqual(["start_run"]);
  });
  it("renders overlays first when auto post-processing is on", async () => {
    fixtureProject.preset.gen.autoPostProcess = true;
    await mountGen(idle);
    button("Bắt đầu tạo").click(); await settle();
    expect(calls()).toEqual(["save_overlays", "start_run"]);
  });
  it("saves an inline prompt edit to its own row and project", async () => {
    await mountGen(idle);
    const input = target.querySelector<HTMLInputElement>('tbody tr input[type="text"]')!;
    input.value = "sóng vỗ"; input.dispatchEvent(new Event("change", { bubbles: true })); await settle();
    expect(boundary.invoke).toHaveBeenCalledWith("update_row", { edit: expect.objectContaining({ stt: 1, prompt: "sóng vỗ" }), imageDir: "A" });
  });
  it("counts generated rows and shows Xem for them", async () => {
    fixtureProject.rows[0].status = { state: "generated" }; fixtureProject.rows[0].rawVideo = "A/_1click/raw/001.mp4";
    await mountGen(idle);
    expect(target.textContent).toContain("1/1 đã tạo");
    expect(button("Xem").disabled).toBe(false);
  });
```
  Port the SourceTab paste tests unchanged, except that they mount GenerateTab. The fixture gets the backend mock `get_project` → returns `fixtureProject`.

- [ ] **Step 2: Failing App tests** in `src/App.test.ts`. Port the App-level cases of `PresetTab.test.ts` with their meaning kept. Fixture and mocks as in `PresetTab.test.ts`, with `autoPostProcess: false` and one row with `rawVideo: "A/_1click/raw/001.mp4"` and status `generated`. Helpers:
  - `quality(v)` changes the select that has a `1080p` option, which is now in step 1's GenSettingsBar;
  - `aspect(v)` changes the select with `9:16`;
  - `tab(n)` clicks "1. Tạo video" or "2. Hậu kỳ".

**File:** src/App.test.ts cases (Task 5)
```ts
describe("two-step app keeps ordered, scoped preset edits", () => {
  it("Start waits for the pending preset write and starts with it", async () => {
    const gate = deferred(); const original = boundary.invoke.getMockImplementation()!;
    boundary.invoke.mockImplementation(async (type: string, args: any) => { if (type === "set_preset") await gate.promise; return original(type, args); });
    active.rows[0].status = { state: "pending" }; active.rows[0].rawVideo = null;
    await mountApp(); await quality("1080p"); button("Bắt đầu tạo").click(); await settle();
    expect(writes.some((w) => w.type === "start_run")).toBe(false);
    gate.resolve(); await settle();
    expect(writes.map((w) => w.type)).toEqual(["set_preset", "start_run"]); expect(active.preset.gen.quality).toBe("1080p");
  });
  it("stays on step 1 when the navigation flush fails", async () => {
    await mountApp(); await quality("1080p");
    boundary.invoke.mockRejectedValue(new Error("disk failed")); button("2. Hậu kỳ").click(); await settle();
    expect(target.textContent).toContain("Bắt đầu tạo"); expect(target.textContent).toContain("disk failed");
  });
  it("never writes A's pending edit into project B", async () => {
    await mountApp(); await quality("1080p");
    active = project("B", "prompt B"); boundary.listeners.get("project")!({ payload: active }); await settle();
    await vi.advanceTimersByTimeAsync(400); await settle();
    expect(writes.filter((w) => w.type === "set_preset" && w.args.imageDir !== "A")).toEqual([]);
    expect(active.preset.gen.quality).toBe("720p");
  });
  it("exports with the acknowledged aspect, quality and font size before any project event", async () => {
    const original = boundary.invoke.getMockImplementation()!;
    boundary.invoke.mockImplementation(async (type: string, args: any) => {
      if (type !== "set_preset") return original(type, args);
      writes.push({ type, args }); active.preset = structuredClone(args.preset); // deliberately no project event
    });
    await mountApp(); await quality("1080p"); await aspect("9:16"); button("2. Hậu kỳ").click(); await settle();
    const size = [...target.querySelectorAll<HTMLInputElement>('input[type="number"]')].find((i) => i.min === "12")!;
    size.value = "80"; size.dispatchEvent(new Event("input", { bubbles: true })); await settle();
    button("Xuất tất cả (1)").click(); await settle();
    expect(boundary.render).toHaveBeenCalledWith(expect.objectContaining({ fontSize: 80 }), expect.any(String), 1080, 1920);
    expect(writes.map((w) => w.type)).toEqual(["set_preset", "set_preset", "reprocess_rows"]);
  });
  it("locks the page while the acknowledged project refresh is pending", async () => {
    const gate = deferred<Project>(); const original = boundary.invoke.getMockImplementation()!; let reads = 0;
    boundary.invoke.mockImplementation((type: string, args: any) => type === "get_project" && ++reads === 2 ? gate.promise : original(type, args));
    await mountApp(); await quality("1080p"); button("2. Hậu kỳ").click(); await settle();
    expect(target.querySelector("main")?.hasAttribute("inert")).toBe(true);
    expect(target.textContent).not.toContain("Xuất tất cả");
    gate.resolve(structuredClone(active)); await settle();
    expect(target.textContent).toContain("Xuất tất cả"); expect(active.preset.gen.quality).toBe("1080p");
  });
  it("unlocks B and ignores the stale refresh when the project changes during navigation", async () => {
    const gate = deferred<Project>(); const original = boundary.invoke.getMockImplementation()!; let reads = 0;
    boundary.invoke.mockImplementation((type: string, args: any) => type === "get_project" && ++reads === 2 ? gate.promise : original(type, args));
    await mountApp(); await quality("1080p"); button("2. Hậu kỳ").click(); await settle();
    const stale = structuredClone(active);
    active = project("B", "prompt B"); boundary.listeners.get("project")!({ payload: active }); await settle();
    gate.resolve(stale); await settle();
    expect(target.querySelector("main")?.hasAttribute("inert")).toBe(false);
    const select = [...target.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.value === "1080p"))!;
    expect(select.value).toBe("720p");
  });
  it("blocks steps and folder picking while export overlays are prepared", async () => {
    const gate = deferred<null>(); boundary.render.mockImplementationOnce(() => gate.promise);
    await mountApp(); button("2. Hậu kỳ").click(); await settle();
    button("Xuất tất cả (1)").click(); await settle();
    expect(button("1. Tạo video").disabled).toBe(true);
    button("1. Tạo video").dispatchEvent(new MouseEvent("click", { bubbles: true })); await settle();
    expect(target.textContent).toContain("Xuất tất cả"); expect(writes.some((w) => w.type === "reprocess_rows")).toBe(false);
    gate.resolve(null); await settle();
    expect(writes.map((w) => w.type)).toEqual(["reprocess_rows"]); expect(button("1. Tạo video").disabled).toBe(false);
  });
  it("blocks navigation and Start while an earlier folder-open request is pending", async () => {
    const gate = deferred<Project>(); const original = boundary.invoke.getMockImplementation()!;
    vi.mocked(open).mockResolvedValue("B");
    boundary.invoke.mockImplementation(async (type: string, args: any) => {
      if (type !== "open_project") return original(type, args);
      active = await gate.promise; boundary.listeners.get("project")!({ payload: active }); return active;
    });
    await mountApp(); button("Chọn folder ảnh").click(); await settle();
    expect(button("2. Hậu kỳ").disabled).toBe(true); expect(button("Bắt đầu tạo").disabled).toBe(true);
    gate.resolve(project("B", "prompt B")); await settle();
    expect(button("2. Hậu kỳ").disabled).toBe(false); expect(target.querySelector<HTMLInputElement>('tbody input[type="text"]')!.value).toBe("prompt B");
  });
  it("saves and loads named presets from the header", async () => {
    await mountApp(); await quality("1080p");
    const name = target.querySelector<HTMLInputElement>('[placeholder="Tên preset"]')!;
    name.value = "Kênh A"; name.dispatchEvent(new Event("input", { bubbles: true }));
    button("Lưu").click(); await settle();
    expect(writes.map((w) => w.type)).toEqual(["set_preset", "save_preset"]);
    const pick = target.querySelector<HTMLSelectElement>('[aria-label="Nạp preset"]')!;
    pick.value = "Loaded"; for (const o of pick.options) o.selected = o.value === "Loaded";
    pick.dispatchEvent(new Event("change", { bubbles: true })); await settle();
    expect(writes.at(-1)!.type).toBe("load_preset");
  });
});
```
  The `writes` mock records `start_run`, `reprocess_rows`, `set_preset`, `save_preset`, `load_preset` and `update_row`. The `render` mock resolves `null` and `get_status` returns connected with ffmpeg set.

- [ ] **Step 3: Run** `npx vitest run src/tabs/GenerateTab.test.ts src/App.test.ts` → FAIL (components missing).

- [ ] **Step 4: Implement GenSettingsBar.**

**File:** src/components/GenSettingsBar.svelte (Task 5)
```svelte
<script lang="ts">
  import type { GenSettings } from "../lib/types";
  let { gen = $bindable() }: { gen: GenSettings } = $props();
</script>

<div class="gen">
  <label>Chế độ
    <select bind:value={gen.mode}>
      <option value="imageToVideo">Ảnh làm khung đầu</option>
      <option value="componentsToVideo">Ảnh tham chiếu</option>
    </select>
  </label>
  <label>Tỉ lệ <select bind:value={gen.aspectRatio}><option>16:9</option><option>9:16</option></select></label>
  <label>Chất lượng <select bind:value={gen.quality}><option>720p</option><option>1080p</option></select></label>
  <label>Luồng <input type="number" min="1" max="10" bind:value={gen.concurrency} /></label>
  <label title="Extension tự tạo/tải lại video lỗi trước khi báo lỗi">Tự thử lại <input type="number" min="0" max="5" bind:value={gen.maxRetries} /></label>
  <label class="check"><input type="checkbox" bind:checked={gen.autoPostProcess} /> Tự hậu kỳ luôn sau khi tạo</label>
</div>

<style>
  .gen { display: flex; gap: 12px; align-items: center; padding: 6px 12px; overflow-x: auto; white-space: nowrap; }
  .gen label { flex-direction: row; align-items: center; gap: 6px; }
  .gen input[type="number"] { width: 56px; }
  .check { color: var(--text); }
</style>
```

- [ ] **Step 5: Implement GenerateTab.** It combines the toolbar, paste and import logic from SourceTab, the busy/pausing/act/retry logic from RunTab, and the inline prompt editing.

**File:** src/tabs/GenerateTab.svelte (Task 5)
```svelte
<script lang="ts">
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { open } from "@tauri-apps/plugin-dialog";
  import { api } from "../lib/api";
  import { renderOverlays } from "../lib/exportOverlays";
  import type { PresetStore } from "../lib/presetStore.svelte";
  import { statusLabel } from "../lib/textLayout";
  import type { Project, Row, Status } from "../lib/types";
  import GenSettingsBar from "../components/GenSettingsBar.svelte";

  let { project, store, status, toast, beforeNavigate = async () => {}, onBusyChange = () => {} }: {
    project: Project | null; store: PresetStore | null; status: Status; toast: (t: string) => void;
    beforeNavigate?: () => Promise<void>; onBusyChange?: (busy: boolean) => void;
  } = $props();
  let opening = $state(false);
  // busy guards Start/Retry; stopping is separate so Dừng stays usable while Start still encodes.
  let busy = $state(false);
  let stopping = $state(false);
  let selected = $state(0);
  let common = $state("");
  let pasteText = $state("");
  let pasteFrom = $state(1);
  let showPaste = $state(false);
  $effect(() => onBusyChange(opening || busy || stopping));
  $effect(() => { common = project?.commonPrompt ?? ""; });
  let shownProject: string | undefined;
  $effect(() => { const dir = project?.imageDir; if (dir !== shownProject) { shownProject = dir; selected = 0; } });
  const failed = $derived(project?.rows.filter((r) => r.status.state === "failed").map((r) => r.stt) ?? []);
  const generated = $derived(project?.rows.filter((r) => r.rawVideo).length ?? 0);
  const name = (p: string) => p.split(/[\\/]/).pop();

  async function pickFolder() {
    if (opening) return;
    opening = true;
    try {
      await beforeNavigate();
      const dir = await open({ directory: true, title: "Chọn folder ảnh" });
      if (typeof dir === "string") await api.openProject(dir);
    } catch (e) { toast(String(e)); }
    finally { opening = false; }
  }
  async function importTable() {
    const f = await open({ filters: [{ name: "Bảng", extensions: ["xlsx", "csv"] }] });
    if (typeof f !== "string") return;
    try {
      await store?.flush();
      const unmatched = await api.importTable(f);
      toast(unmatched.length ? `Không khớp: ${unmatched.join(", ")}` : "Đã nhập bảng");
    } catch (e) { toast(String(e)); }
  }
  function select(row: Row) { selected = row.stt; pasteFrom = row.stt; }
  function togglePaste() { showPaste = !showPaste; if (showPaste) pasteFrom = selected || 1; }
  async function paste() {
    try {
      const n = await api.pastePrompts(pasteFrom, pasteText);
      toast(`Đã điền ${n} prompt`);
      showPaste = false;
      pasteText = "";
    } catch (e) { toast(String(e)); }
  }
  async function savePrompt(row: Row, prompt: string) {
    if (!project) return;
    try { await api.updateRow({ stt: row.stt, prompt, text: row.text, music: row.music, textOverride: row.textOverride }, project.imageDir); }
    catch (e) { toast(String(e)); }
  }
  async function act(f: () => Promise<void>) {
    if (busy || !store) return;
    busy = true;
    try {
      await store.flush();
      await f();
    } catch (e) { toast(String(e)); } finally { busy = false; }
  }
  /** The backend's acknowledged project: what start/retry will actually use. */
  async function durable(): Promise<Project> {
    const p = await api.getProject();
    if (!p || p.imageDir !== store?.imageDir) throw new Error("Dự án đã thay đổi");
    return p;
  }
  const start = () => act(async () => {
    const p = await durable();
    if (p.preset.gen.autoPostProcess) await renderOverlays(p, p.rows.filter((r) => r.status.state === "pending").map((r) => r.stt));
    await api.startRun();
  });
  // Generation/download failures go back to Chờ and start right away; post-process failures
  // only need their overlays, which are rendered here too.
  const retry = (stts: number[]) => act(async () => {
    await renderOverlays(await durable(), stts);
    await api.retryRows(stts);
    if (status.connected) await api.startRun().catch(() => {});
  });
  async function stop() {
    if (stopping) return;
    stopping = true;
    try { await api.pauseRun(); } catch (e) { toast(String(e)); } finally { stopping = false; }
  }
</script>

<div class="bar">
  <button class="primary" onclick={pickFolder} disabled={opening}>Chọn folder ảnh</button>
  <button onclick={importTable} disabled={!project}>Nhập Excel/CSV</button>
  <button onclick={togglePaste} disabled={!project}>Dán nhiều prompt</button>
  <input class="grow" placeholder="Prompt chung cho các dòng chưa có prompt riêng" bind:value={common} onchange={() => api.setCommonPrompt(common).catch(toast)} disabled={!project} />
</div>
{#if store}<GenSettingsBar bind:gen={store.preset.gen} />{/if}
{#if showPaste}
  <div class="paste">
    <textarea rows="4" placeholder="Mỗi dòng một prompt" bind:value={pasteText}></textarea>
    <label>Điền từ dòng <input type="number" min="1" bind:value={pasteFrom} /></label>
    <button class="primary" onclick={paste}>Điền</button>
  </div>
{/if}

{#if project}
  <div class="tablewrap">
    <table>
      <thead><tr><th>STT</th><th>Ảnh</th><th>Tên file</th><th>Prompt</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>
        {#each project.rows as row (`${project.imageDir}:${row.stt}`)}
          <tr class:sel={selected === row.stt} onclick={() => select(row)}>
            <td>{row.stt}</td>
            <td><img src={convertFileSrc(row.imagePath)} alt="" loading="lazy" /></td>
            <td class="clip">{name(row.imagePath)}</td>
            <td class="prompt"><input type="text" value={row.prompt} placeholder={project.commonPrompt || "Nhập prompt"} onchange={(e) => savePrompt(row, e.currentTarget.value)} /></td>
            <td class="st {row.status.state}" title={row.status.state === "failed" ? row.status.message : ""}>
              {statusLabel(row.status)}
              {#if row.status.state === "rendering"}<progress max="100" value={row.status.percent}></progress>{/if}
              {#if row.status.state === "failed"}<button class="mini" onclick={(e) => { e.stopPropagation(); retry([row.stt]); }}>Thử lại</button>{/if}
            </td>
            <td><button class="mini" disabled={!row.output && !row.rawVideo} onclick={(e) => { e.stopPropagation(); api.openPath((row.output ?? row.rawVideo)!); }}>Xem</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <div class="foot">
    <span>{generated}/{project.rows.length} đã tạo</span>
    <span class="grow"></span>
    <button class="primary" disabled={busy || opening || status.running || !status.connected} onclick={start}>Bắt đầu tạo</button>
    <button disabled={stopping || !status.running} onclick={stop} title="Hủy các video đang tạo; dòng chưa xong về Chờ">Dừng</button>
    <button disabled={!failed.length || busy} onclick={() => retry(failed)}>Thử lại {failed.length} dòng lỗi</button>
    <button onclick={() => api.openPath(`${project.imageDir}\\_1click\\raw`)}>Mở folder video gốc</button>
  </div>
{:else}
  <p class="empty">Chọn một folder ảnh để bắt đầu. Ảnh được sắp theo tên (1, 2, 10…).</p>
{/if}

<style>
  .bar, .paste, .foot { display: flex; gap: 8px; align-items: center; padding: 8px 12px; }
  .paste { align-items: flex-end; } .paste textarea { flex: 1; }
  .grow { flex: 1; }
  .tablewrap { height: calc(100vh - 205px); overflow: auto; background: var(--panel); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 4px 8px; border-bottom: 1px solid var(--line); text-align: left; }
  th { position: sticky; top: 0; background: var(--panel); color: var(--muted); font-weight: 600; z-index: 1; }
  tr.sel { background: #eaf1ff; }
  img { width: 56px; height: 32px; object-fit: cover; border-radius: 4px; display: block; }
  .clip { max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .prompt { width: 55%; } .prompt input { width: 100%; }
  .mini { padding: 2px 8px; font-size: 12px; }
  progress { width: 70px; vertical-align: middle; }
  .st { white-space: nowrap; }
  .st.done, .st.generated { color: var(--ok); } .st.failed { color: var(--bad); } .st.rendering, .st.sending, .st.postProcessing, .st.downloaded { color: var(--warn); }
  .empty { padding: 40px; color: var(--muted); }
</style>
```

- [ ] **Step 6: Implement the new App.** The script keeps `beforeNavigate`, `navigate`, `receiveProject` and `toast` from the current App, with these changes:
  - `presetEditor` becomes `store`;
  - the tab type becomes `"generate" | "post"`;
  - the store lifecycle is added.

**File:** App store lifecycle (Task 5)
```ts
  import { untrack } from "svelte";
  import { PresetStore } from "./lib/presetStore.svelte";
  let store: PresetStore | null = $state(null);
  // One store per open project; the old one stops writing before the new project's store exists.
  $effect(() => {
    const p = project;
    untrack(() => {
      if (store?.imageDir === p?.imageDir) return;
      store?.destroy();
      store = p ? new PresetStore(p, toast) : null;
    });
  });
  let presetName = $state("");
  let showConn = $state(false);
  async function pickFfmpeg() {
    const dir = await open({ directory: true, title: "Chọn thư mục chứa ffmpeg.exe" });
    if (typeof dir === "string") await api.setFfmpegDir(dir).catch(toast);
  }
```
  - In `beforeNavigate` and `receiveProject`, `presetEditor` becomes `store`.
  - `runBusy` and `sourceBusy` become `stepBusy`, set by both tabs' `onBusyChange`.
  - In `beforeNavigate`, the project-opening path (`projectOpening = true`) skips the busy check only for `opening`. Keep the original semantics: GenerateTab's `pickFolder` calls `beforeNavigate(true)`, which flushes but tolerates its own busy flag. Implement this by passing `beforeNavigate={() => beforeNavigate(true)}` and by making `beforeNavigate(true)` ignore `stepBusy`.

**File:** App markup (Task 5)
```svelte
<header>
  <strong>1Click Video Tool</strong>
  <nav>
    <button class:active={tab === "generate"} onclick={() => navigate("generate")} disabled={stepBusy}>1. Tạo video</button>
    <button class:active={tab === "post"} onclick={() => navigate("post")} disabled={!project || stepBusy}>2. Hậu kỳ</button>
  </nav>
  <span class="grow"></span>
  {#if store}
    <select aria-label="Nạp preset" value="" onchange={(e) => { const n = e.currentTarget.value; e.currentTarget.value = ""; if (n) store!.load(n).then(() => (presetName = store!.name)); }} disabled={navigating}>
      <option value="">Preset…</option>
      {#each store.presets as p}<option value={p}>{p}</option>{/each}
    </select>
    <input class="pname" placeholder="Tên preset" bind:value={presetName} disabled={navigating} />
    <button onclick={() => store!.save(presetName)} disabled={navigating}>Lưu</button>
  {/if}
  {#if !status.ffmpeg}<button class="warn" onclick={pickFfmpeg}>Thiếu FFmpeg — chọn thư mục</button>{/if}
  <button class="conn" class:on={status.connected} onclick={() => (showConn = !showConn)}>
    {status.connected ? `● Extension v${status.extVersion ?? "?"}` : "○ Extension chưa kết nối"}
  </button>
  {#if showConn}
    <div class="menu">
      <p>{status.connected ? `Đã kết nối ${status.extId ?? ""}` : "Mở Chrome có cài extension 1Click"}</p>
      {#if status.extId}<button onclick={() => { api.resetExtension(); showConn = false; }}>Quên extension</button>{/if}
      <button onclick={() => { showConn = false; pickFfmpeg(); }}>Chọn thư mục FFmpeg</button>
    </div>
  {/if}
</header>
<main inert={navigating}>
  {#if tab === "generate"}<GenerateTab {project} {store} {status} {toast} beforeNavigate={() => beforeNavigate(true)} onBusyChange={(b) => (stepBusy = b)} />
  {:else if tab === "post" && project && store}{#key project.imageDir}<PostTab {project} {store} {toast} onBusyChange={(b) => (stepBusy = b)} />{/key}{/if}
</main>
<div class="toasts">{#each toasts as t (t.id)}<div class="toast">{t.text}</div>{/each}</div>

<style>
  header { position: relative; display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--panel); border-bottom: 1px solid var(--line); }
  nav { display: flex; gap: 4px; margin-left: 8px; }
  nav button.active { background: var(--accent); color: #fff; border-color: var(--accent); }
  .grow { flex: 1; }
  .pname { width: 120px; }
  .conn { border: 0; background: none; color: var(--bad); } .conn.on { color: var(--ok); }
  .warn { color: var(--bad); border-color: var(--bad); }
  .menu { position: absolute; right: 12px; top: 44px; z-index: 10; display: flex; flex-direction: column; gap: 6px; padding: 10px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.12); }
  .menu p { margin: 0; color: var(--muted); font-size: 12px; }
  .toasts { position: fixed; right: 16px; bottom: 16px; display: flex; flex-direction: column; gap: 8px; max-width: 420px; }
  .toast { background: #1d2330; color: #fff; padding: 10px 14px; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.2); }
</style>
```
  `PostTab` does not exist yet. Create a stub `src/tabs/PostTab.svelte` holding only the export button and `act` logic from Task 6 Step 5, so this task's App tests can run. Task 6 then completes the file.

- [ ] **Step 7: Run** `npm test` → the new tests PASS. Delete SourceTab, RunTab and PresetTab together with their tests once each case has its ported counterpart:
  - `presetStore.test.ts` covers the store cases;
  - `App.test.ts` covers the navigation cases;
  - `GenerateTab.test.ts` covers the Run and paste cases.
  
  The two RowPanel-specific tests ("resets selected row fields…", "ignores an old successful row Save callback…") are replaced by the inline-edit scoping test, because RowPanel no longer exists. Ledger that ruling.
  
  Then run `npm test && npx tsc --noEmit && npm run build` → PASS.

- [ ] **Step 8: Commit**
```bash
git add -A src && git commit -m "feat: step 1 Tạo video with compact settings bar and header presets"
```

### Task 6: Step 2 — PostTab, PostList, settings sections

**Files:**
- Create: `src/components/PostList.svelte`, `src/components/MusicSettings.svelte`, `src/components/OutputSettings.svelte`, `src/tabs/PostTab.test.ts`
- Modify: `src/tabs/PostTab.svelte` (complete), `src/components/TextStyleEditor.svelte` (4-column compact grid)
- Delete: `src/components/RowPanel.svelte`

**Interfaces:**
- Consumes: `PresetStore`, `renderOverlays`, `TextPreview` (Task 4), `api.pasteTexts`, `api.applyTextTemplate` and `api.assignMusicInOrder` (Task 3).
- Produces: `PostTab` props `{ project: Project; store: PresetStore; toast; onBusyChange? }`.

- [ ] **Step 1: Failing PostTab tests**

**File:** src/tabs/PostTab.test.ts (Task 6)
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync, mount, tick, unmount } from "svelte";
import PostTab from "./PostTab.svelte";
import { PresetStore } from "../lib/presetStore.svelte";
import { fixture } from "../lib/testFixtures";
import type { Project } from "../lib/types";

const boundary = vi.hoisted(() => ({ invoke: vi.fn(), render: vi.fn(async () => null) }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: boundary.invoke, convertFileSrc: (p: string) => p }));
vi.mock("@tauri-apps/api/event", () => ({ listen: async () => () => {} }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("../lib/overlay", () => ({ ensureFont: async () => "Arial", drawOverlay: vi.fn(), renderOverlayPng: boundary.render }));

let target: HTMLDivElement, instance: ReturnType<typeof mount>, store: PresetStore, p: Project;
async function settle() { for (let i = 0; i < 20; i++) { await tick(); await Promise.resolve(); } }
const button = (label: string) => { const b = [...target.querySelectorAll("button")].find((b) => b.textContent?.trim() === label); if (!b) throw new Error(`Missing button ${label}`); return b; };
const call = (type: string) => boundary.invoke.mock.calls.find((c) => c[0] === type)?.[1];
const row = (stt: number, raw: boolean) => ({ stt, imagePath: `A/${stt}.png`, prompt: "", text: "", music: null, textOverride: null, status: raw ? { state: "generated" as const } : { state: "pending" as const }, jobId: null, rawVideo: raw ? `A/_1click/raw/00${stt}.mp4` : null, resolvedMusic: null, output: null });

beforeEach(async () => {
  p = fixture("A"); p.rows = [row(1, true), row(2, false), row(3, true)];
  boundary.render.mockClear();
  boundary.invoke.mockReset().mockImplementation(async (type: string) => {
    if (type === "get_project") return p;
    if (type === "list_presets" || type === "list_music" || type === "list_fonts") return [];
    if (["paste_texts", "apply_text_template", "assign_music_in_order"].includes(type)) return 2;
  });
  target = document.createElement("div"); document.body.append(target);
  store = new PresetStore(p, () => {});
  instance = mount(PostTab, { target, props: { project: p, store, toast: () => {} } });
  await settle();
});
afterEach(async () => { await unmount(instance); store.destroy(); target.remove(); });

describe("PostTab export", () => {
  it("exports all rows that have a raw video, overlays first", async () => {
    button("Xuất tất cả (2)").click(); await settle();
    const order = boundary.invoke.mock.calls.map((c) => c[0]).filter((t) => ["save_overlays", "reprocess_rows"].includes(t));
    expect(order).toEqual(["save_overlays", "reprocess_rows"]);
    expect(call("reprocess_rows")).toEqual({ stts: [1, 3] });
  });
  it("exports only checked rows that have a raw video", async () => {
    const boxes = target.querySelectorAll<HTMLInputElement>(".list input[type=checkbox]");
    boxes[2].click(); flushSync(); await settle();
    button("Xuất dòng chọn (1)").click(); await settle();
    expect(call("reprocess_rows")).toEqual({ stts: [3] });
  });
  it("disables export when nothing has been generated", async () => {
    await unmount(instance); p.rows = [row(1, false)];
    instance = mount(PostTab, { target, props: { project: p, store, toast: () => {} } }); await settle();
    const b = button("Xuất tất cả (0)");
    expect(b.disabled).toBe(true); expect(b.title).toContain("Tạo video ở bước 1 trước");
  });
  it("previews the selected row's raw video, or its image when not generated", async () => {
    expect(target.querySelector("video")?.getAttribute("src")).toBe("A/_1click/raw/001.mp4");
    target.querySelectorAll<HTMLElement>(".list .item")[1].click(); await settle();
    expect(target.querySelector("video")).toBeNull();
  });
});

describe("PostTab batch tools", () => {
  it("pastes texts from the selected row", async () => {
    target.querySelectorAll<HTMLElement>(".list .item")[1].click(); await settle();
    button("Dán nhiều text").click(); await settle();
    const area = target.querySelector<HTMLTextAreaElement>(".batch textarea")!;
    area.value = "Một\nHai"; area.dispatchEvent(new Event("input")); flushSync();
    button("Điền").click(); await settle();
    expect(call("paste_texts")).toEqual({ startStt: 2, text: "Một\nHai", imageDir: "A" });
  });
  it("applies a text template to checked rows, or to all when none are checked", async () => {
    button("Text theo mẫu").click(); await settle();
    const input = target.querySelector<HTMLInputElement>('.batch input[placeholder="Tập {stt}"]')!;
    input.value = "Tập {stt}"; input.dispatchEvent(new Event("input")); flushSync();
    button("Áp dụng").click(); await settle();
    expect(call("apply_text_template")).toEqual({ template: "Tập {stt}", stts: [], imageDir: "A" });
  });
  it("assigns music in order after flushing the preset (a just-picked folder must be saved)", async () => {
    store.preset.music.folder = "D:/nhac"; flushSync();
    button("Gán nhạc lần lượt").click(); await settle();
    const types = boundary.invoke.mock.calls.map((c) => c[0]);
    expect(types.indexOf("set_preset")).toBeLessThan(types.indexOf("assign_music_in_order"));
    expect(call("assign_music_in_order")).toEqual({ stts: [], imageDir: "A" });
  });
  it("saves an inline text edit for its row", async () => {
    const input = target.querySelectorAll<HTMLInputElement>('.list input[type="text"]')[0];
    input.value = "Tập 1"; input.dispatchEvent(new Event("change", { bubbles: true })); await settle();
    expect(call("update_row")).toEqual({ edit: expect.objectContaining({ stt: 1, text: "Tập 1" }), imageDir: "A" });
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/tabs/PostTab.test.ts` → FAIL.

- [ ] **Step 3: Settings sections.**

**File:** src/components/MusicSettings.svelte (Task 6)
```svelte
<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import type { MusicSettings } from "../lib/types";
  let { music = $bindable() }: { music: MusicSettings } = $props();
  async function pick() {
    const dir = await open({ directory: true, title: "Chọn folder nhạc" });
    if (typeof dir === "string") music.folder = dir;
  }
</script>

<div class="grid">
  <label class="wide">Folder nhạc <button class="path" onclick={pick} title={music.folder ?? ""}>{music.folder ? music.folder.split(/[\\/]/).slice(-2).join("\\") : "Chọn…"}</button></label>
  <label>Chế độ
    <select bind:value={music.mode}>
      <option value="random">Ngẫu nhiên</option><option value="sequential">Lần lượt</option><option value="assigned">Theo cột Nhạc</option>
    </select>
  </label>
  {#if music.mode === "assigned"}
    <label>Dòng trống dùng
      <select bind:value={music.fallback}><option value="random">Ngẫu nhiên</option><option value="sequential">Lần lượt</option></select>
    </label>
  {/if}
  <label>Âm lượng nhạc {Math.round(music.musicVolume * 100)}% <input type="range" min="0" max="1.5" step="0.05" bind:value={music.musicVolume} /></label>
  <label>Âm gốc {Math.round(music.originalVolume * 100)}% <input type="range" min="0" max="1.5" step="0.05" bind:value={music.originalVolume} /></label>
  <label>Fade vào (s) <input type="number" min="0" max="10" step="0.5" bind:value={music.fadeIn} /></label>
  <label>Fade ra (s) <input type="number" min="0" max="10" step="0.5" bind:value={music.fadeOut} /></label>
</div>

<style>
  .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px 12px; }
  .wide { grid-column: span 2; }
  .path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
</style>
```

**File:** src/components/OutputSettings.svelte (Task 6)
```svelte
<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import type { OutputSettings } from "../lib/types";
  let { output = $bindable() }: { output: OutputSettings } = $props();
  async function pick() {
    const dir = await open({ directory: true, title: "Chọn folder Output" });
    if (typeof dir === "string") output.folder = dir;
  }
</script>

<div class="row">
  <label>Folder Output <button onclick={pick} title={output.folder ?? ""}>{output.folder ?? "Mặc định: <folder ảnh>\\Output"}</button></label>
  <label class="check"><input type="checkbox" bind:checked={output.overwrite} /> Ghi đè file trùng tên</label>
  {#if output.folder}<button onclick={() => (output.folder = null)}>Dùng mặc định</button>{/if}
</div>

<style>
  .row { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
  .check { flex-direction: row; align-items: center; color: var(--text); }
</style>
```
  - `TextStyleEditor.svelte`: change `.grid` to `grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px 12px;`.
  - Make checkbox labels inline: `.grid label:has(input[type=checkbox]) { flex-direction: row; align-items: center; color: var(--text); }`.
  - Keep all fields; the existing TextStyleEditor-based tests (font size `min="12"`) still apply.

- [ ] **Step 4: PostList.**

**File:** src/components/PostList.svelte (Task 6)
```svelte
<script lang="ts">
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { open } from "@tauri-apps/plugin-dialog";
  import { onMount } from "svelte";
  import { api } from "../lib/api";
  import type { PresetStore } from "../lib/presetStore.svelte";
  import { statusLabel } from "../lib/textLayout";
  import type { Project, Row } from "../lib/types";

  let { project, store, selected = $bindable(), picked = $bindable(), toast, busy }: {
    project: Project; store: PresetStore; selected: number; picked: Set<number>; toast: (t: string) => void; busy: boolean;
  } = $props();
  let tool: "" | "paste" | "template" = $state("");
  let pasteText = $state("");
  let template = $state("Tập {stt}");
  let tracks: string[] = $state([]);
  const folder = $derived(store.preset.music.folder);
  onMount(() => { refreshTracks(); });
  $effect(() => { folder; refreshTracks(); });
  async function refreshTracks() { try { await store.flush(); tracks = await api.listMusic(); } catch { tracks = []; } }
  const name = (p: string) => p.split(/[\\/]/).pop();
  const checked = () => [...picked].sort((a, b) => a - b);

  async function run(work: () => Promise<number>, done: (n: number) => string) {
    try { await store.flush(); toast(done(await work())); } catch (e) { toast(String(e)); }
  }
  const pasteTexts = () => run(() => api.pasteTexts(selected || 1, pasteText, project.imageDir), (n) => { tool = ""; pasteText = ""; return `Đã điền ${n} text`; });
  const applyTemplate = () => run(() => api.applyTextTemplate(template, checked(), project.imageDir), (n) => { tool = ""; return `Đã đặt text cho ${n} video`; });
  const assignMusic = () => run(() => api.assignMusicInOrder(checked(), project.imageDir), (n) => `Đã gán nhạc lần lượt cho ${n} video`);
  async function importTable() {
    const f = await open({ filters: [{ name: "Bảng", extensions: ["xlsx", "csv"] }] });
    if (typeof f !== "string") return;
    try { await store.flush(); const u = await api.importTable(f); toast(u.length ? `Không khớp: ${u.join(", ")}` : "Đã nhập bảng"); } catch (e) { toast(String(e)); }
  }
  async function save(row: Row, patch: Partial<Pick<Row, "text" | "music">>) {
    try { await api.updateRow({ stt: row.stt, prompt: row.prompt, text: patch.text ?? row.text, music: patch.music === undefined ? row.music : patch.music, textOverride: row.textOverride }, project.imageDir); }
    catch (e) { toast(String(e)); }
  }
  function toggle(stt: number) { const s = new Set(picked); s.has(stt) ? s.delete(stt) : s.add(stt); picked = s; }
</script>

<div class="tools">
  <button onclick={() => (tool = tool === "paste" ? "" : "paste")} disabled={busy}>Dán nhiều text</button>
  <button onclick={() => (tool = tool === "template" ? "" : "template")} disabled={busy}>Text theo mẫu</button>
  <button onclick={assignMusic} disabled={busy} title="Lấy nhạc trong folder nhạc theo thứ tự tên, gán cho video 1, 2, 3…">Gán nhạc lần lượt</button>
  <button onclick={importTable} disabled={busy}>Nhập Excel/CSV</button>
</div>
{#if tool}
  <div class="batch">
    {#if tool === "paste"}
      <textarea rows="3" placeholder="Mỗi dòng là text của một video, điền từ dòng đang chọn" bind:value={pasteText}></textarea>
      <button class="primary" onclick={pasteTexts}>Điền</button>
    {:else}
      <input placeholder="Tập {"{stt}"}" bind:value={template} title="{'{stt}'} = số thứ tự, {'{ten}'} = tên ảnh" />
      <span class="hint">{picked.size ? `cho ${picked.size} dòng chọn` : "cho mọi dòng"}</span>
      <button class="primary" onclick={applyTemplate}>Áp dụng</button>
    {/if}
  </div>
{/if}
<div class="list">
  {#each project.rows as row (`${project.imageDir}:${row.stt}`)}
    <div class="item" class:sel={selected === row.stt} onclick={() => (selected = row.stt)} role="presentation">
      <input type="checkbox" checked={picked.has(row.stt)} onclick={(e) => e.stopPropagation()} onchange={() => toggle(row.stt)} />
      <b>{row.stt}</b>
      <img src={convertFileSrc(row.imagePath)} alt="" loading="lazy" title={name(row.imagePath)} />
      <input type="text" class="text" value={row.text} placeholder="Text trên video" onclick={(e) => e.stopPropagation()} onchange={(e) => save(row, { text: e.currentTarget.value })} />
      <select class="music" value={row.music ?? ""} onclick={(e) => e.stopPropagation()} onchange={(e) => save(row, { music: e.currentTarget.value || null })}>
        <option value="">Nhạc tự động</option>
        {#if row.music && !tracks.includes(row.music)}<option value={row.music}>{name(row.music)}</option>{/if}
        {#each tracks as t}<option value={t}>{name(t)}</option>{/each}
      </select>
      <span class="st {row.status.state}">{statusLabel(row.status)}</span>
    </div>
  {/each}
</div>

<style>
  .tools, .batch { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; padding: 6px 0; }
  .batch textarea, .batch input { flex: 1; }
  .hint { color: var(--muted); font-size: 12px; }
  .list { overflow-y: auto; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
  .item { display: grid; grid-template-columns: 20px 28px 48px 1fr 130px 64px; gap: 6px; align-items: center; padding: 4px 8px; border-bottom: 1px solid var(--line); cursor: pointer; }
  .item.sel { background: #eaf1ff; }
  img { width: 48px; height: 28px; object-fit: cover; border-radius: 3px; }
  .text, .music { min-width: 0; padding: 3px 6px; }
  .st { font-size: 12px; white-space: nowrap; }
  .st.done, .st.generated { color: var(--ok); } .st.failed { color: var(--bad); } .st.postProcessing { color: var(--warn); }
</style>
```

- [ ] **Step 5: PostTab.**

**File:** src/tabs/PostTab.svelte (Task 6)
```svelte
<script lang="ts">
  import { api } from "../lib/api";
  import { renderOverlays } from "../lib/exportOverlays";
  import type { PresetStore } from "../lib/presetStore.svelte";
  import { resolutionFor } from "../lib/textLayout";
  import type { Project, TextStyle } from "../lib/types";
  import MusicSettings from "../components/MusicSettings.svelte";
  import OutputSettings from "../components/OutputSettings.svelte";
  import PostList from "../components/PostList.svelte";
  import TextPreview from "../components/TextPreview.svelte";
  import TextStyleEditor from "../components/TextStyleEditor.svelte";

  let { project, store, toast, onBusyChange = () => {} }: { project: Project; store: PresetStore; toast: (t: string) => void; onBusyChange?: (b: boolean) => void } = $props();
  let busy = $state(false);
  $effect(() => onBusyChange(busy));
  let selected = $state(project.rows[0]?.stt ?? 0);
  let picked = $state(new Set<number>());
  const row = $derived(project.rows.find((r) => r.stt === selected));
  const res = $derived(resolutionFor(store.preset.gen));
  const ready = $derived(project.rows.filter((r) => r.rawVideo).map((r) => r.stt));
  const pickedReady = $derived(ready.filter((s) => picked.has(s)));

  // Per-row style: edited locally, saved shortly after each change; export waits for the save.
  let own = $state(false);
  let rowStyle: TextStyle = $state(structuredClone($state.snapshot(store.preset.text)));
  let shownRow = 0;
  $effect(() => {
    const r = row;
    if (!r || r.stt === shownRow) return;
    shownRow = r.stt;
    own = r.textOverride !== null;
    rowStyle = structuredClone(r.textOverride ?? $state.snapshot(store.preset.text)) as TextStyle;
  });
  let pendingOverride: Promise<void> = Promise.resolve();
  let overrideTimer: ReturnType<typeof setTimeout> | undefined;
  function saveOverride() {
    const r = row;
    if (!r) return;
    const override = own ? ($state.snapshot(rowStyle) as TextStyle) : null;
    clearTimeout(overrideTimer);
    overrideTimer = setTimeout(() => {
      pendingOverride = api.updateRow({ stt: r.stt, prompt: r.prompt, text: r.text, music: r.music, textOverride: override }, project.imageDir).catch((e) => toast(String(e)));
    }, 300);
  }
  async function flushOverride() {
    if (overrideTimer) { clearTimeout(overrideTimer); overrideTimer = undefined; saveOverrideNow(); }
    await pendingOverride;
  }
  function saveOverrideNow() {
    const r = row;
    if (!r) return;
    pendingOverride = api.updateRow({ stt: r.stt, prompt: r.prompt, text: r.text, music: r.music, textOverride: own ? ($state.snapshot(rowStyle) as TextStyle) : null }, project.imageDir).catch((e) => toast(String(e)));
  }

  async function exportRows(stts: number[]) {
    if (busy) return;
    busy = true;
    try {
      await store.flush();
      await flushOverride();
      const p = await api.getProject();
      if (!p || p.imageDir !== project.imageDir) throw new Error("Dự án đã thay đổi");
      const todo = stts.filter((s) => p.rows.some((r) => r.stt === s && r.rawVideo));
      if (!todo.length) throw new Error("Chưa có video gốc. Tạo video ở bước 1 trước.");
      await renderOverlays(p, todo);
      await api.reprocessRows(todo);
      toast(`Đang xuất ${todo.length} video`);
    } catch (e) { toast(String(e)); } finally { busy = false; }
  }
</script>

<div class="post">
  <section class="left">
    <PostList {project} {store} bind:selected bind:picked {toast} {busy} />
  </section>
  <section class="right">
    {#if row}
      {#if own}
        <TextPreview bind:style={rowStyle} text={row.text || "Chữ mẫu trên video"} w={res.w} h={res.h} imagePath={row.imagePath} videoPath={row.rawVideo} />
      {:else}
        <TextPreview bind:style={store.preset.text} text={row.text || "Chữ mẫu trên video"} w={res.w} h={res.h} imagePath={row.imagePath} videoPath={row.rawVideo} />
      {/if}
      <label class="check"><input type="checkbox" bind:checked={own} onchange={saveOverride} /> Kiểu/vị trí chữ riêng cho video {row.stt}</label>
    {/if}
  </section>
</div>
<div class="sections">
  <details open>
    <summary>Kiểu chữ {own ? `(riêng video ${selected})` : "(chung)"}</summary>
    {#if own}<div oninput={saveOverride} onchange={saveOverride} role="presentation"><TextStyleEditor bind:style={rowStyle} /></div>
    {:else}<TextStyleEditor bind:style={store.preset.text} />{/if}
  </details>
  <details><summary>Nhạc nền</summary><MusicSettings bind:music={store.preset.music} /></details>
  <details><summary>Đầu ra</summary><OutputSettings bind:output={store.preset.output} /></details>
</div>
<div class="foot">
  <span class="grow"></span>
  <button disabled={busy || !pickedReady.length} onclick={() => exportRows(pickedReady)}>Xuất dòng chọn ({pickedReady.length})</button>
  <button class="primary" disabled={busy || !ready.length} title={ready.length ? "" : "Tạo video ở bước 1 trước"} onclick={() => exportRows(ready)}>Xuất tất cả ({ready.length})</button>
  <button onclick={() => api.openPath(store.preset.output.folder ?? `${project.imageDir}\\Output`)}>Mở folder Output</button>
</div>

<style>
  .post { display: grid; grid-template-columns: minmax(380px, 1fr) minmax(320px, 1fr); gap: 12px; padding: 8px 12px; height: calc(100vh - 250px); min-height: 300px; }
  .left { display: flex; flex-direction: column; min-height: 0; }
  .left :global(.list) { flex: 1; }
  .right { display: flex; flex-direction: column; gap: 6px; min-height: 0; }
  .check { flex-direction: row; align-items: center; color: var(--text); justify-content: center; }
  .sections { padding: 0 12px; max-height: 30vh; overflow-y: auto; }
  details { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px; margin-bottom: 6px; }
  summary { cursor: pointer; font-weight: 600; }
  details[open] summary { margin-bottom: 8px; }
  .foot { display: flex; gap: 8px; align-items: center; padding: 6px 12px; }
  .grow { flex: 1; }
</style>
```
  The `TextPreview` frames pass `maxHeight` by default (55vh); since the right column is about 330px high at 820px, pass `maxHeight="calc(100vh - 330px)"`. Verify visually in Task 7 and adjust only that value.

- [ ] **Step 6: Run** `npm test && npx tsc --noEmit && npm run build` → PASS. Delete `src/components/RowPanel.svelte`; no import of it should remain (check with `grep -rn RowPanel src`).

- [ ] **Step 7: Commit**
```bash
git add -A src && git commit -m "feat: step 2 Hậu kỳ with live video preview, batch text/music and export"
```

### Task 7: Docs, real-app check, installer

**Files:**
- Modify: `README.md`, `docs/HANDOFF-CLAUDE.md`, `AGENTS.md` (status line)
- Create: `docs/reviews/2026-10-09-two-step-ui-check.md` (+ screenshots `docs/reviews/2026-10-09-*.png`)

- [ ] **Step 1: README.** Rewrite the "Dùng" section for the two steps (1. Tạo video / 2. Hậu kỳ):
  - the "Đã tạo" state and "Tự hậu kỳ luôn";
  - batch tools: Dán nhiều text, `Tập {stt}`/`{ten}` templates, Gán nhạc lần lượt, Excel without `anh` = by order;
  - Xuất dòng chọn / Xuất tất cả;
  - preset in the header;
  - Extension/FFmpeg menu in the header.
  
  Keep the retry notes.
- [ ] **Step 2: Real app** (no quota). Steps:
  1. Run `npm run build && cargo tauri build` (or `cargo tauri dev`), start the app with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333`, and open `live-run` via `open_project`.
  2. Screenshot step 1, then step 2 at 16:9 and at 9:16 through the UI aspect select. Check that the 9:16 frame is tall and narrow and the canvas is not stretched: `canvas.getBoundingClientRect()` width/height ≈ 9/16.
  3. Check that the step 2 preview plays the raw video: `document.querySelector('video').readyState >= 2`.
  4. Click "Xuất dòng chọn" on row 1, wait for Done, and ffprobe the new output. Use a scratch copy of `live-run` to avoid touching the evidence outputs: copy it to `live-run-ui`.
  5. Restore 16:9 afterwards.
  6. Write the check doc with the screenshots.
- [ ] **Step 3: Full verification.**
  - `cd src-tauri && cargo test`;
  - `npm test`, `npm run build`, `npx tsc --noEmit`, `npm run test:ext`, `git diff --check`, all exit 0;
  - `cargo tauri build` → record the installer size and SHA256 in HANDOFF.
- [ ] **Step 4: Commit**
```bash
git add -A README.md AGENTS.md docs && git commit -m "docs: two-step UI guide, real-app check and installer"
```
