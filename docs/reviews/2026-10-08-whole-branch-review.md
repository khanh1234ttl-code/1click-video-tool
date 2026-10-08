# Whole-branch review — de0dd8b..eb72a95

Reviewed 2026-10-08. Scope: every meaningful code/config/document addition in the branch, in passes (model/persistence/runner; engine/bridge/commands; UI/media/import; extension/tests/docs). Generated lockfile detail and binary icons excluded. Read AGENTS.md, HANDOFF-CODEX.md, authoritative spec, plan Global Constraints/Review Focus, and progress ledger. Existing rulings (TOFU, split image protocol, scaled PNG, intentional form seeding) preserved. No source changes, quota use, or full-suite reruns. Parent supplied fresh passing 41 Rust unit + 1 e2e + 2 media + 6 UI + 7 extension tests and build/installer evidence. Findings below are code-path proofs; targeted regression tests are recommended for the fix wave.

## Strengths

- Rust data types, pure runner effects, Tauri commands and Svelte UI are separated coherently. JSON field names agree across the bridge and UI.
- Media invocation uses argument vectors and hides console windows; Unicode paths, audio-free input, image downscaling, and overlay scaling have meaningful real-FFmpeg coverage.
- Natural import sorting, prompt validation, randomized music bags, output suffix naming, and project recovery are implemented with focused tests.
- Extension bridge preserves the tested content-script generation flow and maps download results by job folder plus index. Separate backup/hash evidence and install instructions preserve the unpacked extension.
- README is Vietnamese, explains FFmpeg prerequisites, quota-consuming retries, raw storage, extension reload, packaging and development commands. It does not falsely claim the outstanding live run succeeded.

## Critical

None classified Critical. The Important lifecycle/persistence findings should be fixed before the real batch is released for general use.

## Important

### 1. Bind all asynchronous effects to the originating project/job/row operation

References: `src-tauri/src/engine.rs:140`, `:247`, `:250`, `:271`, `:287`, `:294`, `:308`, `:335`; `src-tauri/src/runner.rs:111`, `:123`, `:149`; `src/tabs/SourceTab.svelte:72`.

The folder picker allows project replacement while import/encoding/FFmpeg tasks are outstanding. Tasks carry only STT; they fetch the current project after awaiting and complete through `with_runner` on the current runner. Start A row 1, switch to B while the copy/probe or FFmpeg task is outstanding: A's completion writes its raw/output/status into B row 1. Queued postprocessing may even read B's media/configuration. Pause resets active rows, but a download import already dispatched can still mark that row Downloaded and process it; encoding likewise dispatches job.submit after Pause without checking cancellation. Two downloaded/query results before the first import finishes both spawn work because the row stays active, potentially racing the same raw/output file. A delayed rejection for an old paused job unconditionally sets `running=false` for a new job. Source's selected RowPanel also survives a project change when the STT matches and can save A's fields into B.

Use project epochs and per-row/job operation identities, synchronous claiming of imports/queued postprocessing, and checks before side effects and completion; capture immutable paths/options for each task. Reject stale job rejection/revert messages and post-encoding submits. Reset/re-key selected UI rows by project identity. A narrower explicit no-switch-while-work-pending policy is acceptable if enforced in the backend for the full task lifetime. Test paused import completion, old rejection after restart, duplicate download/query, switch during queued/running media, and cancel during encoding.

### 2. Serialize durable state writes and save job identity before dispatch

References: `src-tauri/src/engine.rs:147`, `:154`, `:229`; `src-tauri/src/project.rs:10`; `src-tauri/src/runner.rs:83`.

Engine edit clones state under the mutex but writes after releasing it; independent import/FFmpeg tasks also call Save concurrently. All writers use the same project.json.tmp. Two completions or an edit plus completion can overwrite/truncate that shared temporary file, rename each other's bytes, fail a rename, or persist an older snapshot last. A temp-plus-rename alone does not serialize writers. The start effect list additionally dispatches Submit before Save: a save error or process exit after generation submission leaves the durable project Pending with no jobId, so reopening can consume quota again rather than query the existing job.

Serialize mutation/snapshot/write ordering per project (unique temporary names alone do not prevent stale snapshots), save Sending and jobId before external submission, and abort dispatch when that save fails. Persist all changed lifecycle states before reporting success. Regression tests should force overlapping saves and a persistence failure before dispatch, then reload and verify the newest state and no job.submit on save failure.

### 3. Flush and scope preset edits before Save, Run, load, or project switch

References: `src/tabs/PresetTab.svelte:18`, `:22`, `:32`, `:37`; `src/tabs/RunTab.svelte:26`.

The local preset waits 400 ms before reaching Rust. Clicking Lưu before that deadline saves the backend's previous value, although the UI says it saved. Switching to Run and starting promptly renders overlays and submits using the previous preset. The timeout is not canceled on unmount and is not tied to a project, so it can subsequently overwrite another newly opened project's preset. A preset load also races pending edits. Catching save errors and continuing produces a false success toast.

Use an ordered, awaitable save/flush tied to project identity; pass the intended snapshot explicitly to named-preset save or flush first. Ensure navigation/run cannot observe stale settings; cancel or safely flush unmount timers. Only toast success on success. Add a fake-timer/component test for change-then-immediate-save/run and project navigation.

### 4. Reprocessing ignores edited music selection

References: `src-tauri/src/runner.rs:219`; `src-tauri/src/engine.rs:317`; `README.md:21`.

