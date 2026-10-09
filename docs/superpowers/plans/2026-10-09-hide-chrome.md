# Hide Chrome window — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Hide the Chrome window running Google Vids completely (screen + taskbar) on request, restoring it on rejection, toggle-off and app exit.

**Architecture:** Bridge puts the Vids tab in its own window and reports its bounds (`window.info`). The tool matches that window among `Chrome_WidgetWin_1` top-level windows by DPI-scaled bounds and calls `ShowWindow`.

**Tech Stack:** Chrome MV3 service worker (bridge), Rust + `windows-sys` (Win32), Svelte 5.

**Spec:** `docs/superpowers/specs/2026-10-09-hide-chrome-design.md`

## Global Constraints
- Back up the extension folder before editing it. Only `assets/oneclick-bridge.js` changes; the generation flow does not. The git copy `extension-bridge/assets/oneclick-bridge.js` must stay byte-identical with the installed one.
- TDD (RED first). Never hold a std Mutex across `.await`. User-facing text is Vietnamese. Commit locally only.
- Live run: at most 5 images, concurrency 5, maxRetries 0, once. On failure, stop and debug without spending more quota.

## Review Focus
1. A user's ordinary Chrome window must never be hidden. Matching requires class, a non-empty title and bounds within 8 px after DPI scaling.
2. The window must come back on app exit and on a rejected job; otherwise a user could lose a Chrome window.
3. The user moves or resizes the window while it is visible, then hides it: the bridge's `onBoundsChanged` must re-report the bounds.

### Task 1: Bridge — own window + window.info
- [ ] Back up the extension to `../Vids_Automation_1ClickStudio_v1.1.10.0_backup_<timestamp>`.
- [ ] RED tests in `ext-tests/bridge.test.mjs`. The mock gains `windows.get/create({tabId})`, `tabs.query` with `windowId`, and `windows.onBoundsChanged`.
  - `moves a shared Vids tab into its own window and reports window.info`: tab 7 is in window 1, which holds 2 tabs. Expect `windows.create({tabId:7, focused:false})` and an inbox entry `window.info` with the new window's bounds.
  - `answers window.query with the Vids window bounds`.
  - `re-reports bounds when the Vids window moves`.
- [ ] Implement `ensureOwnWindow(tab)`, `reportWindow(windowId)`, the `window.query` case, the `onBoundsChanged` listener, and a `trackedWindow` kept in `chrome.storage.session`. Then copy the file to the git copy.
- [ ] `npm run test:ext` → all pass. Commit.

### Task 2: Rust — protocol, matching, engine, command
- [ ] RED:
  - `bridge.rs` JSON test: `window.info` → `FromExt::WindowInfo{window_id,left,top,width,height}`; `ToExt::WindowQuery` → `{"type":"window.query"}`.
  - `chrome_window.rs`: `rect_matches(rect, dpi, bounds)` cases at 96 and 144 dpi, off by 6 px (match) and 20 px (no match).
  - `engine_tests.rs`:
    - `window_info_is_remembered_and_hide_setting_persists`;
    - `set_hide_chrome` saves the setting;
    - the status reports `hide_chrome` and `chrome_window`.
- [ ] Implement:
  - `chrome_window.rs`: Win32 via the `windows-sys` features `Win32_Foundation`, `Win32_UI_WindowsAndMessaging` and `Win32_UI_HiDpi`; `set_visible(&Bounds, bool) -> usize`.
  - Engine:
    - stores `chrome_bounds`;
    - applies the setting on `WindowInfo`, calling the Win32 work outside the lock;
    - shows the window on `JobRejected`;
    - sends `WindowQuery` on Connected.
  - `restore_chrome()`, called from `RunEvent::Exit` in `lib.rs`.
  - Command `set_hide_chrome`.
- [ ] `cargo test` → all pass. Commit.

### Task 3: UI toggle + guide
- [ ] RED App test: the header button "Ẩn Chrome" calls `set_hide_chrome {hide:true}`; with `status.hideChrome` it shows "Hiện Chrome" and calls `{hide:false}`.
- [ ] Implement: `types.ts` Status fields, `api.setHideChrome`, the header button.
- [ ] Guide (`docs/guide/huong-dan.src.html` → rebuild the html → republish the artifact): add a section "Ẩn Chrome và Chạy nền". README note.
- [ ] `npm test`, `npx tsc --noEmit`, `npm run build` → pass. Commit.

### Task 4: Live run (5 Veo generations) + installer
- [ ] The user reloads the extension (bridge changed).
- [ ] 5 drawn images, concurrency 5, maxRetries 0, autoPostProcess on, hide on, Chạy nền **off**.
  - Check the Chrome window `IsWindowVisible == false` while rendering.
  - Expect 5/5 Done in order, with outputs and audio.
  - After the run, toggle "Hiện Chrome": the window is visible again.
- [ ] Report `docs/reviews/2026-10-09-hide-chrome-live.md`, `cargo tauri build`, size + SHA256 in HANDOFF. Commit.
