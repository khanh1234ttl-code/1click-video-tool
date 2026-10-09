# macOS + MCP — Plan

> REQUIRED SUB-SKILL: superpowers:executing-plans; TDD per task.

**Spec:** `docs/superpowers/specs/2026-10-09-mac-and-mcp-design.md`

## Global Constraints
- The Windows behaviour stays the same and every existing test stays green.
- Back up the extension before editing the bridge.
- Only 127.0.0.1 is used. Control connections need a token and are refused when they carry an Origin header.
- No Apple signing or notarization. A Mac build and live run happen on a Mac; on Windows, prepare the code, config, tests and the MCP live test.
- Do not modify the user's agent config (Claude/Codex). Test MCP by driving `--mcp` over stdio from a script.

## Review Focus
1. Control port: a web page (Origin present) or a wrong token must never control the tool.
2. MCP `--mcp` launched while the tool is closed: a clear Vietnamese error, no hang.
3. Overlays: `export_videos` from an agent renders exactly what the UI would. If the UI never answers, it times out with an error instead of hanging.
4. Preset edits from the agent must not be overwritten by a stale UI store, and unsaved UI edits must not be lost.
5. The Mac path separator in the UI ("Mở folder Output").

### M1 Cross-platform code
- Platform-dependent tool file names (`.exe` only on Windows).
- `Bundle::chromium` path on Mac.
- On Mac, Chrome hiding goes through bridge `window.state`, implemented in the bridge with a test.
- UI `joinPath` helper.

### M2 Mac vendor + bundle config
- `fetch-vendor.py --platform`.
- `tauri.bundle.mac.conf.json`.
- README Mac section, including the `xattr` step.

### P1 Control server
- `control.rs`: WS on 17891 with a token and Origin rejection; JSON request/response dispatch to engine and commands.
- Tests: auth, open/add_prompts/set_settings/get_project.

### P2 MCP stdio
- `--mcp` in `main.rs`.
- `mcp.rs` handles initialize, tools/list and tools/call, forwarding through a `Control` trait. Tests use a fake.

### P3 Overlays via UI + preset adopt + MCP panel
- `render-overlays` event, wait and `overlays_rendered`.
- `PresetStore.adopt`.
- The UI panel "Kết nối agent (MCP)" with copyable commands.

### P4 Verify
- Full suites.
- MCP live test on Windows via a stdio script: status, open_project, add_prompts, get_project, export_videos on the live-multi project (no Veo).
- Docs, Windows installer rebuild, report.
