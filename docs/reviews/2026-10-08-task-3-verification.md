# Task 3 — verification (Claude Code)

Ngày 08/10/2026. Resume từ checkpoint `04a1726`/`d7a3adb` theo yêu cầu người dùng.

## Việc đầu tiên khi resume: Pause trong lúc Start đang chuẩn bị
- RED (`src/tabs/RunTab.test.ts`): với `start_run` treo và `status.running=true`, nút Tạm dừng bị
  disabled (`expected true to be false`), `pause_run` không được gọi, và khóa điều hướng mở
  trước khi pause kết thúc (thứ tự "start xong trước").
- Sửa (`7903573`): RunTab tách cờ `pausing` khỏi `busy` (Start/Retry/Reprocess);
  `onBusyChange(busy || pausing)` nên điều hướng chỉ mở khi cả hai kết thúc. Start/Retry/Reprocess
  vẫn bị chặn khi Start đang chạy; không gửi `pause_run` lần hai khi đang chờ.
- GREEN: RunTab 5/5 (cả hai thứ tự settle).

## Scoped review Task 3 (`ffdaadc..7903573`)
- Preset: ghi theo hàng đợi, flush trước Lưu/điều hướng, load preset không bị bản sửa cục bộ cũ
  ghi đè, ghi lỗi không gây lặp vô hạn, timer bị hủy khi unmount.
- Backend: `set_preset`/`save_preset`/`load_preset`/`update_row` kiểm tra `image_dir` trong cùng
  khóa engine; lệnh cũ không ghi vào dự án mới.
- Source/RowPanel: panel reset theo `imageDir`, key gồm dự án + STT; lỗi lưu hiện toast.
- Kết luận: **Approved**, không còn Critical/Important trong phạm vi Task 3.

## Kiểm chứng
- `npm test`: 30/30 (RunTab 5, PresetTab 19, textLayout 6); `npm run build` đạt; `npx tsc --noEmit` đạt.
- `cargo test --lib`: 82/82; `cargo test --test e2e batch_runs_end_to_end`: 1/1; `cargo test --test media_ffmpeg`: 2/2.
- `npm run test:ext`: 11/11.
- Full `cargo test` vẫn còn đúng regression Task 4 `review_no_music_honors_original_mute` (chưa sửa ở Task 3).
- Native smoke preset Save/Run đọc JSON trên đĩa: đã làm ở checkpoint (xem `2026-10-08-task-3-checkpoint.md`). Không dùng quota Veo.
