# Bộ cài cho máy khách, và nhiều ảnh cho mỗi prompt

Ngày 09/10/2026. Người dùng chụp màn hình máy khách: báo "Thiếu FFmpeg" và "Extension chưa kết nối".

Người dùng đã chọn:
- **Chromium 154 ổn định** (Hibbiki/chromium-win64, có H.264) kèm bộ cài, không dùng Chrome for Testing;
- **FFmpeg 8.1 gpl-shared** (BtbN);
- **"Mỗi dòng là 1 prompt"**, mỗi prompt có 0–10 ảnh.

Spike ngày 09/10:
- Chromium 154 nạp được extension bằng `--load-extension` (Chrome thường 137+ đã gỡ cờ này).
- Người dùng đăng nhập Google trên Chromium được, Google không chặn.

## A. Trình duyệt Vids kèm tool (Chromium + extension)
- Bộ cài chứa `resources/chromium/` (Chrome-bin của Chromium 154) và `resources/extension/` (bản extension hiện tại có bridge).
- Profile riêng nằm ở `%LOCALAPPDATA%\1ClickVideoTool\chromium-profile`. Đăng nhập Google một lần thì profile giữ lại cho các lần sau.
- Tool mở trình duyệt bằng lệnh:
  `chrome.exe --user-data-dir=<profile> --load-extension=<resources\extension> --no-first-run --no-default-browser-check https://docs.google.com/videos/create`
  - Nếu trình duyệt đang chạy với profile này thì Chromium tự mở tab trong cửa sổ đang có.
- Khi nào tool mở trình duyệt:
  - nút **"Mở trình duyệt Vids"** trong menu đèn Extension;
  - tự động khi tool khởi động, nếu có Chromium kèm theo mà sau **8 giây** extension vẫn chưa kết nối. Máy đã có Chrome cài extension sẽ không bị mở thêm.
- Không có Chromium kèm theo (bản dev) thì không hiện nút, không tự mở.
- Lệnh `open_vids_browser()` trả lỗi tiếng Việt nếu thiếu file.
- Tính năng **Ẩn Chrome** áp dụng nguyên cho cửa sổ Chromium, vì class cửa sổ giống Chrome.
- Lấy file vendor: script `scripts/fetch-vendor.py` tải, kiểm tra SHA256 (giá trị cố định trong script), rồi giải nén vào `src-tauri/vendor/{chromium,ffmpeg}`. Thư mục này git-ignore. Bộ cài lấy file từ đây.
- `THIRD_PARTY_NOTICES.txt` trong bộ cài nêu Chromium (BSD, nguồn chromium.org, bản build của Hibbiki) và FFmpeg (GPL, kèm `LICENSE.txt` của FFmpeg và link mã nguồn n8.1).

## B. FFmpeg kèm theo
- `resources/ffmpeg/` chứa `ffmpeg.exe`, `ffprobe.exe` và các DLL (không đóng ffplay).
- Thứ tự tìm ffmpeg/ffprobe: thư mục người dùng tự chọn, rồi **bản kèm theo**, rồi PATH. Máy khách vì vậy không còn báo "Thiếu FFmpeg".

## C. Mỗi dòng là 1 prompt, 0–10 ảnh
- `Row.images: Vec<PathBuf>` thay cho `image_path`.
  - `project.json` cũ có `imagePath` thì tự đổi thành `images: [imagePath]`.
  - Mở folder mới: mặc định mỗi ảnh một dòng, giống hiện nay.
- Folder ảnh là **kho ảnh**. Lệnh `list_images()` trả các ảnh trong folder, theo tên tự nhiên.
- Quản lý dòng:
  - `add_rows(n)` thêm dòng trống, STT = STT lớn nhất + 1.
  - `delete_rows(stts)` xoá dòng không đang chạy. Không đánh số lại; STT là định danh của dòng và của tên file đầu ra.
- Gán ảnh:
  - `set_row_images(stt, images)` gán cho một dòng.
  - `assign_images(images, rule, stts)` gán hàng loạt. `stts` rỗng nghĩa là mọi dòng. `rule` là một trong ba:
    - `all`: mọi dòng chọn được dùng cùng bộ ảnh. Ví dụ 2 ảnh tham chiếu cho 10 prompt.
    - `roundRobin`: dòng thứ i nhận ảnh thứ (i mod n), mỗi dòng 1 ảnh.
    - `onePerImage`: thêm một dòng mới cho mỗi ảnh đã chọn.
