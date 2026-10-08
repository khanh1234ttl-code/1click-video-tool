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
User explicitly requested commit and pause. Task 3 is paused WIP at `04a1726`, not review-approved.
Read `docs/reviews/2026-10-08-task-3-checkpoint.md` before resuming. First fix the Pause button
being blocked while start_run is pending; keep navigation locked until start and pause both settle.
UI 25/25, Rust unit 82/82, build/tsc and focused integrations pass; no scoped Task 3 review yet.
Full cargo test retains the known Task 4 original-audio mute failure. Do not continue until resumed.
Tasks 11-12 are done; live generation and remaining desktop review fixes remain.
Do not restart completed Tasks 1-10 or treat the old installer as a verified WIP build.
