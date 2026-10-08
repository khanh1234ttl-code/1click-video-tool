# Agent instructions — 1Click Video Tool

Work in progress handed off from Claude Code. **Start by reading `docs/HANDOFF-CODEX.md`**: it has
the status, the remaining tasks (finish Task 11, Tasks 12–13, final review), the rulings already
made, and environment facts. The plan and spec it points to are authoritative.

- Branch `feat/video-tool`; commit locally after each task; never push or merge without the user.
- Test before code (write the failing test, watch it fail, then implement).
- Rust: `cd src-tauri && cargo test`; UI: `npm test && npm run build`; extension bridge: `npm run test:ext`.
- User-facing text is Vietnamese.

## Latest continuation checkpoint (2026-10-08)

After reading HANDOFF-CODEX.md, read `docs/HANDOFF-CLAUDE.md` and
`docs/superpowers/plans/2026-10-08-claude-code-finish-video-tool.md`.
The latter plan is the next work, requested by the user for Claude Code.
Checkpoint `f23202f` is WIP and does not compile Rust; Tasks 11-12 are done,
Task 13 live generation and the final desktop review fixes remain.
Do not restart completed Tasks 1-10 or treat the old installer as a verified WIP build.