Reprocess only emits PostProcess, while the engine exclusively uses resolved_music assigned at initial Start. After a finished video used track A, changing its fixed track to B (or selecting a new music folder/mode after a silent first run) and choosing Chỉ hậu kỳ lại keeps A or silence. This breaks the UI/README promise that editing music can be applied without another Veo generation.

Resolve music for explicitly reprocessed selected rows using their current assignments and current preset/fallback, persisting that choice before processing. Keep ordinary crash recovery deterministic. Test A-to-B and no-music-to-music reprocessing, with no generation submission.

### 5. Restore and emit the actual running state

References: `src-tauri/src/runner.rs:34`, `:98`, `:235`; `src-tauri/src/engine.rs:139`, `:163`, `:249`; `src/tabs/RunTab.svelte:52`.

Runner::new initializes running=false, and recover_after_load never sets it true for persisted Sending/Rendering rows. The extension is queried and continues working, yet Pause stays disabled and three consecutive failures do not execute the cancellation guard requiring running=true. Separately, local import completion can turn running off without emitting Status; the UI only refreshes incidentally on later bridge traffic (normally up to a ping cycle). Initial encoding is also performed before exposing running status.

Derive/reconcile running from active generation work on recovery and emit status on local transitions, including before slow encoding and after final import. Test reopening an active job, Pause availability, and three failures after recovery.

### 6. Honor original audio volume when background music is absent

References: `src-tauri/src/media.rs:101`; `src-tauri/src/engine.rs:317`.

Original volume is carried only inside optional MixParams. With no music folder, empty/missing folder or deleted resolved track, the audio branch copies original audio unchanged. Setting Âm gốc to 0% therefore still emits the video's voice/audio. The audio control should work independently of whether a background track happens to exist.

Pass original volume independently of music and apply volume/re-encode for non-default values, retaining copy at 100% if desired. Add an argument test and a focused real-audio silence/RMS check for no music and 0% original volume.

### 7. Exact CSV/Excel filenames must take precedence over stem fallback

Reference: `src-tauri/src/import.rs:103`.

The single `.find` combines exact filename and stem alternatives. For rows a.jpg followed by a.png, an explicit table record `anh=a.png` matches the first a.jpg row through the stem alternative, assigning that image's prompt/text/music incorrectly. This violates exact filename mapping and can consume generation quota on the wrong prompt/image pairing.

Try case-insensitive exact filename first, then an unambiguous stem fallback. Report ambiguous extensionless names instead of silently taking the first. Test two supported image extensions sharing a stem.

## Minor / follow-up

- `src-tauri/src/project.rs:23`: the comment promises moved projects keep working, but only image_dir is rebased; image_path/raw_video/output remain absolute. Either support rebasing project-owned paths or narrow the comment/documented portability claim.
- `src/tabs/SourceTab.svelte:11`, `:44`: Dán nhiều prompt always seeds pasteFrom=1 and never follows the selected row, contrary to the selected-row default in the spec; the visible starting-row input still permits a workaround.
- `src/components/TextPreview.svelte:13`: resolution values w/h are read only inside the asynchronous `.then`, outside synchronous effect tracking. A ratio/quality-only change resizes/clears the canvas without necessarily redrawing until another style/text change. Track the dimensions synchronously and reject stale async draws. Verify portrait preview geometry as well.
- `src/lib/overlay.ts:48`: shadow is only painted with strokeText; enabling shadow while setting stroke width to zero draws no shadow. Apply shadow to a paint operation that always occurs.
- `src-tauri/src/engine.rs:161`: start checks only ffmpeg, though every received video also requires ffprobe. Detect both up front so a missing ffprobe does not waste a generation before failing import.
- Spec lists a separate Dừng control and customizable output name pattern; this implementation has Pause and a fixed STT/stem format per detailed plan. Confirm/document the plan's scope reduction if those controls are required; avoid claiming full spec parity.
- `src-tauri/src/bridge.rs:198`: TOFU uses an allowed-id snapshot taken before asynchronous handshake. Concurrent initial handshakes can both be admitted; recheck/claim allowed id atomically at acceptance. Existing accepted TOFU design itself is not being reopened.

## Extension fix delta

Task 12 reviewer has independently identified cancel-during-prepare and download-during-worker-hydration issues; their fix wave is ongoing. Those findings are not duplicated here. This review has read the original bridge and the new in-progress regression test additions. The final bridge implementation delta and its test result must be inspected before closing this review.

## Recommendations and assessment

Fix the seven Important issues with targeted failing tests, then run the required existing suites and rebuild the installer because the reviewed installer predates fixes. Keep the controlled real Google run at at most three rows after lifecycle fixes. Do not merge/push without the user's instruction.

**Ready to merge: With fixes (not yet).** The normal-path architecture and integration evidence are strong, but asynchronous ownership/persistence and stale UI/music settings can associate output with the wrong row or lose recoverability. The live Google run also remains outstanding evidence, separately tracked by the parent.

### Extension follow-on inspected — 3e27fa8

Read the full bridge/test delta from 20066e2 to 3e27fa8 and Task 12 repair evidence. Per-submission cancellation is now checked after tab lookup, each image prepare and dispatch acknowledgement; cancel during dispatch is forwarded. Shared jobsReady gates WebSocket handling, runtime messages and download listeners before accessing restored state. The four new regression cases cover the identified boundaries; reported evidence is 11/11 extension tests passing with source/external identity and module syntax checks. No additional Important finding in this delta. Dedicated Task 12 re-review remains its final scoped gate. The delayed job.rejected response makes desktop Important issue 1's stale-rejection guard particularly relevant. The seven desktop/UI Important findings and merge assessment above remain unchanged.
