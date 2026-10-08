# Hoàn tất 1Click Video Tool — kế hoạch cho Claude Code

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thành refactor WIP và 7 lỗi review, kiểm chứng 3 video thật, build bộ cài từ mã cuối.
**Architecture:** Giữ Tauri/Rust runner-engine/Svelte. Ràng buộc mọi task nền bằng project epoch + row operation identity; lưu trạng thái theo thứ tự trước external dispatch. Bridge hiện có được giữ nguyên và kiểm chứng tích hợp.
**Tech Stack:** Rust MSVC/tokio, Tauri 2, Svelte 5/Vite 6/Vitest 2, happy-dom 20.14.5, Node 26/ws, FFmpeg.
**Spec:** `D:/1Click/Vids_Automation_1ClickStudio_v1.1.9.6/docs/superpowers/specs/2026-10-08-1click-video-tool-design.md`.
**Original plan:** `D:/1Click/Vids_Automation_1ClickStudio_v1.1.9.6/docs/superpowers/plans/2026-10-08-1click-video-tool.md`.
**Checkpoint:** `f23202f` (WIP chưa compile); đọc `docs/HANDOFF-CLAUDE.md` và `docs/reviews/2026-10-08-whole-branch-review.md`.

## Global Constraints

- Giữ checkout hiện tại và nhánh feat/video-tool, commit từng task; không push/merge.
- Test trước code: RED đúng hành vi rồi GREEN. Code đã có không đồng nghĩa đã được kiểm chứng.
- User-facing text tiếng Việt; không giữ std Mutex qua await.
- WebSocket 127.0.0.1:17890, Origin extension tin cậy; giữ quyết định TOFU đã chốt.
- Không đổi generation content script; backup extension ngoài git trước mọi sửa mới.
- Download 1ClickBridge/<jobId>/NNN_*.mp4, mapping theo jobId/STT.
- Output STT 3 chữ số + stem; ghi đè hoặc suffix theo preset.
- Tối đa 2 FFmpeg; JPEG upload 90%, cạnh dài <=1920.
- Lưu mỗi lifecycle state; Sending/jobId phải durable trước Submit; save lỗi không được gửi generation.
- Text lấy mốc chiều cao 1080; x/y là tâm khối chữ 0..1; giữ overlay scaling.
- 3 generation failures liên tiếp => pause/cancel, kể cả job recover.
- Không xóa regression tests, scratch/fixture/backup để làm xanh.
- Chỉ chạy thật sau review/tests đạt; tối đa 3 rows, maxRetries=0. Lỗi thì debug, không dùng thêm quota tự động.

## Bản đồ trách nhiệm

| Files | Việc |
|---|---|
| src-tauri/src/engine.rs | Ownership, cancellation, durable transactions, status events. |
| src-tauri/src/runner.rs | Stale/duplicate filters, recovery/running, music reprocess. |
| src-tauri/src/import.rs | Exact filename trước unambiguous stem. |
| src-tauri/src/media.rs; tests/e2e.rs; tests/media_ffmpeg.rs | Âm gốc độc lập nhạc, kiểm chứng FFmpeg thật. |
| src/App.svelte; tabs/PresetTab.svelte; lib/api.ts; commands.rs | Flush/scoped preset trước Save/navigation. |
| tabs/SourceTab.svelte | Panel reset theo project. |
| components/TextPreview.svelte | Redraw dimensions và bỏ async continuation cũ. |
| vite.config.js; component .test.ts | happy-dom/browser conditions, watcher target. |

### Task 1: Hoàn thành engine ownership và persistence

**Files:** engine.rs, runner.rs, tests/e2e.rs.
**Interfaces:** WIP đã có `Effects = (u64, Vec<Effect>)`, State.epoch, State.operations và Operation snapshot. Helpers trả Effects; apply/submit còn Vec. Mọi asynchronous work phải mang identity từ dispatch tới publication.

