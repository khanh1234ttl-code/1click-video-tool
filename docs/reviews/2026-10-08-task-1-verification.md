# Task 1 — engine ownership và persistence

Hoàn tất ngày 08/10/2026 trên nhánh `feat/video-tool`. Các commit cục bộ:
- `78ed1fe`: tích hợp engine lifecycle, durable transaction và regression tests.
- `d2a708f`: sửa theo scoped review về delayed effects, completion recovery và rollback filesystem.

## Thay đổi

Tác vụ mang epoch, job/row identity và snapshot I/O từ transaction gốc. Identity được kiểm tra trước claim, dispatch và publication; kết quả cũ không nhận identity của job mới. Duplicate download/query được claim một lần. Encode sau Pause không gửi generation.

Mutation/snapshot/save chạy theo thứ tự dưới mutex đồng bộ, không giữ guard qua await. Sending/jobId được lưu trước dispatch. Save lỗi khôi phục Runner, kể cả transient guards; worker đã kết thúc không giữ claim làm dòng bị kẹt, nên same-job query hoặc hậu kỳ lại có thể phục hồi.

Raw/output dùng file tạm riêng. Publication có kiểm tra ownership; lỗi rollback/cleanup được báo cùng đường dẫn phục hồi. Backup `<final>.backup` được giữ khi chưa thể phục hồi và chặn publication tiếp theo, kể cả engine restart.

## Bằng chứng test

- Checkpoint ban đầu: 10 lỗi E0308. Sau refactor: compile thành công.
- Baseline độc lập trước sửa: **17 regression tests thất bại đúng hành vi**; không reset checkout chính.
- Fix round 1: **11 regression mới RED rồi GREEN**, gồm delayed effects sau Pause/restart và terminal failure/retry, stale Submit, recovery sau completion-save failure, rollback I/O errors và backup protection.
- `cargo test --lib`: **70 passed, 0 failed**.
- `cargo test --test e2e batch_runs_end_to_end`: **1 passed**, extension giả với WebSocket thật và FFmpeg thật.
- `cargo test --test media_ffmpeg`: **2 passed**.
- `cargo test`: **chưa xanh toàn bộ**. Unit và batch e2e đạt; chỉ `review_no_music_honors_original_mute` thất bại, peak `0.1299381`. Đây là lỗi Task 4 được giữ nguyên, không ignore/remove.
- `git diff --check`: đạt.

Các race tests dùng gate/Barrier/Notify/Condvar; timeout chỉ phát hiện deadlock, không dùng sleep để tạo race. Test hooks chỉ tồn tại trong cfg(test), không thêm public test API.

## Review

Review ban đầu yêu cầu sửa 3 Important findings: identity được capture quá muộn, stranded completion ownership, và rollback errors bị bỏ qua. Scoped re-review của `d2a708f` xác nhận **cả 3 ADDRESSED**, không có Critical/Important mới, **Task 1 gate Approved**.

Quyết định được reviewer chấp nhận: nếu lưu Pause thất bại, giữ trạng thái chạy đã lưu trước đó và báo lỗi tiếng Việt; chỉ invalidate operations khi Pause đã durable. Người dùng cần xử lý lỗi ghi rồi tạm dừng lại. FFmpeg đang chạy có thể kết thúc vào temp riêng; operation đã hủy/stale không publish.

## Phạm vi còn lại

Chưa sửa UI/preset, media âm gốc, preview hoặc extension trong Task 1. Chưa chạy Veo, không dùng quota, không push/merge. Installer cũ chưa được build lại từ code này. Tiếp tục Task 2 của kế hoạch; toàn nhánh sẽ review/verify ở Task 6.

Bằng chứng đầy đủ nằm trong scratch được giữ nguyên tại `.superpowers/sdd/2026-10-08-claude-code-finish-video-tool/`: `task-1-report.md`, `task-1-review.md`, `task-1-rereview.md`, các log baseline/repair và diff packages.
