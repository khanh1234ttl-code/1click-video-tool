# Agent instructions — 1Click Video Tool

Work in progress handed off from Claude Code. **Start by reading `docs/HANDOFF-CODEX.md`**: it has
the status, the remaining tasks (finish Task 11, Tasks 12–13, final review), the rulings already
made, and environment facts. The plan and spec it points to are authoritative.

- Branch `feat/video-tool`; commit locally after each task; never push or merge without the user.
- Test before code (write the failing test, watch it fail, then implement).
- Rust: `cd src-tauri && cargo test`; UI: `npm test && npm run build`; extension bridge: `npm run test:ext`.
- User-facing text is Vietnamese.

## Latest status (2026-10-08)

The Claude Code continuation plan (`docs/superpowers/plans/2026-10-08-claude-code-finish-video-tool.md`) is
complete: Tasks 1–8 done, live 3-row run verified (`docs/reviews/2026-10-08-live-run.md`), installer rebuilt.
Read `docs/HANDOFF-CLAUDE.md` "Trạng thái cuối" for commits, test counts, installer SHA256 and remaining Minor items.
Branch `feat/video-tool` is local only; pushing or merging needs the user. Do not redo completed tasks.
