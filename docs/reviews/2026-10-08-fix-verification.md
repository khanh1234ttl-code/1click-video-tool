# Fix verification — 7 Important findings (`3e27fa8..HEAD`)

Ngày 08/10/2026, Claude Code. Đối chiếu từng finding trong `2026-10-08-whole-branch-review.md`
với test hồi quy và code hiện tại. Không dùng quota Veo.

| # | Finding | Sửa ở | Test hồi quy (đều PASS) | Verdict |
|---|---|---|---|---|
| 1 | Ràng buộc tác vụ bất đồng bộ theo project/job/row | Task 1 `78ed1fe`, `d2a708f` | `review_queued_postprocess_cannot_mutate_new_project`, `review_running_postprocess_cannot_publish_into_replacement_project`, `review_pause_during_encode_never_dispatches_and_emits_running`, `review_pause_during_import_cannot_publish_raw`, `review_duplicate_download_query_imports_and_processes_once`, `review_stale_rejections_do_not_stop_new_job`, `review_terminal_failure_during_import_cannot_resurrect_or_block_new_job`, các `repair_delayed_*` | Addressed |
| 2 | Ghi trạng thái tuần tự, lưu jobId trước khi gửi | Task 1 | `review_concurrent_edits_are_durable_and_ordered`, `review_save_failure_rolls_back_start_and_never_dispatches`, `review_start_persists_before_submit`, `review_failed_lifecycle_save_rolls_back_runner`, `review_failed_edit_save_rolls_back_memory`, `repair_failed_*` | Addressed |
| 3 | Flush/scope preset trước Lưu, Chạy, nạp, đổi dự án | Task 3 `04a1726`, `7903573` | `PresetTab.test.ts` (19), `RunTab.test.ts` (5), `review_scoped_edits_reject_old_project_without_touching_disk`, `review_scoped_named_presets_reject_old_project`, `review_scoped_edit_failure_rolls_back` | Addressed |
| 4 | Hậu kỳ lại dùng lựa chọn nhạc mới | Task 2 `f7690a7` | `review_reprocess_resolves_current_music`, `review_reprocess_adds_music_to_previously_silent_row`, `review_reprocess_deleted_assignment_uses_fallback_then_silence`, `review_recovery_keeps_saved_music_and_finishes_running` | Addressed |
| 5 | Khôi phục và phát đúng trạng thái running | Task 1–2 | `review_recovery_restores_running_and_failure_guard`, `review_recovered_rendering_can_pause_without_resubmitting`, `review_recovered_query_three_failures_cancel_remaining_row`, `review_local_completion_emits_running_false_without_bridge_message`, `review_last_postprocess_failure_stops_running` | Addressed |
| 6 | Âm gốc khi không có nhạc | Task 4 `0d4e465` | e2e `review_no_music_honors_original_mute` (RED peak 0.1299 → GREEN), `half_original_volume_halves_the_peak_without_music`, 4 test tham số media | Addressed |
| 7 | Tên file chính xác trước stem | Task 2 | `review_exact_filename_beats_ambiguous_stem`, `review_exact_filename_wins_over_another_images_dotted_stem`, `review_ambiguous_dotted_stem_does_not_mutate_either_row`, `review_unique_dotted_stem_matches_without_image_extension` | Addressed |

Không còn Important mở. Hai Minor của review đã sửa thêm ở Task 5 (`d6363e6`): TextPreview vẽ lại khi
đổi kích thước và bỏ lần vẽ cũ; Start kiểm tra cả ffmpeg lẫn ffprobe.

## Toàn vẹn extension
- `extension-bridge/assets/oneclick-bridge.js` == bản cài (SHA256 `a911f518…a361d05`).
- `assets/index.ts-DUXzPPUe.js`, `assets/index.ts-Bqt83c-l.js`, `assets/remoteConfig-DmanYf7p.js` giống backup
  `Vids_Automation_1ClickStudio_v1.1.9.9_backup_20261008_201603`; chỉ `manifest.json` (1.1.10.0),
  `service-worker-loader.js`, `FIX_NOTES.txt` khác và thêm bridge.

## Lệnh đã chạy (từng lệnh, exit 0)
- `npm test` → 32/32
- `npm run build` → OK
- `npm run test:ext` → 11/11
- `cargo test` (src-tauri) → unit 87, e2e 2, media_ffmpeg 3, 0 failed
- `npx tsc --noEmit` → OK
- `git diff --check` → OK
- Dev smoke không bật polling: app chạy, bridge nghe 17890, build lại Rust khi sửa file, 0 EBUSY.

## Minor còn lại (chưa sửa, không claim đạt)
- Dự án bị di chuyển: chỉ `image_dir` được rebase; `image_path`/`raw_video`/`output` vẫn là đường dẫn tuyệt đối.
- "Dán nhiều prompt" luôn bắt đầu từ dòng 1 thay vì dòng đang chọn (ô nhập dòng bắt đầu vẫn sửa được).
- Bóng chữ chỉ vẽ cùng `strokeText`: bật bóng mà độ dày viền 0 thì không có bóng.
- TOFU: hai handshake đầu tiên đồng thời có thể cùng được chấp nhận (snapshot allowed id trước handshake).
- Spec có nút Dừng riêng và mẫu tên file tùy chỉnh; bản này có Tạm dừng và tên cố định `{stt:03}_{stem}.mp4` theo plan.
