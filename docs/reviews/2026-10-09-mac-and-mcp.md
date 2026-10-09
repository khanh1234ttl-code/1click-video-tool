# macOS và MCP: kiểm chứng

Ngày 09/10/2026, Claude Code. Spec `docs/superpowers/specs/2026-10-09-mac-and-mcp-design.md`, plan `docs/superpowers/plans/2026-10-09-mac-and-mcp.md`.

## MCP: chạy thật trên Windows (không tốn lượt Veo)
Bản release `e629f98`. Cổng điều khiển nghe trên `127.0.0.1:17891`. `scripts/mcp-smoke.mjs` đóng vai agent: mở `oneclick-video-tool.exe --mcp` và gửi lệnh qua stdio.
- `initialize` trả về `1click-video-tool`, giao thức 2025-06-18. `tools/list` có đủ 19 tools.
- `status`: extension đã kết nối v1.1.10.0, có FFmpeg, có trình duyệt kèm theo.
- `open_project` (bản sao dự án 3 video đã tạo), rồi `list_images` cho ra `bai-bien.png`, `dieu-giay.png`.
- `add_prompts` (2 prompt, 2 ảnh dùng chung, text Tập 4/5) thêm dòng 4 và 5.
- `set_settings` đổi `text.fontSize` từ 64 lên 72 và đặt prompt chung.
- `export_videos [1,2,3]`: engine phát `render-overlays`, cửa sổ tool vẽ chữ rồi báo `overlays_rendered`, sau đó tool xuất lại.
  - `wait_until_idle`: 3 dòng Done, file Output mới lúc 10:59.
  - Chữ trong file xuất lại to hơn bản trước đúng tỉ lệ 72/64 ([so sánh](2026-10-09-mcp-text-compare.png): trên là bản cũ, dưới là bản do agent xuất).
- `delete_rows [4,5]` xoá được, `get_project` còn lại 3 dòng.
- Khi tool chưa mở, `--mcp` vẫn trả lời `initialize` bình thường, còn tool call trả `isError` kèm câu "Hãy mở 1Click Video Tool…", không bị treo.
- Có test tự động cho cổng điều khiển:
  - không có token, sai token, hoặc có Origin thì bị từ chối;
  - các lệnh hoạt động đúng;
  - chờ cửa sổ vẽ chữ, và báo lỗi khi hết giờ.

## macOS
- Code đã chạy được trên cả hai hệ điều hành: tên file ffmpeg/ffprobe, đường dẫn `Chromium.app`, Ẩn Chrome qua bridge `window.state` (thu nhỏ), ghép đường dẫn trong UI. Có test cho từng phần.
- `scripts/fetch-vendor.py --platform mac-arm64|mac-x64` (ungoogled-chromium 154.0.8037.97, FFmpeg 9.0.2 của martin-riedl.de, SHA256 cố định) và `scripts/build-mac.sh` (ký tạm ad hoc, tạo dmg).
- **Chưa build và chưa chạy thật trên Mac**, vì máy này là Windows. Cần kiểm tra trên Mac:
  - build;
  - đăng nhập Google trên Chromium kèm theo;
  - tạo 1 video;
  - xuất video;
  - nút Ẩn Chrome (thu nhỏ).
- Lỗi phát hiện trong lúc làm: chạy `--platform mac` trên Windows từng xoá `src-tauri/vendor` trước khi báo lỗi. Đã tạo lại thư mục này và chuyển bước kiểm tra nền tảng lên trước mọi thao tác xoá.

## Kiểm tra tự động (đều exit 0)
- `cargo test`: unit 128, e2e 3, media 3.
- `npm test`: 68.
- `npx tsc --noEmit`.
- `npm run test:ext`: 17.
- Bridge giống hệt nhau ở ba nơi: trong git, trong extension đang cài, trong `vendor`.
- Backup extension: `..._v1.1.10.0_backup_20261009_103751`.

Bộ cài Windows: 198.4 MB, SHA256 `F3DC5C5A86DCA244EF8E17F0C11E07B085F0025CB65473FC0B3D95EC0EDCDC0F` (code `e629f98`).
