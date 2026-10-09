# 1Click Video Tool

Làm video hàng loạt trên Windows: folder ảnh + prompt → extension Vids Automation tạo video Veo trên Google Vids → tool chèn text, nhạc nền và xuất từng video.

## Cần có

- Windows 10/11 và tài khoản Google dùng được Google Vids.
- Bộ cài đã kèm sẵn: **trình duyệt Vids** (Chromium 154 có gắn sẵn extension Vids Automation – 1 Click Studio) và **FFmpeg 8.1**. Máy khách không cần cài Chrome, extension hay FFmpeg riêng.

## Cài đặt lần đầu

1. Chạy `1Click Video Tool_0.1.0_x64-setup.exe`.
2. Mở tool. Sau vài giây, nếu chưa có extension nào kết nối, tool tự mở **trình duyệt Vids** (cửa sổ Chromium có profile riêng, extension đã gắn sẵn) ở trang Google Vids.
3. **Đăng nhập tài khoản Google** trong cửa sổ đó, chỉ cần một lần: profile được giữ cho các lần sau.
4. Đèn **Extension** trên đầu cửa sổ tool chuyển xanh là xong. Có thể mở lại trình duyệt bất cứ lúc nào: bấm đèn **Extension** → **Mở trình duyệt Vids**.

Máy đã có Chrome cài extension (bản có bridge) vẫn dùng được như cũ: extension kết nối trong vài giây nên tool không mở thêm trình duyệt. Hướng dẫn gắn bridge cho extension có sẵn: [extension-bridge/README.md](extension-bridge/README.md).

## Dùng

Tool có hai bước, chuyển bằng hai nút trên đầu cửa sổ. Ô **Preset** (nạp / đặt tên + **Lưu**) cũng nằm trên đầu. Bấm đèn **Extension** để xem trạng thái, **Quên extension** hoặc **Chọn thư mục FFmpeg**.

### 1. Tạo video
- Bấm **Chọn folder ảnh**. Folder này là **kho ảnh**; mặc định mỗi ảnh thành một dòng (một prompt), theo tên tự nhiên (1, 2, 10…).
- **Mỗi dòng là một prompt** và có thể dùng 0–10 ảnh:
  - bấm ô **Ảnh** của một dòng để chọn ảnh cho riêng dòng đó (bấm theo thứ tự muốn dùng);
  - **Gán ảnh…** chọn nhiều ảnh rồi: **Cho mọi dòng** (ví dụ 2 ảnh tham chiếu cho 10 prompt), **Cho dòng đã tick**, **Xoay vòng** (mỗi dòng 1 ảnh lần lượt), **Tạo 1 dòng cho mỗi ảnh**;
  - **Thêm dòng**, **Xoá dòng đã tick** (dòng đang chạy không bị xoá; số STT giữ nguyên).
- Chế độ **ảnh làm khung đầu** cần đúng 1 ảnh mỗi dòng; chế độ **ảnh tham chiếu** dùng 1–10 ảnh mỗi dòng. Sai thì **Bắt đầu tạo** báo dòng nào cần sửa trước khi gửi.
- Nhập prompt bằng một trong các cách:
  - sửa thẳng trong bảng;
  - **Dán nhiều prompt** (mỗi dòng một prompt, điền từ dòng đang chọn; thiếu dòng thì tool tự thêm);
  - **Prompt chung** cho các dòng chưa có prompt riêng;
  - **Nhập Excel/CSV** (xem bên dưới).
- Hàng cài đặt gồm: chế độ (ảnh làm khung đầu / ảnh tham chiếu), tỉ lệ 16:9 / 9:16, chất lượng, số luồng, **Tự thử lại** (extension tự tạo/tải lại video lỗi).
- Bấm **Bắt đầu tạo**. Tab Google Vids có thể để ẩn.
  - Trạng thái chạy qua `Chờ → Đang gửi → Render n% → Đã tạo`.
  - Dòng **Đã tạo** đã có video gốc; bấm **Xem** để mở video đó.
  - **Mở folder video gốc** mở `<folder ảnh>\_1click\raw`.
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
Các cột `anh, prompt, text, nhac` (không cần đủ):
- **Mỗi dòng dữ liệu là một prompt, theo thứ tự**: dòng 2 trong Excel = prompt 1, dòng 3 = prompt 2… Thiếu dòng thì tool tự thêm.
- `anh` ghi tên ảnh trong kho (có hoặc không có đuôi). **Nhiều ảnh** thì cách nhau bằng dấu `;`, ví dụ `nhan-vat.png; boi-canh.png`.
- `nhac` là tên file trong folder nhạc.
- Ô trống không ghi đè dữ liệu đang có. Tên ảnh không tìm thấy được báo lại.
- File mẫu trong `samples/`: `mau-nhap-theo-ten-anh.xlsx` (mỗi prompt 1 ảnh), `mau-nhieu-anh.xlsx` (2 ảnh tham chiếu cho nhiều prompt), `mau-nhap-theo-thu-tu.xlsx` (chỉ prompt/text/nhạc), `mau-nhap-theo-ten-anh.csv`.

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
- FFmpeg đi kèm bộ cài. Muốn dùng bản khác thì bấm đèn **Extension** → **Chọn thư mục FFmpeg** (thư mục có `ffmpeg.exe` và `ffprobe.exe`).
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

Đóng gói bản cho khách (kèm Chromium, FFmpeg và extension), từ thư mục repo:

```powershell
python scripts/fetch-vendor.py
cargo tauri build --config src-tauri/tauri.bundle.conf.json
```

`fetch-vendor.py` tải các file nguồn (kiểm tra SHA256 cố định) vào `vendor-dl/` và chuẩn bị `src-tauri/vendor/` (cần 7-Zip). `cargo tauri build` không kèm `--config` cho ra bản nhẹ, không kèm trình duyệt và FFmpeg.

Bộ cài NSIS được xuất tại `src-tauri/target/release/bundle/nsis/1Click Video Tool_0.1.0_x64-setup.exe`.
