# Bàn giao cho Claude Code — 1Click Video Tool

Ngày 08/10/2026. Người dùng yêu cầu commit và viết kế hoạch để Claude Code làm tiếp.

Đọc `AGENTS.md`, `docs/HANDOFF-CODEX.md`, file này, rồi `docs/superpowers/plans/2026-10-08-claude-code-finish-video-tool.md`. Review toàn nhánh được lưu trong git tại `docs/reviews/2026-10-08-whole-branch-review.md`.

## Cập nhật 09/10/2026 (4): macOS và MCP cho agent

- **MCP**:
  - `<app> --mcp` là server MCP qua stdio (`src-tauri/src/mcp.rs`, 19 tools), chuyển tiếp tới cổng điều khiển `127.0.0.1:17891` (`control.rs`, cần token `control-token`, chặn kết nối có Origin).
  - Chữ trên video vẫn do UI vẽ, theo luồng sự kiện `render-overlays` rồi `overlays_rendered`.
  - UI có khung "Kết nối agent (MCP)" hiện lệnh cho Claude Code, Claude Desktop và Codex.
  - Đã chạy thật trên Windows bằng `scripts/mcp-smoke.mjs`; xem `docs/reviews/2026-10-09-mac-and-mcp.md`.
- **macOS**:
  - code dùng chung cho hai hệ điều hành;
  - `fetch-vendor.py --platform mac-*`, `tauri.bundle.mac.conf.json`, `scripts/build-mac.sh` (ký tạm ad hoc, không cần tài khoản Apple);
  - **chưa build và chưa chạy thử trên Mac**.
- Bộ cài Windows: 198.4 MB, SHA256 `F3DC5C5A…DC0F` (code `e629f98`).
- Kiểm tra:
  - `cargo test`: unit 128, e2e 3, media 3;
  - `npm test`: 68;
  - `test:ext`: 17.

## Cập nhật 09/10/2026 (3): bản cài cho máy khách, nhiều ảnh cho mỗi prompt

- **Bộ cài kèm Chromium 154, extension và FFmpeg 8.1**, nặng 198.2 MB, SHA256 `1A82BD90…6B4F`, code `0ce545e`.
  - Lệnh build: `python scripts/fetch-vendor.py` rồi `cargo tauri build --config src-tauri/tauri.bundle.conf.json`. `src-tauri/vendor/` và `vendor-dl/` được git-ignore.
  - Tool tự mở trình duyệt Vids (profile `%APPDATA%ClickVideoTool\chromium-profile`) nếu sau 8 s chưa có extension kết nối. Mở bằng tay: đèn Extension → Mở trình duyệt Vids.
- **Mỗi dòng là 1 prompt, 0–10 ảnh**:
  - `Row.images`; project cũ có `imagePath` vẫn mở được;
  - `add_rows`, `delete_rows`, `assign_images` (all / roundRobin / onePerImage);
  - Excel theo thứ tự, cột `anh` ghi nhiều ảnh cách nhau bằng `;`;
  - kiểm tra số ảnh theo chế độ khi bắt đầu;
  - ảnh dùng chung chỉ upload một lần (`imageIds`). Bridge đã cập nhật, backup `..._backup_20261009_092034`.
- Chạy thật: 3 prompt × 2 ảnh tham chiếu trong Chromium kèm theo cho **3/3 Done**, video kết hợp đúng cả 2 ảnh. Xem `docs/reviews/2026-10-09-customer-ready-live.md`.
- Kiểm tra:
  - `cargo test`: unit 118, e2e 3, media 3;
  - `npm test`: 62;
  - `test:ext`: 16;
  - tsc đạt.
- Máy dev này hiện **tin extension của Chromium kèm theo** (`hikmcgob…`). Muốn dùng lại Chrome cũ thì bấm "Quên extension".

## Cập nhật 09/10/2026 (2): ẩn Chrome, hướng dẫn, Excel mẫu

