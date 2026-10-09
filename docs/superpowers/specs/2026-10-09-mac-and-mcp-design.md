# Chạy trên macOS và kết nối MCP cho agent

Ngày 09/10/2026. Yêu cầu của người dùng:
- tool chạy được trên Mac, **không ký và notarize với Apple**, chỉ dùng local;
- thêm **kết nối MCP để agent điều khiển tool**, chạy được cả trên Mac lẫn Windows.

## A. macOS

**Code dùng chung cho cả hai hệ điều hành:**
- Tìm FFmpeg: trên Windows tìm `ffmpeg.exe`/`ffprobe.exe`, trên Mac tìm `ffmpeg`/`ffprobe`. Lệnh chọn thư mục FFmpeg báo đúng tên file theo từng hệ điều hành.
- Trình duyệt kèm theo:
  - Windows: `chromium/chrome.exe`;
  - Mac: `chromium/Chromium.app/Contents/MacOS/Chromium`.
  - Tham số dòng lệnh giữ nguyên trên cả hai.
- **Ẩn Chrome**:
  - Windows giữ cách `ShowWindow` đang dùng.
  - Mac: tool gửi bridge `{"type":"window.state","state":"minimized"|"normal"}`, bridge gọi `chrome.windows.update(trackedWindow, {state})`. Thao tác này không cần quyền Accessibility.
  - Trên Mac, cửa sổ chỉ thu nhỏ vào Dock chứ không biến mất hẳn. Hướng dẫn ghi rõ điều này.
