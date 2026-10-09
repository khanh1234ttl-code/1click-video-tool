# Chạy thật: ẩn cửa sổ Chrome, 5 luồng

Ngày 09/10/2026, Claude Code. Bản release build từ `4e806b7`, chạy và điều khiển qua CDP. Dùng **5 lượt Veo**, bấm Bắt đầu tạo một lần, maxRetries 0.

## Thiết lập
- Người dùng đã reload extension: bridge gửi `window.info` và chạy Vids trong cửa sổ riêng.
- Dự án scratch `live-hide`:
  - 5 ảnh vẽ (thuyền, biển, diều, núi tuyết, hải đăng), 16:9, 720p;
  - **5 luồng**, maxRetries 0, **tự hậu kỳ bật**, text "Tập 1…5", nhạc nền.
- Bấm **Ẩn Chrome** trên header, **không bật "Chạy nền"**: đây là trường hợp xấu nhất.

## Kết quả
| Kiểm tra | Kết quả |
|---|---|
| Trước khi chạy | Chỉ có cửa sổ Chrome "Extensions" của người dùng (đang thu nhỏ). `chromeWindow=false` vì chưa có tab Vids nào. |
| Bắt đầu tạo | Bridge mở cửa sổ Vids riêng và báo bounds. Tool ẩn cửa sổ đó ngay: `IsWindowVisible=false`, rect (589,0,1563,1152). |
| Giữa lúc chạy | Cửa sổ Vids vẫn ẩn. Cửa sổ Chrome người dùng đang dùng (Google Drive) vẫn hiện, không bị đụng tới. |
| Tạo video khi cửa sổ ẩn hẳn | **5/5 Done**, cùng job `j1791509345034-1`, thứ tự đúng 001–005. |
| Đầu ra | 5 file 1280×720, có audio, 10.005 s, mean volume −24.7…−36.0 dB. Chữ "Tập n" đúng từng video ([ảnh đối chiếu](2026-10-09-hide-chrome-contact.png): nguồn, khung đầu raw, output giây 3). |
| Downloads | Không có file mới từ lần chạy (file mới nhất là của người dùng lúc 07:33). |
| Hiện Chrome | Cửa sổ hiện lại (`visible=True`), `hideChrome=false`. |
| Ẩn rồi tắt tool | Cửa sổ đang ẩn tự hiện lại khi tool thoát (`RunEvent::Exit`). |

Kết luận: chế độ ẩn hẳn **chạy được kể cả khi không bật "Chạy nền"**. "Chạy nền" vẫn được hướng dẫn khuyên bật thêm cho các phiên dài.
Sau kiểm tra, setting `hideChrome` được trả về `false` (mặc định).

## Lệnh kiểm tra (đều exit 0)
- `cargo test`: unit 108, e2e 3, media 3.
- `npm test`: 57.
- `npx tsc --noEmit`.
- `npm run test:ext`: 15.
- Bridge trong git giống hệt bản đang cài.
- `cargo tauri build`.
