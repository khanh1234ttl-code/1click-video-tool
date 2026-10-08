# Task 3 — checkpoint tạm dừng

Ngày 08/10/2026. Người dùng yêu cầu **commit và tạm dừng**. Code WIP ở `04a1726`, nhánh `feat/video-tool`, commit cục bộ. Task 3 chưa scoped review, chưa hoàn tất. Chỉ tiếp tục khi được yêu cầu.

Đã triển khai ordered preset debounce/flush, save/load theo project, backend scoped guards trong cùng transaction, navigation/Run/Source locks, reset RowPanel theo project và bỏ callback sau unmount. Component tests mount Svelte thật với happy-dom. Giới hạn: Run preparation dùng snapshot và lock trong một cửa sổ; không bảo vệ open_project từ client khác. Không claim cross-client scope cho save_overlays/start_run/retry/reprocess.

## Kiểm chứng đã chạy

- `npm test`: **25/25 PASS** (19 component + 6 textLayout), parent chạy lại trước commit.
- `npm run build`: PASS, parent chạy lại; còn warnings form-seeding `state_referenced_locally` đã biết.
- `npx tsc --noEmit`: PASS.
- `cargo test --lib`: **82/82 PASS**.
- `cargo test --test e2e batch_runs_end_to_end`: **1/1 PASS**.
- `cargo test --test media_ffmpeg`: **2/2 PASS**.
- `npm run test:ext`: **11/11 PASS**.
- Full `cargo test` vẫn FAIL ở `review_no_music_honors_original_mute`, peak `0.1299381`, thuộc Task 4. Không xóa/ignore regression.
- `git diff --check`: PASS trước commit.

RED/GREEN logs và báo cáo chi tiết giữ tại `.superpowers/sdd/2026-10-08-claude-code-finish-video-tool/`, gồm `task-3-report.md`, `task-3-checkpoint.md`, UI/Rust RED và verification logs. Scratch bị git-ignore; giữ nguyên.

## Việc đầu tiên khi resume

RunTab hiện `disabled={busy || !status.running}` và `act` bỏ qua action khi busy, nên **Tạm dừng bị chặn khi start_run chưa kết thúc encode**, dù engine đã emit running=true. Chưa viết test hoặc sửa finding này. Suite xanh hiện tại chưa kiểm chứng hành vi đó.

Viết deterministic RED component test với startRun pending và status.running=true: Pause phải enabled và gọi pauseRun. Giữ lock navigation cho đến khi cả start/pause settle; kiểm chứng cả hai thứ tự settlement. Cho Pause chạy độc lập trong lúc start pending, giữ guard cho duplicate start/retry/reprocess. Sau fix/tests, scoped review Task 3 trước khi đánh dấu hoàn tất hoặc sang Task 4.

## Native smoke và trạng thái môi trường

APPDATA/fixture riêng trong `task-3-smoke/`: quality1080p + Save ngay đã lưu named preset1080p; quality720p + chuyển Run ngay đã persist project720p trước hiển thị Run. `save-proof.json`, `run-proof.json`, `disk-proof.json` và screenshots đã kiểm tra. Start disabled, startRequests=0, rows Pending, jobId/raw/output null, không MP4. Không dùng quota Veo hoặc đổi preset/settings gốc.

Hai helper trees PID8768/19500 và app/Vite của smoke đã dừng; không còn listeners1420/9333/17890. Không đóng Chrome/Node ngoài task. Chưa build lại installer, không push/merge, không chỉnh extension.