- UI không viết cứng dấu `\`. Đường dẫn như `Output` và `_1click/raw` được ghép bằng dấu phân cách lấy từ `imageDir`.
- `scripts/fetch-vendor.py --platform mac-arm64|mac-x64`:
  - FFmpeg cho Mac: bản tĩnh 9.0.2 của ffmpeg.martin-riedl.de (có libx264), gồm `ffmpeg.zip` và `ffprobe.zip`. SHA256 cố định trong script: arm64 `c8ed4c4e…`/`fcbe8395…`, amd64 `7c6b4125…`/`2322438e…`.
  - Chromium: `ungoogled-chromium_154.0.8037.97-1.1_{arm64|x86_64}-macos.dmg`, SHA256 `43804c21…4586` (arm64) và `5e11f07b…8cf9` (x64). Mở bằng `hdiutil`, copy `Chromium.app`.
  - Script chỉ chạy trên Mac.
- `tauri.bundle.mac.conf.json`: resources như bản Windows, target `dmg`/`app`.
- Không ký Apple, nên khi cài người dùng chạy lệnh sau một lần (README có ghi):
  `xattr -dr com.apple.quarantine "/Applications/1Click Video Tool.app"`
- Build và chạy thử thật phải làm trên máy Mac. Máy Windows này chỉ chuẩn bị code, cấu hình và test.

## B. MCP: agent điều khiển tool

**Kiến trúc:**
- Tool đang mở là nơi giữ trạng thái. Nó mở thêm một **cổng điều khiển** WebSocket tại `127.0.0.1:17891`.
  - Kết nối phải gửi kèm token trong header `Authorization: Bearer <token>`. Token sinh ngẫu nhiên, lưu ở `<app_dir>/control-token`, chỉ người dùng hiện tại đọc được.
  - Kết nối nào có header `Origin` (tức là từ trang web) đều bị từ chối.
- **Server MCP** là chính file chạy của tool, mở với tham số `--mcp`:
  - giao thức MCP qua stdio (JSON-RPC 2.0, mỗi dòng một thông điệp);
  - đọc token rồi nối vào cổng điều khiển;
  - tool chưa mở thì báo lỗi tiếng Việt "Hãy mở 1Click Video Tool trước".
- Cấu hình cho agent:
  - Claude Code: `claude mcp add oneclick -- "<đường dẫn app>" --mcp`;
  - Claude Desktop: thêm `mcpServers.oneclick = {command, args:["--mcp"]}`;
  - Codex: thêm `[mcp_servers.oneclick]` gồm `command` và `args`.
  - UI có mục **"Kết nối agent (MCP)"** trong menu đèn Extension. Mục này hiện sẵn các lệnh trên với đường dẫn file chạy thật, có nút Copy.

**Tools MCP** (tên tiếng Anh, mô tả tiếng Việt):

| Tool | Làm gì |
|---|---|
| `status` | Trạng thái kết nối extension, FFmpeg, đang chạy hay không, tóm tắt dự án. |
| `open_project {folder}` | Mở folder ảnh. |
| `get_project` | Liệt kê các dòng (STT, tên ảnh, prompt, text, nhạc, trạng thái, file đầu ra) và thiết lập. |
| `list_images` | Liệt kê ảnh trong kho. |
| `add_prompts {prompts[], images?[], texts?[]}` | Thêm một dòng cho mỗi prompt; `images` dùng chung cho mọi dòng mới. |
| `update_rows {rows:[{stt, prompt?, text?, images?, music?}]}` | Sửa từng phần của các dòng. |
| `delete_rows {stts}` | Xoá dòng. |
| `assign_images {images, rule, stts?}` | Gán ảnh hàng loạt. |
| `set_settings {...}` | Gộp một phần thiết lập: gen, commonPrompt, text, music, output. |
| `apply_text_template {template, stts?}` | Đặt text theo mẫu. |
| `assign_music_in_order {stts?}` | Gán nhạc lần lượt. |
| `import_table {path}` | Nhập file Excel/CSV. |
| `start_generation` | Bắt đầu tạo. **Tốn lượt Veo**; mô tả tool nói rõ điều này. |
| `stop_generation` | Dừng. |
| `retry_failed {stts?}` | Thử lại các dòng lỗi. |
| `export_videos {stts?}` | Xuất video. |
| `wait_until_idle {timeoutSeconds}` | Chờ tới khi hết dòng đang chạy hoặc hết giờ, rồi trả tóm tắt. |
| `open_vids_browser` | Mở trình duyệt Vids kèm theo. |
| `set_hide_chrome {hide}` | Ẩn hoặc hiện cửa sổ Chrome. |

- Tên ảnh trong `images` khớp với kho ảnh theo cùng quy tắc như Excel. Cũng nhận đường dẫn tuyệt đối.
- **Chữ trên video vẫn do UI vẽ** bằng canvas. Khi agent gọi `export_videos`, hoặc `start_generation` lúc đang bật tự hậu kỳ:
  - engine phát sự kiện `render-overlays {requestId, stts}` cho cửa sổ tool;
  - UI vẽ chữ, gọi `save_overlays`, rồi báo `overlays_rendered {requestId, error?}`;
  - engine chờ tối đa 60 giây.
  - Tool phải đang mở (nó vốn là điều kiện để có cổng điều khiển).
- Đồng bộ preset: khi backend có preset mới do agent đổi, `PresetStore` nhận preset đó **nếu UI không có thay đổi chưa ghi**. Nếu UI đang có thay đổi chưa ghi thì giữ thay đổi của UI; lần ghi kế tiếp của UI ghi đè.

**An toàn:**
- Chỉ nghe trên 127.0.0.1, bắt buộc token, chặn kết nối có Origin.
- Mô tả của `start_generation` và `retry_failed` ghi rõ "tốn lượt Veo".

## Kiểm thử
- Rust:
  - tên file chạy theo hệ điều hành;
  - đường dẫn Chromium cho Mac;
  - ở chế độ Mac, ẩn Chrome sinh lệnh `window.state`.
  - Cổng điều khiển:
    - từ chối khi sai token hoặc có Origin;
    - `open_project`, `add_prompts`, `set_settings` (gộp từng phần), `get_project`;
    - `export_videos` đi qua `render-overlays`, sau khi UI báo xong thì gọi reprocess;
    - hết giờ chờ UI thì báo lỗi.
  - MCP stdio: `initialize`, `tools/list` đủ tên tools, `tools/call` chuyển tiếp đúng (dùng control giả), lỗi trả `isError`.
- Bridge: `window.state` cập nhật cửa sổ đang theo dõi.
- UI:
  - nhận `render-overlays` thì vẽ chữ và báo `overlays_rendered`;
  - `PresetStore.adopt` khi không có thay đổi chưa ghi;
  - ghép đường dẫn bằng `/` trên Mac.
- Chạy thật trên Windows: Claude Code trên máy này thêm server MCP rồi gọi `status`, `open_project`, `add_prompts`, `get_project` và `export_videos` (xuất lại video đã có nên không tốn lượt Veo).
