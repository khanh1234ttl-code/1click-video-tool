# 1Click Video Tool

Làm video hàng loạt trên Windows: folder ảnh + prompt → extension Vids Automation tạo video Veo trên Google Vids → tool chèn text, nhạc nền và xuất từng video.

## Cần có

- Chrome đã cài extension **Vids Automation – 1 Click Studio v1.1.10.0+** và đăng nhập tài khoản Google dùng được Google Vids.
- FFmpeg gồm `ffmpeg.exe` và `ffprobe.exe` trong PATH, hoặc chọn thư mục chứa cả hai qua đèn **Extension** → **Chọn thư mục FFmpeg**. Bộ cài tool không kèm FFmpeg.

## Cài đặt và kết nối extension

1. Cài 1Click Video Tool bằng file `1Click Video Tool_0.1.0_x64-setup.exe`.
2. Nếu extension hiện có chưa được bổ sung bridge, làm theo [hướng dẫn cài bridge](extension-bridge/README.md). Sao lưu toàn bộ extension trước khi sửa; hướng dẫn này chỉ thêm module bridge, giữ nguyên luồng tạo video hiện có.
3. Trong Chrome, mở `chrome://extensions`, tìm **Vids Automation – 1 Click Studio** và bấm **Reload** sau khi cập nhật bridge hoặc manifest.
4. Mở tool. Chờ đèn **Extension v1.1.10.0** (hoặc mới hơn) màu xanh trên đầu cửa sổ. Mở Google Vids và hoàn tất đăng nhập nếu cần.

## Dùng

Tool có hai bước, chuyển bằng hai nút trên đầu cửa sổ. Ô **Preset** (nạp / đặt tên + **Lưu**) cũng nằm trên đầu. Bấm đèn **Extension** để xem trạng thái, **Quên extension** hoặc **Chọn thư mục FFmpeg**.

### 1. Tạo video
- Bấm **Chọn folder ảnh**. Ảnh được sắp theo tên tự nhiên (1, 2, 10…), mỗi ảnh là một dòng.
- Nhập prompt bằng một trong các cách:
  - sửa thẳng trong bảng;
  - **Dán nhiều prompt** (mỗi dòng một prompt, điền từ dòng đang chọn);
  - **Prompt chung** cho các dòng chưa có prompt riêng;
  - **Nhập Excel/CSV** (xem bên dưới).
- Hàng cài đặt gồm: chế độ (ảnh làm khung đầu / ảnh tham chiếu), tỉ lệ 16:9 / 9:16, chất lượng, số luồng, **Tự thử lại** (extension tự tạo/tải lại video lỗi).
- Bấm **Bắt đầu tạo**. Tab Google Vids có thể để ẩn.
  - Trạng thái chạy qua `Chờ → Đang gửi → Render n% → Đã tạo`.
  - Dòng **Đã tạo** đã có video gốc; bấm **Xem** để mở video đó.
  - **Mở folder video gốc** mở `<folder ảnh>\_1click
aw`.
- **Dừng** hủy các video đang tạo: dòng chưa xong trở về **Chờ**, chạy lại sẽ tốn lượt Veo. Dòng đã tạo không bị ảnh hưởng.
- Dòng lỗi: bấm **Thử lại** trên dòng đó, hoặc **Thử lại N dòng lỗi**.
- Tick **Tự hậu kỳ luôn sau khi tạo** nếu muốn tạo xong là xuất luôn, dùng thiết lập của bước 2.

### 2. Hậu kỳ (text + nhạc, không tốn lượt Veo)
- **Danh sách video bên trái**: sửa **text** và chọn **nhạc** của từng video ngay trên dòng. Bấm một dòng để xem trước.
- **Khung xem trước bên phải**:
  - phát chính video đã tạo; dòng chưa tạo thì hiện ảnh gốc;
  - khung đúng tỉ lệ 16:9 hoặc 9:16;
  - kéo thả chữ hoặc bấm 9 nút hít để đặt vị trí.

  Tick **Kiểu/vị trí chữ riêng cho video này** để video đó có kiểu chữ riêng.
- Các mục gập lại được:
  - **Kiểu chữ**: font, cỡ, màu, viền, bóng, nền hộp, canh lề, độ rộng;
  - **Nhạc nền**: folder, chế độ ngẫu nhiên / lần lượt / theo cột Nhạc, âm lượng nhạc, âm gốc, fade;
  - **Đầu ra**: folder Output, ghi đè.
