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
Historical checkpoint `f23202f` was WIP. Continuation Task 1 is complete at `d2a708f`;
Task 2 is complete at `f7690a7`, scoped review approved, Rust unit 79/79 passing.
Continue with Task 3. Full cargo test retains the known Task 4 original-audio mute failure.
Tasks 11-12 are done; live generation and remaining desktop review fixes remain.
Do not restart completed Tasks 1-10 or treat the old installer as a verified WIP build.