- **Hướng dẫn**: `docs/guide/huong-dan.html`, nguồn ở `huong-dan.src.html` (ảnh nhúng từ screenshots). Đã publish dạng artifact riêng tư.
- **Excel mẫu**: `samples/` gồm theo tên ảnh (xlsx, csv) và theo thứ tự (xlsx). Test `shipped_samples_import_as_documented` giữ mẫu luôn khớp tool.
- **Ẩn Chrome**: spec `docs/superpowers/specs/2026-10-09-hide-chrome-design.md`, plan `docs/superpowers/plans/2026-10-09-hide-chrome.md`.
  - Bridge (extension) chạy Vids trong cửa sổ riêng và gửi `window.info`. Backup trước khi sửa: `../Vids_Automation_1ClickStudio_v1.1.10.0_backup_20261009_074904`.
  - Tool khớp cửa sổ theo bounds × DPI rồi `ShowWindow`. Tự hiện lại khi job bị từ chối và khi thoát tool.
  - Nút **Ẩn/Hiện Chrome** trên header, setting `hideChrome`.
  - Chạy thật 5 luồng với cửa sổ ẩn, không bật Chạy nền: **5/5 Done**. Xem `docs/reviews/2026-10-09-hide-chrome-live.md`.
- Bộ cài: **3,135,521 bytes**, SHA256 `B1B1932FC928B9BDE91D03BACBF591BE49C50A2B7D8DCBD96DB254A58F27903D` (code `4e806b7`).
- Kiểm tra:
  - `cargo test`: unit 108, e2e 3, media 3;
  - `npm test`: 57;
  - `test:ext`: 15;
  - tsc đạt.

## Cập nhật 09/10/2026: giao diện 2 bước

Theo yêu cầu người dùng:
- spec `docs/superpowers/specs/2026-10-09-two-step-ui-design.md`;
- plan `docs/superpowers/plans/2026-10-09-two-step-ui.md`, làm inline.

Những gì đã làm:
- **1. Tạo video** chỉ tạo video gốc. Trạng thái mới là `generated` ("Đã tạo"). Có ô tick tự hậu kỳ `gen.autoPostProcess`, mặc định tắt.
- **2. Hậu kỳ** làm text + nhạc, xem trước trên chính video đã tạo, xuất được nhiều lần.
- Công cụ hàng loạt: Dán nhiều text, Text theo mẫu `{stt}`/`{ten}`, Gán nhạc lần lượt, Excel không có cột `anh` thì khớp theo thứ tự.
- Khung 9:16 hiển thị đúng tỉ lệ. Preset và đèn Extension/FFmpeg nằm trên header.
- Không sửa extension.

Kiểm chứng: xem `docs/reviews/2026-10-09-two-step-ui-check.md`.
- `cargo test`: unit 103, e2e 3, media 3.
- `npm test`: 56.
- `test:ext`: 11.
- build và tsc đạt.

Bộ cài mới: `src-tauri/target/release/bundle/nsis/1Click Video Tool_0.1.0_x64-setup.exe`,
**3,132,119 bytes**, SHA256 `8180F5441CCEBFD359A4AF8A9DE9CF00CDB6929A67CBDDD01B57839C809C75CD` (code `1d815c1`).

Review cuối là self-review, không có reviewer độc lập (xem ledger `.superpowers/sdd/2026-10-09-two-step-ui/progress.md`).

## Trạng thái cuối: kế hoạch Claude Code hoàn tất (Tasks 1–8)

Ngày 08/10/2026, Claude Code đã làm xong Tasks 3–8. Nhánh `feat/video-tool`, chỉ commit cục bộ, không push/merge.

