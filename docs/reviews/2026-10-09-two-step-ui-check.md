# Kiểm tra giao diện 2 bước trên app thật

Ngày 09/10/2026, Claude Code. Bản release build từ `1d815c1`, chạy trực tiếp và điều khiển qua CDP.
Không dùng lượt Veo: thử trên bản sao scratch `live-run-ui` của 3 video thật đã tạo hôm 08/10, cả 3 dòng ở trạng thái `generated`.

## Kết quả
| Kiểm tra | Kết quả |
|---|---|
| Bước 1: các cài đặt nằm trên một hàng, prompt sửa trong bảng, trạng thái "Đã tạo" + Xem, "3/3 đã tạo" | Đạt ([ảnh](2026-10-09-step1.png)) |
| Bước 2: không tràn trang (`scrollHeight` 820 = `innerHeight` 820) | Đạt |
| Xem trước phát video gốc (`readyState 4`, 1280×720, đang phát) | Đạt |
| Khung 16:9 | 612×344 px, tỉ lệ **1.7778** ([ảnh](2026-10-09-step2-169.png)) |
| Khung 9:16 | 194×344 px, tỉ lệ **0.5625** ([ảnh](2026-10-09-step2-916.png)) |
| Text theo mẫu `Tập {stt} – {ten}` | 3 dòng ra "Tập 1 – 01_thuyen-buom"… Toast "Đã đặt text cho 3 video" |
| Gán nhạc lần lượt | Cả 3 dòng được gán `music\nhac-thu.mp3` (folder có 1 bài nên quay vòng). Toast đúng |
| Xuất dòng chọn (1) | Dòng 1 → Done. File `Output/001_01_thuyen-buom.mp4`: 1280×720, có audio, dài 10.005 s, chữ ở giữa đáy ([khung giây 3](2026-10-09-export-001.png)) |

## Lỗi phát hiện khi kiểm tra và đã sửa (`1d815c1`)
- **Khung xem trước bị ép chiều cao** trong cột cuộn dạng flex: tỉ lệ đo được là 0.75 cho 9:16 và 2.37 cho 16:9.
  - Sửa bằng `flex-shrink: 0`.
  - happy-dom không tính layout, nên lỗi này chỉ đo được trên app thật (bảng trên).
- **Vị trí chữ riêng kéo/hít trên khung xem trước không được lưu**, vì chỉ form Kiểu chữ kích hoạt việc lưu.
  - Có regression trong `PostTab.test.ts`, đã thấy RED trước khi sửa và GREEN sau khi sửa.

## Lệnh kiểm tra (đều exit 0)
- `cargo test`: unit 103, e2e 3, media 3.
- `npm test`: 56.
- `npm run build`, `npx tsc --noEmit`.
- `npm run test:ext`: 11.
- `git diff --check`.
- `cargo tauri build`.
