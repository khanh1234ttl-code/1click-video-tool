# Agent instructions — 1Click Video Tool

Work in progress handed off from Claude Code. **Start by reading `docs/HANDOFF-CODEX.md`**: it has
the status, the remaining tasks (finish Task 11, Tasks 12–13, final review), the rulings already
made, and environment facts. The plan and spec it points to are authoritative.

- Branch `feat/video-tool`; commit locally after each task; never push or merge without the user.
- Test before code (write the failing test, watch it fail, then implement).
- Rust: `cd src-tauri && cargo test`; UI: `npm test && npm run build`; extension bridge: `npm run test:ext`.
- User-facing text is Vietnamese.