- [ ] Chạy trong src-tauri `cargo test --lib`: checkpoint hiện báo 10 E0308. Đây là refactor compile failure, chưa phải RED logic.
- [ ] Chuyển apply nhận Effects, destructure epoch + queue; submit nhận epoch và trả batch đúng epoch. Không bỏ epoch để chữa type error.
- [ ] Claim Operation đồng bộ trước tokio::spawn/semaphore wait. Capture project paths/preset/row gốc; không lấy project hiện tại sau await để chọn I/O. Kiểm tra predicate sau trong cùng transaction với send/publish:

```rust
fn operation_matches(st: &State, op: &Operation) -> bool {
    st.epoch == op.epoch
        && st.operations.get(&op.stt) == Some(&op.id)
        && st.runner.as_ref().and_then(|r| r.project.row(op.stt))
            .map_or(false, |r| r.job_id == op.job_id)
}
```

- [ ] Open project tăng epoch; Pause invalidates operations. Raw/output ghi file tạm riêng epoch/opId rồi publish final chỉ khi identity còn đúng; stale chỉ xóa temp của chính nó.
- [ ] Serialize mutation/snapshot/save dưới mutex đồng bộ. Save lỗi phải rollback/propagate, không chỉ toast và giữ unsaved state. Effect::Save cũ không được ghi snapshot ngoài transaction. Start persist Sending/jobId trước dispatch.
- [ ] Emit running trước encode và sau local completion/retry/reprocess. Recheck epoch/active job sau encode và trước image.put/job.submit. Stale JobRejected/revert không dừng job mới.
- [ ] Chạy regression đã có sau sửa compile:

```powershell
cargo test --lib review_concurrent_edits_are_durable_and_ordered
cargo test --lib review_queued_postprocess_cannot_mutate_new_project
cargo test --lib review_stale_rejections_do_not_stop_new_job
cargo test --lib review_duplicate_downloads_are_claimed_once
```

- [ ] Thêm deterministic tests dùng Barrier/Notify/semaphore: pause lúc encode => không Submit; pause lúc import => không cập nhật raw/row; A->B khi queued/running FFmpeg => B Pending, không nhận output A; duplicate downloaded/query => đúng một import/hậu kỳ; save failure => transport không nhận generation.
- [ ] Chứng minh RED/GREEN của regression có sẵn bằng controlled baseline ở copy tạm hoặc đảo riêng fix tương ứng rồi phục hồi; không reset branch chính. Review task và cargo test --lib; commit `fix: scope engine operations and serialize durable state`.

### Task 2: Runner recovery, đổi nhạc và import

**Files:** runner.rs, import.rs, tests cùng module.
**Interfaces:** Giữ public protocol; explicit reprocess resolve music từ assignment/preset hiện tại, crash recovery giữ resolved music đã lưu.

- [ ] Chạy:

```powershell
cargo test --lib review_recovery_restores_running_and_failure_guard
cargo test --lib review_start_persists_before_submit
cargo test --lib review_reprocess_resolves_current_music
cargo test --lib review_exact_filename_beats_ambiguous_stem
```

- [ ] Recovery Sending/Rendering phải running=true, Pause dùng được và 3 failures cancel. Hậu kỳ về running=false sau kết thúc.
- [ ] Ngoài A->B đã có, test no-music->music reprocess: resolved_music là track mới và không có Submit; assigned file mất dùng fallback hoặc silence, không crash.
- [ ] Test a.jpg/a.png: explicit a.png chỉ sửa PNG; extensionless a mơ hồ vào unmatched. Case-insensitive và stem duy nhất vẫn dùng được.
- [ ] RED/GREEN đầy đủ và review; commit riêng các sửa runner/import nếu còn thay đổi. Không đổi Submit trước Save chỉ để giữ test cũ.

### Task 3: Preset flush/scoping và selected row

**Files:** App.svelte, PresetTab.svelte, SourceTab.svelte, lib/api.ts, commands.rs, vite.config.js, tabs/PresetTab.test.ts.
**Interfaces:** Scoped API `setPreset(preset: Preset, imageDir: string)`; backend kiểm tra image_dir trong cùng engine transaction. App await preset flush trước đổi tab/project; named preset Save flush intended snapshot trước save_preset.