- Làm hàng loạt, theo thứ tự video (STT):
  - **Dán nhiều text**: mỗi dòng dán vào là text của một video, điền từ dòng đang chọn.
  - **Text theo mẫu**: `{stt}` thay bằng số thứ tự, `{ten}` bằng tên ảnh. Ví dụ `Tập {stt}` ra "Tập 1", "Tập 2"… Áp dụng cho các dòng đã tick, hoặc mọi dòng nếu không tick dòng nào.
  - **Gán nhạc lần lượt**: lấy file trong folder nhạc theo thứ tự tên, gán cho video 1, 2, 3…, hết bài thì quay vòng. Cột Nhạc hiện ngay bài được gán và sửa tay được.
  - **Nhập Excel/CSV**.
- **Xuất dòng chọn** / **Xuất tất cả** chèn text + nhạc vào video gốc và ghi ra Output. Xuất lại bao nhiêu lần cũng được.

### Excel/CSV
Các cột `anh, prompt, text, nhac`:
- Có cột `anh` thì khớp theo tên file ảnh.
- **Không có cột `anh`** thì khớp theo thứ tự: dòng dữ liệu 1 là video 1, dòng 2 là video 2…
- `nhac` là tên file trong folder nhạc.
- Ô trống không ghi đè dữ liệu đang có.
- Dòng không khớp được báo lại.

### Âm thanh, đầu ra và dự án
- Text hiển thị suốt video. Nhạc nền được trộn dưới âm gốc của video Veo:
  - **Âm lượng nhạc** chỉnh độ lớn nhạc;
  - **Âm gốc** chỉnh tiếng Veo (0% = tắt hẳn, kể cả khi không có nhạc).
- Mặc định, thành phẩm nằm trong `<folder ảnh>\Output\`, tên `001_<tên ảnh>.mp4`, `002_<tên ảnh>.mp4`…
- Dữ liệu dự án và video gốc nằm trong `<folder ảnh>\_1click\`.
- Tắt tool rồi mở lại cùng folder ảnh để tiếp tục:
  - dòng đang render được hỏi lại extension, không gửi lại và không tốn thêm lượt Veo;
  - dòng Đã tạo giữ nguyên.
- Có thể chuyển hoặc đổi tên cả folder ảnh: đường dẫn bên trong tự cập nhật.

## Lưu ý

- Tạo video và thử lại lỗi tạo/tải video dùng lượt Veo của tài khoản Google. Khi thử cấu hình mới, nên bắt đầu với ít ảnh.
- Ba dòng lỗi liên tiếp → tool tự dừng; có thể tài khoản đã hết lượt tạo Veo trong ngày. Kiểm tra lý do lỗi trước khi thử lại.
- Thiếu `ffmpeg.exe` hoặc `ffprobe.exe` thì tool báo trên đầu cửa sổ, và **Bắt đầu tạo** báo lỗi ngay, trước khi gửi prompt nào.
- Lỗi hậu kỳ: kiểm tra FFmpeg, text và nhạc, rồi **Xuất** lại dòng đó.
- Veo dùng ảnh làm khung đầu nhưng có thể vẽ lại một số chi tiết; bố cục được giữ. Video Veo có dấu ✦ ở góc dưới phải.
- File CSV phải lưu dạng **CSV UTF-8** để giữ dấu tiếng Việt; có thể dùng `.xlsx`.
- **Ẩn Chrome**: nút trên đầu cửa sổ ẩn hẳn cửa sổ Chrome đang tạo video (khỏi màn hình và taskbar); **Hiện Chrome** để xem lại. Tool tự hiện lại khi cần đăng nhập, khi job bị từ chối và khi tắt tool. Nên bật thêm **Run in background / Chạy nền** trong side panel của extension (chọn tab Google Vids khi Chrome hỏi) để Chrome không tạm dừng trang.
- Nếu extension chưa kết nối, kiểm tra tool đang mở và đã Reload extension sau cập nhật.

## Phát triển và đóng gói

Cần Node.js/npm, Rust, Tauri CLI và bộ công cụ C++ cho Windows. Chạy từ thư mục repo:

```powershell
npm install
cargo tauri dev
```

Các lệnh kiểm tra:

```powershell
npm test
npm run build
npm run test:ext
cd src-tauri
cargo test
```

Kiểm thử Rust về media cần FFmpeg/ffprobe trong PATH. `npm run test:ext` kiểm tra module bridge đã cài trong folder extension bên cạnh repo; xem [hướng dẫn bridge](extension-bridge/README.md) để chuẩn bị extension.

Đóng gói từ thư mục repo:

```powershell
cargo tauri build
```

Bộ cài NSIS được xuất tại `src-tauri/target/release/bundle/nsis/1Click Video Tool_0.1.0_x64-setup.exe`.