- **Task 3** (`7903573`, `acffcde`): Tạm dừng vẫn bấm được khi start_run còn chuẩn bị; khóa chuyển tab giữ đến khi cả hai lệnh xong. Có 5 test component RunTab.
- **Task 4** (`0d4e465`): Âm gốc được áp dụng cả khi không có nhạc. Âm gốc 0% cho ra im lặng; 50% cho đỉnh âm giảm một nửa.
- **Task 5** (`d6363e6`): TextPreview vẽ lại khi đổi khung và bỏ lần vẽ cũ. Bấm Start khi thiếu ffmpeg hoặc ffprobe thì báo lỗi trước khi gửi prompt. Vite bỏ qua `src-tauri/`.
- **Task 6** (`5d5966c`): 7 Important đều có regression đạt. Xem `docs/reviews/2026-10-08-fix-verification.md`.
- **Task 7** (`c5c53bf`): **chạy thật đạt 3/3**, dùng đúng 3 lượt Veo.
  - Kết quả đúng thứ tự, có text riêng từng dòng, nhạc trộn dưới âm gốc, 1280×720, dài 10 s.
  - Xem `docs/reviews/2026-10-08-live-run.md`.
  - Vite dev từng crash vì EBUSY dưới `.superpowers/`; đã cho bỏ qua thư mục này.
- **Task 8**: README cập nhật theo hành vi đã kiểm chứng (Tạm dừng, âm gốc/nhạc, khôi phục, ffprobe). Bộ cài mới:
  `src-tauri/target/release/bundle/nsis/1Click Video Tool_0.1.0_x64-setup.exe`,
  **3,127,808 bytes**, SHA256 `EDAA8FDC74220EED8190DAE464E2880349EFC7804306F93EB1F3FFFAC38E7136`, build lại sau các sửa Minor và đổi tên nút (code = `f0ecd8c`).
- **Sau Task 8** đã sửa 4 Minor, mỗi lỗi có test RED → GREEN:
  - `f16687b`: bóng chữ khi viền 0;
  - `9da6943`: "Dán nhiều prompt" điền từ dòng đang chọn;
  - `169939c`: TOFU atomic;
  - `72012d8`: dự án bị di chuyển được rebase mọi đường dẫn.

Kiểm chứng cuối (đều exit 0):
- `cargo test`: unit 90, e2e 2, media_ffmpeg 3.
- `npm test`: 38/38.
- `npx tsc --noEmit`.
- `npm run test:ext`: 11/11.
- `cargo tauri build`.

Người dùng đã quyết định (09/10/2026):
- Nút "Tạm dừng" đổi tên thành **Dừng** (`f0ecd8c`), vẫn hủy job như cũ; không làm tạm dừng mềm.
- Tên đầu ra giữ cố định `{stt:03}_{tên ảnh}.mp4`.

Các mục bên dưới là lịch sử của những checkpoint trước, không phải trạng thái hiện tại.

## Tasks 1–2 đã hoàn tất

Task 2 ở `f7690a7`, scoped review **Approved**, không có findings. Sửa import stem có dấu chấm (`A.V1` khớp `a.v1.png`), thêm 9 regression tests cho mapping và runner recovery/reprocess. **79/79 unit**, batch e2e **1/1**, media **2/2** đạt. Full suite vẫn chỉ lỗi mute của Task 4. Xem `docs/reviews/2026-10-08-task-2-verification.md`. Task 3 hiện tạm dừng WIP như cập nhật trên.

Ngày 08/10/2026, người dùng yêu cầu Codex thực hiện Task 1. Code ở `78ed1fe` và bản sửa sau review `d2a708f`. Scoped re-review **Approved**, không còn Critical/Important của Task 1. Rust đã compile; **70/70 unit**, pipeline extension giả + FFmpeg thật **1/1**, media FFmpeg **2/2** đạt. `cargo test` đầy đủ còn đúng regression `review_no_music_honors_original_mute` thất bại (peak 0.1299381), thuộc Task 4 chưa sửa. Không xóa/ignore test đó.

Xem `docs/reviews/2026-10-08-task-1-verification.md`. Các mô tả WIP `f23202f` bên dưới là lịch sử, không còn là trạng thái compiler hiện tại. Không claim toàn kế hoạch hoặc bộ cài mới đã hoàn tất; chưa chạy Veo thật.

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

