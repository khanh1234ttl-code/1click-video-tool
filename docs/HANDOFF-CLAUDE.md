# Bàn giao cho Claude Code — 1Click Video Tool

Ngày 08/10/2026. Người dùng yêu cầu commit và viết kế hoạch để Claude Code làm tiếp.

Đọc `AGENTS.md`, `docs/HANDOFF-CODEX.md`, file này, rồi `docs/superpowers/plans/2026-10-08-claude-code-finish-video-tool.md`. Review toàn nhánh được lưu trong git tại `docs/reviews/2026-10-08-whole-branch-review.md`.

## Git và trạng thái

Làm tại `D:/1Click/Vids_Automation_1ClickStudio_v1.1.9.6/1click-video-tool`, nhánh `feat/video-tool`; chỉ commit cục bộ, không push/merge.

| Commit | Kết quả |
|---|---|
| `5dfec20` | Task 11 xong: bảng đủ chiều rộng, smoke app thật kéo/lưu preset và Run chưa kết nối. |
| `20066e2` | Bridge extension và tests bản đầu. |
| `eb72a95` | README tiếng Việt và hướng dẫn cài/đóng gói. |
| `3e27fa8` | Bridge sửa cancellation khi chuẩn bị/đợi ACK và download trong lúc khôi phục session; checkpoint trước refactor Rust. |
| `f23202f` | **WIP** regression tests và refactor engine một phần; Rust chưa compile. |

Kiểm tra mới nhất sau WIP:
- `npm test`: **6/6 PASS**.
- `npm run test:ext`: **11/11 PASS**, reconnect khoảng 5 giây.
- `cargo test --lib`: **FAIL compile**, 10 lỗi E0308: helpers trả `Effects = (u64, Vec<Effect>)`, nhưng `apply` và `submit` vẫn dùng `Vec<Effect>`.
- Trước WIP: Rust **41 unit + 1 e2e + 2 FFmpeg PASS**, UI build PASS.
- Chưa chạy generation thật, **chưa dùng quota Veo trong phiên này**.
- Review toàn nhánh có **7 Important findings**, chưa đóng.

## Phần sửa dở

`engine.rs`: tests concurrent edits/durable state và queued postprocess khi đổi project; thêm epoch/operation metadata, mutation/save transaction helpers. Nửa dưới `apply/submit/import_raw/post_process` còn luồng cũ. **Không bỏ epoch hoặc lấy riêng tuple .1 để làm compiler xanh mà bỏ ownership.**

`runner.rs`: tests stale rejection/revert, duplicate download/query, recovered running/failure guard, Save-before-Submit, đổi nhạc reprocess. Có sửa tương ứng, chưa kiểm chứng GREEN sau khi đổi engine.

`import.rs`: exact filename trước stem; stem mơ hồ trả unmatched, kèm regression a.jpg/a.png. Chưa kiểm chứng GREEN trong WIP.

`tests/e2e.rs`: `review_no_music_honors_original_mute` yêu cầu PCM peak < 0.00001 khi âm gốc 0% và không nhạc; media chưa sửa, dự kiến RED sau khi compile được.

`package.json`/lock: thêm happy-dom 20.14.5, chưa cấu hình môi trường hoặc viết Svelte component tests mới. Không khẳng định những tests mới đã có đủ RED/GREEN; compile failure đang che các assertions.

## Extension và backup

Folder ngoài git: `../Vids_Automation_1ClickStudio_v1.1.9.6`.
Backup trước sửa: `../Vids_Automation_1ClickStudio_v1.1.9.9_backup_20261008_201603`.
Đã đối chiếu 28 file backup; chỉ loader/manifest/FIX_NOTES đổi, thêm bridge. Content script `assets/index.ts-DUXzPPUe.js` và worker asset cũ không đổi.

Bridge trong git: `extension-bridge/assets/oneclick-bridge.js`, phải byte-identical bản cài; hướng dẫn `extension-bridge/README.md`. Task 12 scoped review đã chấp nhận cancellation/startup fixes; desktop vẫn cần stale-job filter.

Người dùng đã Reload và desktop nhận ID `bedjklgfehfcmlaldafbbdplgblpdpch`, version 1.1.10.0. **Bridge sửa thêm ở 3e27fa8 sau lần Reload đó: cần Reload thêm trước chạy thật.** Chỉ đề nghị khi core/test đã đạt.

## Bộ cài và môi trường

Installer đã build trước WIP:
`src-tauri/target/release/bundle/nsis/1Click Video Tool_0.1.0_x64-setup.exe`,
3,092,361 bytes, SHA256 `03E10C79A4F07D1498FEDC5AE3A7FFB1902606BD44FEB9238FD94715C3C20EAF`.
**Build lại sau fixes; installer cũ không chứng minh WIP build được.**

Windows 11, PowerShell, Rust MSVC, Node 26, FFmpeg/ffprobe PATH.
Git Bash thực `C:/Program Files/Git/bin/bash.exe`; bash trần có thể vào WSL.

App dev đã đóng để tránh khóa EXE khi cargo test. Không dừng Chrome hoặc các Node không thuộc dự án.
CDP: `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333`, `CHOKIDAR_USEPOLLING=true`, `cargo tauri dev`.
Polling tránh watcher EBUSY trên target DLL. `scripts/cdp.mjs` eval/shot dùng được; JS dùng slash / và async IIFE, không top-level await.

Fixture `.superpowers/sdd/2026-10-08-1click-video-tool/live-fixture`: 3 ảnh, music/nhac-thu.mp3, prompt chung camera slowly pushes in, gentle motion; text dòng 1 Tập 1; 720p 16:9, concurrency 3, **maxRetries 0**. Rows Pending, chưa raw/output.
Chrome download folder `E:/AFF cám/THÁNG 10`.

Scratch/ledger/log/screenshot trong `.superpowers/` bị git-ignore; giữ nguyên. Các yêu cầu quan trọng đã được đưa vào tài liệu git. Không lặp scaffold hoặc Tasks 1–10.

