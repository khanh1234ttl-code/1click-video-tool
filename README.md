# 1Click Video Tool

Làm video hàng loạt trên Windows: folder ảnh + prompt → extension Vids Automation tạo video Veo trên Google Vids → tool chèn text, nhạc nền và xuất từng video.

## Cần có

- Chrome đã cài extension **Vids Automation – 1 Click Studio v1.1.10.0+** và đăng nhập tài khoản Google dùng được Google Vids.
- FFmpeg gồm `ffmpeg.exe` và `ffprobe.exe` trong PATH, hoặc chọn thư mục chứa cả hai trong tab **Chạy**. Bộ cài tool không kèm FFmpeg.

## Cài đặt và kết nối extension

1. Cài 1Click Video Tool bằng file `1Click Video Tool_0.1.0_x64-setup.exe`.
2. Nếu extension hiện có chưa được bổ sung bridge, làm theo [hướng dẫn cài bridge](extension-bridge/README.md). Sao lưu toàn bộ extension trước khi sửa; hướng dẫn này chỉ thêm module bridge, giữ nguyên luồng tạo video hiện có.
3. Trong Chrome, mở `chrome://extensions`, tìm **Vids Automation – 1 Click Studio** và bấm **Reload** sau khi cập nhật bridge hoặc manifest.
4. Mở tool, chọn folder ảnh rồi vào tab **Chạy**. Chờ trạng thái **Extension đã kết nối (v1.1.10.0)** hoặc phiên bản mới hơn. Mở Google Vids và hoàn tất đăng nhập nếu cần.

## Dùng

1. **Nguồn**: chọn folder ảnh → nhập prompt bằng cách sửa trong bảng, **Dán nhiều prompt**, **Prompt chung**, hoặc **Nhập CSV/Excel** với các cột `anh, prompt, text, nhac`. Bấm một dòng để đặt text, nhạc và vị trí riêng.
2. **Preset**: chọn chế độ tạo (ảnh làm khung hình đầu / ảnh tham chiếu), tỉ lệ, chất lượng và số luồng. Chỉnh kiểu chữ, kéo thả vị trí text trên khung xem trước; chọn folder nhạc, chế độ nhạc (ngẫu nhiên / lần lượt / gán), âm lượng và fade. Chọn folder Output nếu muốn đổi nơi lưu. Lưu preset theo tên để dùng lại.
3. **Chạy**: bấm **Bắt đầu**. Tab Google Vids có thể để ẩn. Theo dõi trạng thái `Chờ → Đang gửi → Render n% → Đã tải → Hậu kỳ → Xong`. **Dừng** hủy job đang chạy trên extension: dòng đang gửi/render trở về **Chờ** (bấm **Bắt đầu** để chạy lại, sẽ tốn lượt Veo), dòng đang hậu kỳ chuyển lỗi, dùng **Chỉ hậu kỳ lại**. Dòng lỗi → **Thử lại**. Sau khi sửa text hoặc nhạc, chọn dòng rồi bấm **Chỉ hậu kỳ lại** để xử lý từ video gốc, không tốn lượt Veo.

Text hiển thị suốt video. Nhạc nền được trộn dưới âm gốc của video Veo: **Âm lượng nhạc** chỉnh độ lớn nhạc, **Âm gốc** chỉnh tiếng Veo (0% = tắt hẳn, kể cả khi không có nhạc).

Mặc định, video thành phẩm nằm trong `<folder ảnh>\Output\`, theo tên `001_<tên ảnh>.mp4`, `002_<tên ảnh>.mp4`… Bấm **Mở folder Output** trong tab Chạy để xem kết quả.

Dữ liệu dự án và video gốc nằm trong `<folder ảnh>\_1click\`. Tắt tool rồi mở lại cùng folder ảnh để tiếp tục dự án: dòng đang render được hỏi lại extension, không gửi lại và không tốn thêm lượt Veo. Có thể chuyển hoặc đổi tên cả folder ảnh: ảnh, video gốc, thành phẩm và nhạc nằm trong folder sẽ tự cập nhật đường dẫn.

## Lưu ý

- Tạo video và thử lại lỗi tạo/tải video dùng lượt Veo của tài khoản Google. Khi thử cấu hình mới, nên bắt đầu với ít ảnh.
- Ba dòng lỗi liên tiếp → tool tự dừng; có thể tài khoản đã hết lượt tạo Veo trong ngày. Kiểm tra lý do lỗi trước khi thử lại.
- Thiếu `ffmpeg.exe` hoặc `ffprobe.exe` thì **Bắt đầu** báo lỗi ngay, trước khi gửi prompt nào.
- Lỗi hậu kỳ: kiểm tra FFmpeg, text và nhạc, rồi dùng **Chỉ hậu kỳ lại**.
- Veo dùng ảnh làm khung đầu nhưng có thể vẽ lại một số chi tiết; bố cục được giữ. Video Veo có dấu ✦ ở góc dưới phải.
- File CSV phải lưu dạng **CSV UTF-8** để giữ dấu tiếng Việt; có thể dùng `.xlsx`.
- Nếu extension chưa kết nối, kiểm tra tool đang mở và đã Reload extension sau cập nhật. Nút **Quên extension** dùng khi muốn cho một extension khác kết nối.

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
