# Bản cài cho máy khách và nhiều ảnh cho mỗi prompt: kiểm chứng

Ngày 09/10/2026, Claude Code. Spec `docs/superpowers/specs/2026-10-09-customer-ready-design.md`, plan `docs/superpowers/plans/2026-10-09-customer-ready.md`.

## Bộ cài
- `src-tauri/target/release/bundle/nsis/1Click Video Tool_0.1.0_x64-setup.exe`: **198.2 MB**, SHA256 `1A82BD90DAEAB1BFE7F2B063F129756C395FE989FC6CB3205641A79C80316B4F`.
  - Build bằng `python scripts/fetch-vendor.py` rồi `cargo tauri build --config src-tauri/tauri.bundle.conf.json`. Code ứng với commit `0ce545e`.
- Bộ cài kèm theo:
  - Chromium 154.0.8037.98 (Hibbiki, SHA256 khớp release `0580f7a5…`);
  - FFmpeg 8.1 gpl-shared (BtbN, SHA256 khớp `4468dc0e…`);
  - extension (bridge byte-identical);
  - `THIRD_PARTY_NOTICES.txt` và `ffmpeg/LICENSE.txt`.
- Lần build đầu dùng resource dạng glob `**/*`, làm phẳng `chromium/154.0.8037.98` và `extension/assets`. Đổi sang khai báo theo thư mục, rồi kiểm tra lại cấu trúc trong `target/release` trước khi đóng gói.

## Chạy thật bằng bản release (exe trong `target/release`, tài nguyên nằm cạnh exe)
- `get_status`:
  - `ffmpeg` = `…\target\release\ffmpeg\ffmpeg.exe`: dùng FFmpeg kèm theo trước PATH;
  - `bundledBrowser: true`.
- **Mở trình duyệt Vids** chạy Chromium kèm theo với lệnh `--user-data-dir=%APPDATA%\1ClickVideoTool\chromium-profile --load-extension=<resource>\extension --no-first-run --no-default-browser-check https://docs.google.com/videos/create`.
  - Extension kèm theo (ID `hikmcgob…`) kết nối tool sau khi bấm "Quên extension". Máy này còn Chrome cài extension cũ có ID khác; máy khách mới không cần bước này.
  - Người dùng đăng nhập Google trong profile mới, Google không chặn.
- **3 prompt × 2 ảnh tham chiếu dùng chung** (dieu-giay.png, bai-bien.png), chế độ ảnh tham chiếu, 3 luồng, maxRetries 0, tự hậu kỳ: **3/3 Done**, cùng job `j1791513725871-1`, tốn 3 lượt Veo.
  - Đầu ra 1280×720, có audio, 10.0 s. Tên file `001_dieu-giay.mp4`… theo ảnh đầu tiên của prompt.
  - Cả 3 video có **con diều đỏ của ảnh 1 trên bãi biển có dừa của ảnh 2**, theo đúng prompt riêng (bay cao, hoàng hôn, mây), có chữ Tập 1–3. Xem [ảnh đối chiếu](2026-10-09-multi-image-contact.png): ảnh tham chiếu, rồi các khung giây 1, 4, 7.

## Kiểm tra tự động (đều exit 0)
- `cargo test`: unit 118, e2e 3, media 3.
- `npm test`: 62.
- `npx tsc --noEmit`.
- `npm run test:ext`: 16.
- Bridge trong git, trong extension đang cài và trong `src-tauri/vendor/extension` giống hệt nhau.
- Backup extension trước khi sửa bridge: `Vids_Automation_1ClickStudio_v1.1.10.0_backup_20261009_092034`.

## Ghi chú
- Chromium kèm theo không tự cập nhật; muốn bản mới thì đổi URL và SHA256 trong `scripts/fetch-vendor.py` rồi build lại.
- Extension của trình duyệt kèm theo có ID theo đường dẫn cài đặt, khác extension trong Chrome của người dùng. Tool tin extension kết nối đầu tiên (TOFU). Muốn chuyển qua lại thì bấm "Quên extension".
