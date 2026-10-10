# Agent instructions — 1Click Video Tool

Work in progress handed off from Claude Code. **Start by reading `docs/HANDOFF-CODEX.md`**: it has
the status, the remaining tasks (finish Task 11, Tasks 12–13, final review), the rulings already
made, and environment facts. The plan and spec it points to are authoritative.

- Branch `feat/video-tool`; commit locally after each task; never push or merge without the user.
- Test before code (write the failing test, watch it fail, then implement).
- Rust: `cd src-tauri && cargo test`; UI: `npm test && npm run build`; extension bridge: `npm run test:ext`.
- The full extension is in `extension/` (the installer copies it). The owner's Chrome loads the copy in `../Vids_Automation_1ClickStudio_v1.1.9.6/`; keep both identical, back up before editing, never change the content-script generation flow.
- User-facing text is Vietnamese.

## Latest status (2026-10-08)

The Claude Code continuation plan (`docs/superpowers/plans/2026-10-08-claude-code-finish-video-tool.md`) is
complete: Tasks 1–8 done, live 3-row run verified (`docs/reviews/2026-10-08-live-run.md`), installer rebuilt.
Then the 2026-10-09 two-step UI update (spec/plan dated 2026-10-09). Read `docs/HANDOFF-CLAUDE.md` "Cập nhật 09/10/2026" and "Trạng thái cuối" for commits, test counts, installer SHA256 and remaining Minor items.
Branch `feat/video-tool` is local only; pushing or merging needs the user. Do not redo completed tasks.