- **Dán nhiều prompt**: nếu số dòng dán vào nhiều hơn số dòng còn lại tính từ dòng bắt đầu, tool tự thêm dòng mới. Dòng mới chưa có ảnh.
- **Excel/CSV**: dòng dữ liệu thứ i là prompt thứ i (theo STT tăng dần); thiếu dòng thì tool tự thêm.
  - Cột `anh` không bắt buộc. Nếu có, ghi **danh sách tên ảnh** trong kho, cách nhau bằng `;`, `,` hoặc xuống dòng, khớp theo tên có hoặc không có đuôi.
  - Tên không có trong kho được báo lại.
  - Ô trống không xoá dữ liệu đang có.
  - Cập nhật file mẫu, test và hướng dẫn theo quy tắc này.
- Kiểm tra khi bấm **Bắt đầu tạo**:
  - Chế độ khung đầu: mỗi dòng đúng 1 ảnh.
  - Chế độ ảnh tham chiếu: mỗi dòng có 1–10 ảnh.
  - Sai thì báo kèm danh sách STT, ví dụ "Dòng 3, 7 chưa có ảnh", và không gửi gì.
- Gửi job:
  - Mỗi ảnh khác nhau chỉ gửi **một lần** (`image.put`), kể cả khi 10 prompt dùng chung.
  - Mỗi item mang `imageIds: [...]`, giữ thêm `imageId` = ảnh đầu để bridge cũ vẫn chạy.
  - Bridge đọc `imageIds` (không có thì dùng `[imageId]`), chuẩn bị mỗi ảnh một lần, rồi gửi `payload.imageIds` cho content script. Content script đã hỗ trợ mảng này.
- Tên file đầu ra: `{stt:03}_{tên ảnh đầu}.mp4`; dòng không có ảnh thì `{stt:03}_prompt.mp4`.
- UI bước 1:
  - Bảng có ô tick, STT, **ảnh** (tối đa 3 ảnh nhỏ, kèm "+k"; bấm vào để mở bộ chọn ảnh của dòng đó), prompt, trạng thái, Xem.
  - Thanh công cụ thêm **Thêm dòng**, **Gán ảnh…** và **Xoá dòng đã tick**.
  - Bộ chọn ảnh là lưới ảnh của kho, chọn nhiều ảnh, thứ tự theo lần bấm. Có các nút "Cho dòng này", "Cho mọi dòng", "Cho dòng đã tick", "Xoay vòng", "Tạo 1 dòng cho mỗi ảnh".
- UI bước 2: dùng ảnh đầu tiên làm ảnh nhỏ và làm nền xem trước khi dòng chưa có video gốc.

## Ngoài phạm vi
- Khung đầu + khung cuối (2 ảnh ở chế độ khung đầu).
- Prompt không có ảnh, tức chế độ chỉ có chữ.
- Tự cập nhật Chromium.

## Kiểm thử
- Rust:
  - đọc `project.json` cũ (imagePath) ra `images`;
  - `assign_images` với cả ba rule;
  - `add_rows` / `delete_rows` (không xoá dòng đang chạy);
  - dán prompt tự thêm dòng;
  - Excel nhiều ảnh, có ảnh không khớp, tự thêm dòng;
  - kiểm tra số ảnh khi Bắt đầu cho từng chế độ;
  - gửi job: ảnh trùng chỉ `image.put` một lần, `imageIds` đúng;
  - tên file đầu ra khi không có ảnh;
  - `find_tool` ưu tiên bản kèm theo khi không có setting;
  - dựng đúng lệnh mở trình duyệt.
- Bridge (Node): item có `imageIds` nhiều ảnh thì mỗi ảnh chỉ `PREPARE_IMAGE` một lần và payload có đủ imageIds; item kiểu cũ chỉ có `imageId` vẫn chạy.
- UI: bộ chọn ảnh gọi đúng lệnh với từng rule; Thêm dòng / Xoá dòng; kiểm tra số ảnh.
- Chạy thật trong Chromium kèm theo, với profile đã đăng nhập: **2 ảnh tham chiếu cho 3 prompt**, maxRetries 0, tốn 3 lượt Veo.
- Đo kích thước bộ cài.
