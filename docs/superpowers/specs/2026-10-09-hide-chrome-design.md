# Ẩn cửa sổ Chrome tạo video

Ngày 09/10/2026. Người dùng chọn hướng **"Ẩn hẳn + Chạy nền"** và đồng ý chạy thử 5 luồng (5 lượt Veo).

## Mục tiêu
- Cửa sổ Chrome đang chạy Google Vids biến mất khỏi màn hình và thanh taskbar.
- Các cửa sổ Chrome khác của người dùng không bị đụng tới.
- Tool tự hiện lại cửa sổ khi:
  - Google bắt đăng nhập (job bị từ chối);
  - tắt tool;
  - người dùng bỏ ẩn.
- Chế độ **"Chạy nền"** sẵn có của extension là cách làm được khuyên dùng thêm. Chế độ này chia sẻ tab Vids để Chrome không tạm dừng tab khi bị ẩn.
  - Chrome bắt người dùng tự chọn tab, nên tool **không bật hộ** chế độ này.
  - Hướng dẫn sử dụng chỉ cách bật.

Ngoài phạm vi:
- ẩn các cửa sổ Chrome khác;
- tự bật "Chạy nền";
- chạy Chrome headless.

## Thiết kế

**Bridge (extension, chỉ thêm, không đổi luồng tạo video):**
- `ensureVidsTab` đưa tab Vids vào **cửa sổ riêng**. Nếu cửa sổ chứa tab còn tab khác thì tạo cửa sổ mới bằng `chrome.windows.create({ tabId, focused: false })`. Việc này chuyển tab, không tải lại trang.
- Bridge báo cho tool `{"type":"window.info","windowId","left","top","width","height"}`, tính theo DIP như `chrome.windows.get` trả về. Có ba lúc gửi:
  - sau khi `ensureVidsTab` xong;
  - khi tool hỏi `{"type":"window.query"}`, nếu đang có tab Vids;
  - khi `chrome.windows.onBoundsChanged` báo cửa sổ đó đổi vị trí hoặc kích thước.
- Phải backup extension trước khi sửa; người dùng reload extension một lần.

**Tool:**
- `AppSettings.hide_chrome: bool`, mặc định `false`, lưu trong `%APPDATA%`.
- Engine giữ bounds mới nhất từ `window.info`. Mỗi lần nhận bounds:
  - nếu `hide_chrome` bật thì ẩn cửa sổ;
  - nếu tắt thì hiện.
- Khi nhận `job.rejected`: hiện cửa sổ để người dùng xử lý, ví dụ đăng nhập.
- Khi kết nối extension: gửi `window.query`.
- Khi app thoát (`RunEvent::Exit`): hiện cửa sổ.
- `chrome_window.rs` (Windows):
  - `EnumWindows` lấy các cửa sổ có class `Chrome_WidgetWin_1` và tiêu đề khác rỗng.
  - Cửa sổ khớp khi `GetWindowRect` trùng bounds × `GetDpiForWindow/96`, sai lệch không quá 8 px mỗi cạnh.
  - Ẩn bằng `ShowWindow(SW_HIDE)`, hiện bằng `ShowWindow(SW_SHOWNOACTIVATE)`.
  - Hàm so khớp là hàm thuần, có unit test.
  - Ngoài Windows thì không làm gì.
- Lệnh `set_hide_chrome(hide)` lưu setting và áp dụng ngay. `Status` thêm hai trường:
  - `hideChrome`;
  - `chromeWindow`: đã biết cửa sổ hay chưa.
- UI có nút trên header, hiện khi đã kết nối:
  - đang hiện thì nút là **"Ẩn Chrome"**;
  - đang ẩn thì nút là **"Hiện Chrome"**.

## Lỗi
- Không tìm thấy cửa sổ khớp: bỏ qua, không báo lỗi. Lần `window.info` sau sẽ thử lại.
- Tool bị tắt đột ngột khi cửa sổ đang ẩn: lần mở tool sau, extension kết nối lại, `window.query` trả bounds và tool áp dụng setting hiện tại, nên cửa sổ hiện lại nếu setting đã tắt. Bấm "Hiện Chrome" cũng hiện lại ngay.

## Kiểm thử
- Rust:
  - so khớp bounds, có DPI 100% và 150%, lệch nhỏ và lệch lớn;
  - engine nhận `window.info` thì lưu bounds;
  - `set_hide_chrome` lưu setting;
  - định dạng JSON của `window.info` và `window.query`.
- Bridge (Node):
  - tab Vids nằm chung cửa sổ với tab khác thì được chuyển ra cửa sổ riêng;
  - `window.info` gửi sau `ensureVidsTab` và khi có `window.query`.
- UI: nút Ẩn/Hiện Chrome gọi `set_hide_chrome` với giá trị đúng.
- Chạy thật:
  - 5 ảnh, 5 luồng, maxRetries 0, ẩn cửa sổ, **không bật Chạy nền** (trường hợp xấu nhất);
  - kiểm tra cửa sổ ẩn hẳn (`IsWindowVisible` = false), 5 video về đủ và đúng thứ tự;
  - hỏng thì dừng, không tốn thêm lượt.