- [ ] Mount component thật bằng Svelte mount/unmount với happy-dom; fake timers cho debounce 400ms. Mock Tauri boundary, không mock PresetTab. Browser conditions nếu Svelte resolve server.
- [ ] Viết test đổi quality 1080p và Lưu ngay, với assertions sau (calls/toasts/startRun là spies của boundary trong test):

```ts
expect(calls.map(c => c.type)).toEqual(["setPreset", "savePreset"]);
expect(calls[0].preset.gen.quality).toBe("1080p");
// Reject setPreset/savePreset:
expect(toasts).not.toContain("Đã lưu preset");
// Navigation trong lúc flush pending:
expect(startRun).not.toHaveBeenCalled();
```

- [ ] Thêm A timer pending -> switch B -> advance timers: không sửa preset B. Load preset mới không bị pending local edit ghi đè. Source panel A STT1 -> B STT1 không ghi fields A vào B.
- [ ] `npm test -- src/tabs/PresetTab.test.ts` phải RED đúng lỗi, rồi sửa ordered flush/queue, cancel/scope timer và backend guard; toast thành công chỉ sau save thành công.
- [ ] Reset/re-key RowPanel theo project identity. Smoke app thật change+Save/Run ngay và đọc JSON disk. Commit `fix: flush and scope preset edits before navigation`.

### Task 4: Âm gốc không nhạc

**Files:** media.rs, engine.rs, tests/e2e.rs, tests/media_ffmpeg.rs.
**Interfaces:** Pass original_volume độc lập MixParams; dùng f32 như model:

```rust
pub fn build_args(
    input: &Path, overlay: Option<&Path>, mix: Option<&MixParams>,
    original_volume: f32, probe: &Probe, output: &Path,
) -> Vec<String>
```

- [ ] `cargo test --test e2e review_no_music_honors_original_mute` sau Task1 phải RED vì PCM khác zero.
- [ ] Argument tests: không nhạc + audio, volume 0/0.5 filter và AAC re-encode; 1.0 có thể copy. Không audio/no music không map audio. Có music giữ fade/amix.
- [ ] Sửa mọi call site cho đúng preset volume; tránh hai nguồn volume khác nhau. Test PCM hiện có yêu cầu peak <0.00001; thêm 0.5 gain check với tolerance.
- [ ] GREEN e2e mute và media_ffmpeg, review; commit `fix: honor original volume without background music`.

### Task 5: Preview dimensions và thiếu ffprobe

**Files:** TextPreview.svelte, components/TextPreview.test.ts, engine.rs, vite.config.js.

- [ ] Test style/text không đổi nhưng w/h 1280x720 ->720x1280: drawOverlay nhận dimensions mới. Promise font cũ resolve sau promise mới: draw cũ không ghi canvas mới.
- [ ] RED rồi capture w/h đồng bộ trong effect; cleanup/revision bỏ stale draws và redraw sau DOM dimensions cập nhật.
- [ ] Test Start thiếu ffprobe trả lỗi tiếng Việt trước Submit; check cả ffmpeg/ffprobe, giữ PATH fallback.
- [ ] Native watcher EBUSY: ignore src-tauri/target trong Vite server.watch nếu tái hiện; smoke dev startup. Polling workaround vẫn được ghi handoff.
- [ ] Tests/build/review; commit `fix: refresh resized previews and validate media tools`.

### Task 6: Scoped re-review và toàn bộ verification

**Files:** docs/reviews/2026-10-08-fix-verification.md.

- [ ] Review `git diff 3e27fa8...HEAD` so với 7 Important findings. Mỗi finding có RED/GREEN + addressed/residual verdict; không claim toàn nhánh đạt khi còn Important.
- [ ] Bridge git == installed; content script/worker asset cũ == backup. Chạy riêng từng command, kiểm tra exit codes:

```powershell
npm test
npm run build
npm run test:ext
Push-Location src-tauri
cargo test
Pop-Location
git diff --check
```

- [ ] Đóng đúng dev app nếu cargo bị khóa EXE; không kill mọi Node/Chrome.
- [ ] Ghi counts/evidence và residual Minor: moved-project rebasing, paste default selected row, shadow khi stroke=0, TOFU concurrent initial handshake, Dừng/custom output naming khác giữa spec/plan. Không nói các mục chưa sửa đã đạt. Preview/ffprobe thuộc Task5.
- [ ] Commit verification report, giữ branch cục bộ.

