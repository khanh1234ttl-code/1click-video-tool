# Task 2 — recovery, nhạc hậu kỳ và import

Hoàn tất ngày 08/10/2026, commit cục bộ `f7690a7` trên `feat/video-tool`.

## Thay đổi và hành vi được kiểm tra

Import ưu tiên exact filename, sau đó chỉ nhận stem duy nhất. Bỏ một guard nhầm dấu chấm trong stem thành đuôi ảnh: CSV `A.V1` khớp `a.v1.png`. Exact filename vẫn thắng stem của ảnh khác; stem mơ hồ không sửa bất kỳ row nào. Giữ matching không phân biệt hoa thường và có/không đuôi.

Thêm 9 regression tests trong runner/import. Các hành vi runner có sẵn được kiểm chứng: hậu kỳ lại từ không nhạc sang track hiện tại không gửi generation; assigned track bị xóa dùng fallback hoặc silence; recovered Sending/Rendering có running=true, query/Pause dùng đúng job, ba failures cancel; crash recovery giữ resolved_music đã lưu; hậu kỳ xong hoặc lỗi cuối cùng đưa running về false. Không thêm sửa production runner chỉ để tạo thay đổi.

## Bằng chứng

- Dotted stem RED trực tiếp trên `74da924`: **1 failed** trước khi bỏ guard.
- Harness độc lập với production runner/import từ `3e27fa8`: **14 assertion failures, 1 pass**. Dotted stem từng được bản cũ hỗ trợ, nên regression đó được chứng minh bằng RED riêng trên checkpoint chính.
- `cargo test --lib review_`: **38/38 passed**.
- Bốn focused commands của brief: mỗi command **1/1 passed**.
- `cargo test --lib`: **79/79 passed**, không ignore.
- `cargo test --test e2e batch_runs_end_to_end`: **1/1 passed**, extension giả và FFmpeg thật.
- `cargo test --test media_ffmpeg`: **2/2 passed**.
- `cargo test` toàn bộ: unit đạt; e2e **1 pass/1 fail**, chỉ lỗi `review_no_music_honors_original_mute`, peak `0.1299381`. Task 4 chưa sửa; không claim full suite xanh.
- `git diff --check`: đạt; Rust files giữ UTF-8 LF.

## Review và phạm vi

Scoped review **Spec compliant, Quality Approved**, không có Critical/Important/Minor findings. Reviewer đọc diff và kiểm tra các nhánh runner/music không đổi; không chạy lại suites.

Kiểm tra nối luồng ở mã hiện tại: Engine.open_project đọc project trên đĩa, recover Runner và emit Status; App nhận getStatus/onStatus; RunTab bật Pause theo status.running và gọi pause_run. Đây là kiểm tra mã; smoke UI khi restart thực tế vẫn thuộc integration Tasks 6–7.

Không đổi engine, media, UI, protocol hoặc extension trong Task 2. Không dùng quota, không push/merge, chưa build bộ cài mới. Tiếp tục Task 3.

Evidence đầy đủ được giữ trong `.superpowers/sdd/2026-10-08-claude-code-finish-video-tool/`: `task-2-report.md`, `task-2-review.md`, các RED/GREEN logs và baseline harness.
