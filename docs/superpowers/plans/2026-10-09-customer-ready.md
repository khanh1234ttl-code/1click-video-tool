# Customer-ready installer + multi-image prompts — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. TDD for every task.

**Spec:** `docs/superpowers/specs/2026-10-09-customer-ready-design.md`

## Global Constraints
- Back up the extension before editing it. Change only the bridge; the git copy stays byte-identical with the installed one.
- Never hold a std Mutex across `.await`. User-facing text is Vietnamese. Commit locally only.
- Live run: 3 prompts × 2 reference images, maxRetries 0, once, in the bundled Chromium profile the user signed into.

## Review Focus
1. **Old projects** (`imagePath`) open with `images: [imagePath]`. Done rows still export with the same output name.
2. **Same image used by many prompts** is uploaded once. Its imageId is shared, and the bridge prepares it once.
3. **Pasting more prompts than rows** adds rows. Images of existing rows are never cleared.
4. **Deleting rows** never touches running rows, and STTs of the remaining rows stay the same, so output names are stable.
5. **The tool runs where Chrome already has the extension** (developer machine): Chromium is not auto-opened once the extension connects within 8 s.

### Task 1 — Model: `images: Vec<PathBuf>`
- RED tests:
  - old JSON with `imagePath` loads as `images`;
  - `Row::new(stt, img)` gives `images == [img]`;
  - `first_image_stem()` returns `"prompt"` for a row without images;
  - path rebase covers every image;
  - output name for a row without images is `001_prompt.mp4`.
- Implement:
  - `RowWire` with `#[serde(from)]`;
  - helpers `first_image()` and `image_stem()` (first image, or `prompt`);
  - update engine, import and project to use them;
  - UI types `images: string[]`; components use `row.images[0]`.
- Commit.

### Task 2 — Rows and image assignment (backend)
- RED tests:
  - `add_rows(3)` gives STT max+1…;
  - `delete_rows` skips active rows;
  - `assign_images` covers `all`, `roundRobin` and `onePerImage`;
  - `paste_prompts` appends rows;
  - Excel multi-image (`a.png; b`), unknown names reported, rows appended;
  - start validation: frame mode needs exactly 1 image, reference mode 1–10; the error lists STTs.
- Implement in `import.rs` / `runner.rs`.
- Commands: `list_images`, `add_rows`, `delete_rows`, `set_row_images`, `assign_images`.
- Update the samples and their test.
- Commit.

### Task 3 — Submit with shared images + bridge
- RED tests:
  - engine: two rows sharing an image produce one `image.put` and items with `imageIds` (plus `imageId` = first);
  - bridge: an item with `imageIds` prepares each image once and `payload.imageIds` lists them; an old single-`imageId` item still works.
- Implement `JobItem.image_ids` and the bridge change (back up the extension first).
- Commit.

### Task 4 — Bundled FFmpeg and Chromium
- `scripts/fetch-vendor.py`: download, check pinned SHA256, extract into `src-tauri/vendor/` (git-ignored).
- `tauri.conf.json` resources: `vendor/chromium/**`, `vendor/ffmpeg/**`, `vendor/extension/**`, `THIRD_PARTY_NOTICES.txt`.
- RED tests:
  - `find_tool` prefers the bundled dir over PATH when no setting is set;
  - `browser_command(chromium, profile, extension)` builds the exact args.
- Implement:
  - `bundled_dir` from Tauri `resource_dir` in setup;
  - command `open_vids_browser`;
  - auto-open after 8 s if bundled and not connected;
  - Status field `bundledBrowser`.
- Commit.

### Task 5 — UI
- RED tests:
  - the image picker calls `assign_images` with each rule and the picked order;
  - Thêm dòng / Xoá dòng đã tick;
  - the row image cell opens the picker for that row (`set_row_images`);
  - the header menu shows "Mở trình duyệt Vids" when `bundledBrowser`.
- Implement `ImagePicker.svelte` and the GenerateTab table changes, then update PostList/PostTab to use the first image.
- Commit.

### Task 6 — Docs, live run, installer
- Update README, guide (rebuild and republish), samples and HANDOFF.
- Build the installer and measure its size.
- Live run in the bundled Chromium: 3 prompts, 2 shared reference images, maxRetries 0.
- Report and commit.
