# Handoff to Codex — finish the 1Click Video Tool

> **Latest checkpoint (2026-10-08):** Codex continued this handoff, completed Tasks 11–12,
> built an initial installer and reviewed the branch. The user then requested a commit and
> a plan for Claude Code. Read `HANDOFF-CLAUDE.md` and
> `superpowers/plans/2026-10-08-claude-code-finish-video-tool.md` next. Historical commit `f23202f`
> held an unfinished Rust refactor; Task 1 is now complete at `d2a708f` with scoped review
> approved. Task 2 is complete at `f7690a7`, scoped review approved, 79 unit tests passing.
> The user explicitly requested commit and pause. Task 3 is paused WIP at `04a1726`,
> not review-approved. Read `reviews/2026-10-08-task-3-checkpoint.md`; when resumed,
> first fix Pause during pending start_run and test both start/pause settlement orders.
> UI 25/25, Rust unit 82/82 and build pass; the known Task 4 mute test is still failing.
> Do not continue until resumed. The status
> below records the earlier Claude-to-Codex handoff and is historical, not current.

Written 2026-10-08 by Claude Code, which implemented Tasks 1–10 and most of Task 11 and then
handed off at the user's request. Read this file fully before touching code.

## 1. What this project is

A Windows desktop tool (Tauri 2 + Rust + Svelte 5) that:
1. loads a folder of images and a prompt per image (table edit, pasted lines, one common prompt, or CSV/XLSX),
2. sends image+prompt jobs over a localhost WebSocket to the Chrome extension
   **Vids Automation – 1 Click Studio**, which generates Veo videos on Google Vids and downloads them,