### Task 7: Reload và chạy thật tối đa 3 rows

**Files:** scratch live-fixture đã có; docs/reviews/2026-10-08-live-run.md.

- [ ] Khi Task6 đạt, đề nghị người dùng Reload extension: lần trước diễn ra trước repair 3e27fa8; manifest version một mình không chứng minh worker mới đã nạp.
- [ ] Khởi động từ repo:

```powershell
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9333'
$env:CHOKIDAR_USEPOLLING='true'
cargo tauri dev
```

- [ ] Mở live-fixture 3 ảnh, kiểm tra prompt camera slowly pushes in, gentle motion; text row1 Tập1; music folder; 720p 16:9 concurrency3 maxRetries0. Đọc history trước nếu đã có job/raw, không reset để gửi trùng.
- [ ] Xác nhận connected v1.1.10.0 đúng ID; nói tối đa 3 lượt Veo. Bấm UI Bắt đầu đúng một lần để render overlays, hoặc nhờ người dùng bấm.
- [ ] Lỗi => dừng/debug, không auto-retry thêm quota. Disconnect => job.query recovery, không tạo job mới bằng tay.
- [ ] Khi 3 rows Done, kiểm tra map Output, audio/duration/resolution và frame đầu. Lệnh dùng path thật từ project:

```powershell
$fixture = Join-Path (Get-Location) '.superpowers/sdd/2026-10-08-1click-video-tool/live-fixture'
$project = Get-Content -LiteralPath (Join-Path $fixture '_1click/project.json') -Raw | ConvertFrom-Json
foreach ($row in $project.rows) {
  if ($row.status.state -ne 'done') { throw "Dòng $($row.stt) chưa xong" }
  & ffprobe -v error -show_entries stream=codec_type,width,height:format=duration -of json $row.output
  $frame = Join-Path $fixture ("output-frame-{0:000}.png" -f $row.stt)
  & ffmpeg -y -hide_banner -loglevel error -i $row.output -frames:v 1 $frame
}
```

- [ ] Extract raw frame đầu nữa để đối chiếu source; inspect output001 thấy Tập1, nhạc/audio đúng. Ghi paths/screenshots/evidence vào report. Chỉ claim live verified khi đủ; quota/login/site block thì ghi trạng thái thực tế.
- [ ] Commit report live run, không push.

### Task 8: Bộ cài cuối và bàn giao

**Files:** README.md, HANDOFF-CLAUDE.md; installer NSIS.

- [ ] README đúng hành vi preset/nhạc/recovery đã kiểm chứng.
- [ ] Build mới từ mã đã review:

```powershell
cargo tauri build
Get-Item -LiteralPath 'src-tauri/target/release/bundle/nsis/1Click Video Tool_0.1.0_x64-setup.exe'
Get-FileHash -LiteralPath 'src-tauri/target/release/bundle/nsis/1Click Video Tool_0.1.0_x64-setup.exe' -Algorithm SHA256
```

- [ ] Report exit0, installer mới tồn tại, size/SHA/commit, test counts, live evidence hoặc blocker. Installer trước WIP không dùng làm bằng chứng bản mới.
- [ ] Commit docs cuối, git status sạch; giữ branch, đưa installer path và residual Minor cho người dùng.

## Prompt mở Claude Code

```text
Mở D:/1Click/Vids_Automation_1ClickStudio_v1.1.9.6/1click-video-tool.
Đọc AGENTS.md, docs/HANDOFF-CODEX.md, docs/HANDOFF-CLAUDE.md và
docs/superpowers/plans/2026-10-08-claude-code-finish-video-tool.md.
Tiếp tục từ WIP f23202f: engine còn refactor Effects dở và chưa compile.
Làm từng task theo TDD/review, commit cục bộ, không push/merge.
Không đổi content-script generation flow. Core/tests phải đạt trước chạy thật,
tối đa 3 rows, maxRetries=0. Phiên Codex chưa chạy generation nào.
```