3. post-processes each video with FFmpeg: a text overlay (PNG rendered by the UI's Canvas) and
   background music (random / sequential / assigned; original Veo audio kept, music quieter),
4. writes one output file per video.

Authoritative documents (read both; the spec wins any conflict):
- Spec: `D:\1Click\Vids_Automation_1ClickStudio_v1.1.9.6\docs\superpowers\specs\2026-10-08-1click-video-tool-design.md`
- Plan: `D:\1Click\Vids_Automation_1ClickStudio_v1.1.9.6\docs\superpowers\plans\2026-10-08-1click-video-tool.md`
  Every task has exact file contents, tests and expected output. Its "Global Constraints" and
  "Review Focus" sections apply to everything you do.

The user speaks Vietnamese; all user-facing text in the app must be Vietnamese.

## 2. Repositories and paths

| What | Path | Git |
|---|---|---|
| Tool source | `D:\1Click\Vids_Automation_1ClickStudio_v1.1.9.6\1click-video-tool\` | local repo, branch `feat/video-tool`, base `main` (de0dd8b, empty init commit). Commits stay local — never push. |
| Chrome extension (unpacked) | `D:\1Click\Vids_Automation_1ClickStudio_v1.1.9.6\Vids_Automation_1ClickStudio_v1.1.9.6\` | **not** in git. Back it up before editing (Task 12 step 1). |
| Extension backups | `…\Vids_Automation_1ClickStudio_v1.1.9.8_backup_*` | do not modify |
| Progress ledger | `1click-video-tool\.superpowers\sdd\2026-10-08-1click-video-tool\progress.md` | git-ignored scratch; append one line per finished task |

## 3. Status

| Task | State | Commit(s) |
|---|---|---|
| 1 Scaffold | done | 1898305 |
| 2 Model + persistence | done | d604941 |
| 3 Import (folder, paste, CSV/XLSX) | done | c6c067d |
| 4 Music picking | done | 3848413 |
| 5 Media (ffprobe/ffmpeg/naming/image encode) | done | 674b7a6 |
| 6 Bridge WebSocket server | done | 4403484 |
| 7 Runner state machine | done | f3b9cd7 |
| 8 Engine + e2e test (fake extension + real ffmpeg) | done | 0ffcb09 |
| 9 Tauri commands + wiring | done | eb8e2de |
| 10 UI types/api/textLayout/overlay | done | 6105166 |
| 11 UI screens | **partial** — steps 1–7 committed in 9c0fdc6; step 8 only Source tab verified | 9c0fdc6 |
| 12 Extension bridge module | **todo** | — |
| 13 Real run, README, installer | **todo** | — |
| Final whole-branch review | **todo** | — |

Current test state (all green at 9c0fdc6):
- `cd src-tauri && cargo test` → lib 41, e2e 1, media_ffmpeg 2 (needs ffmpeg/ffprobe on PATH; present: FFmpeg 8.1).
- `npm test` → 6 (vitest, textLayout).
- `npm run build` → OK (expected Svelte warnings `state_referenced_locally` in RowPanel/PresetTab — see rulings).

## 4. What to do next, in order

### 4.1 Finish Task 11 (plan "Task 11", steps 8–9)
1. Fix the bug found in the smoke test: on the Source tab the table does not fill the width
   (`table { display: block }` in `src/tabs/SourceTab.svelte`). Wrap the table in a scroll
   container instead, e.g. `<div class="tablewrap"><table>…</table></div>` with
   `.tablewrap { flex: 1; overflow-y: auto; background: var(--panel); }` and `table { width: 100%; border-collapse: collapse; }`.
2. Smoke-test Preset and Run tabs in the real app (see §6 "Driving the real app"): Preset tab
   shows the draggable text preview over the first image and saving a preset works; Run tab shows
   "Extension chưa kết nối" while no extension is connected.
3. Commit `feat: source, preset and run screens`, append the Task 11 completion line to the ledger.

### 4.2 Task 12 — extension bridge (plan "Task 12")
Follow the plan exactly: back up the extension, write `ext-tests/bridge.test.mjs` first (RED),
then `assets/oneclick-bridge.js`, wire it in `service-worker-loader.js`, bump the manifest to
1.1.10.0, add the `alarms` permission and `http://127.0.0.1/*` host, append FIX_NOTES.txt.
- Run tests with `npm run test:ext` (Node 26 has a global WebSocket client; `ws` is installed for the server side).
- Syntax-check extension files as **ES modules**: `node --input-type=module --check < file.js`.
  Plain `node --check` treats them as scripts and misses module-only errors (a stray top-level
  `return` slipped through once this way).

### 4.3 Task 13 — real run, README, installer (plan "Task 13")
- The user must reload the extension in `chrome://extensions` after Task 12 — no agent can open
  `chrome://` pages. Ask them.
- A real run consumes the user's Veo quota (≈1 generation per row). Use 3 rows max and tell the user.
- If you cannot drive Chrome, ask the user to press **Bắt đầu** in the app while you watch the
  project state through CDP (§6) and the output folder on disk.
- Then write `README.md` (Vietnamese, content is in the plan) and run `cargo tauri build`.

### 4.4 Final review, then finish
Review the whole branch (`git diff main...feat/video-tool`) against the spec and the plan's
"Review Focus" list. Fix Critical/Important findings with a failing test first; list Minor ones
for the user. Do not merge or push without the user's OK.

## 5. Rulings already made (keep them)

- Task 1: repo initialised before Task 1 (empty `main` commit + branch `feat/video-tool`).
- Task 2: model tests first ran together with project's RED step; model.rs is plain data types.
- Task 5: test helper `red_at` converts to rgb24 before `crop=1:1` (yuv420p chroma subsampling rounds a 1-px crop to 0).
- Task 8: `engine.rs` computes `r.image_stem()` before moving `r.raw_video` (E0382 in the plan's code).
- Task 10: `tsconfig.json` lib = `["ES2022","DOM","DOM.Iterable"]` (needed for `document.fonts.add`).
- Task 11: Svelte `state_referenced_locally` warnings in RowPanel/PresetTab are intentional (forms seed once; RowPanel is re-created per row via `{#key}`).
- Design: the first extension that connects is trusted automatically (trust on first use) and can be
  forgotten with the "Quên extension" button — simpler than the spec's confirmation dialog; the user was told.

## 6. Environment and techniques that work here

- Windows 11, Git Bash. Rust 1.95 (MSVC; VS 2026 C++ tools at `D:\VisualStudio\18\Community`),
  tauri-cli 2.11.5, Node 26 / npm 11 (npm blocks install scripts; esbuild still works), FFmpeg 8.1 on PATH.
- Repo uses `core.autocrlf=false`; `.superpowers/` is git-ignored.
- `scripts/extract-plan-block.py PLAN "MARKER" OUT` copies the first fenced code block after a
  marker line of the plan into a file — used for every task so far to avoid transcription errors.
  Example: `python -I scripts/extract-plan-block.py "../docs/superpowers/plans/2026-10-08-1click-video-tool.md" "**Step 3: Implement \`assets/oneclick-bridge.js\`**" out.js`
  (match the marker text exactly as it appears in the plan).
- **Driving the real app** (screenshots + JS inside the Tauri window):
  1. `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9333" cargo tauri dev` (background).
  2. `node scripts/cdp.mjs eval "<js>"` runs JS in the window, e.g.
     `window.__TAURI_INTERNALS__.invoke('open_project', {dir: 'C:/path/to/images'})`;
     `node scripts/cdp.mjs shot out.png` saves a screenshot.
  3. Stop it with `taskkill //IM oneclick-video-tool.exe //F` and kill the Vite process listening on `[::1]:1420`.
  Keep JS expressions free of backslashes (shell escaping breaks them); use forward-slash paths.
- Tauri gotcha: **sync** `#[tauri::command]`s run outside the tokio runtime — anything that calls
  `tokio::spawn` must be an `async` command (that is why `open_project` is async).
- Never hold the engine's `std::sync::Mutex` guard across an `.await` (use the sync helper pattern in `engine.rs`).

## 7. Facts about the extension and Google Vids (verified on the real site)

- Extension ID `bedjklgfehfcmlaldafbbdplgblpdpch`, loaded unpacked from the folder in §2.
- Content-script changes load on a plain reload of the Vids tab (files are served from disk);
  service worker / manifest changes need the user to click Reload in `chrome://extensions`.
- Chrome's download folder is **not** `~/Downloads`: it is the user's custom folder
  `E:\AFF cám\THÁNG 10` (read `download.default_directory` from
  `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Preferences`). Bridge downloads land in
  `<that folder>\1ClickBridge\<jobId>\NNN_<prompt>_a.mp4`.
- The extension (v1.1.9.9) drives Vids with DOM-level synthetic events + `execCommand`, which work
  even when the tab is hidden/minimised; waits in hidden tabs go through the service worker
  (`OC_SLEEP`). Details and verified behaviour: `…\Vids_Automation_1ClickStudio_v1.1.9.6\FIX_NOTES.txt`.
- Content-script messages the bridge uses: `PREPARE_IMAGE {id, data:{base64,name}}`,
  `AUTO_FILL_VIDS {payloads, groupId, concurrentPrompts}`, `CANCEL_PROMPT_GROUP {groupId}`,
  `CHECK_VIDS_PAGE`; broadcasts it listens to: `VIDEO_GENERATION_PROGRESS`, `PROMPT_GROUP_STATUS`
  (a final generation failure has `success:false, downloadComplete:false`).
- Do not change the content-script generation flow (`assets/index.ts-DUXzPPUe.js`) — it was
  debugged against the live site. The bridge only adds a service-worker module.
