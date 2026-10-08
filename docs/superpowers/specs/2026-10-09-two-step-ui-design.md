# 1Click Video Tool: giao diện 2 bước, hậu kỳ hàng loạt

Ngày 09/10/2026. Người dùng đã duyệt bố cục và luồng trong chat. Spec này nối tiếp
`../../../docs/superpowers/specs/2026-10-08-1click-video-tool-design.md` (spec gốc, nằm ngoài repo).
Mục nào không nhắc ở đây thì giữ nguyên như spec gốc.

## 1. Mục tiêu

Người dùng nói:
- "sửa lại cái gui cho gọn";
- "preview khung dọc đang chưa xem được";
- "cho chế độ tạo video riêng xong mới thêm text/voice";
- "thêm text và chèn nhạc hàng loạt … theo thứ tự file trong folder / excel".

"Voice" ở đây là **nhạc nền**, không có lồng tiếng hay TTS (người dùng đã xác nhận).

Thành công khi:
1. Tạo video và hậu kỳ là **hai bước tách hẳn**.
   - Bước 1 chỉ tạo và tải video gốc; xem được video ngay.
   - Bước 2 thêm text và nhạc, xuất được nhiều lần mà không tốn lượt Veo.
2. Khung xem trước đúng tỉ lệ cho cả 16:9 và 9:16, không méo.
3. Giao diện gọn:
   - cài đặt tạo video nằm trên một hàng;
   - kiểu chữ, nhạc và đầu ra nằm trong các mục gập lại được;
   - không còn trang Preset dài phải cuộn.
4. Text và nhạc gán được hàng loạt, theo thứ tự video (tên file tự nhiên) hoặc từ Excel/CSV.
5. Retry giữ nguyên ba mức:
   - extension tự thử lại theo "Tự thử lại";
   - nút "Thử lại dòng lỗi";
   - tự dừng khi 3 dòng lỗi liên tiếp.
6. Không sửa extension.

Ngoài phạm vi (YAGNI):
- lồng tiếng hoặc TTS;
- mẫu tên file tùy chỉnh;
- tạm dừng mềm (nút vẫn là "Dừng");
- đa ngôn ngữ.

## 2. Bố cục

Header, dùng chung cho cả hai bước, gồm:
- tên app;
- hai tab **1. Tạo video** và **2. Hậu kỳ**;
- ô **Preset** (danh sách preset + nút Lưu);
- đèn Extension kèm phiên bản. Bấm vào đèn thì hiện menu nhỏ: "Quên extension", "Chọn thư mục FFmpeg".

Đổi tab vẫn giữ quy tắc hiện có: flush preset trước khi chuyển, và khóa chuyển tab khi đang xử lý.

### 2.1 Bước 1, "Tạo video"

Thanh trên cùng: **Chọn folder ảnh**, **Nhập Excel/CSV**, **Dán nhiều prompt**, ô **Prompt chung**.

Hàng cài đặt (một dòng, cuộn ngang khi cửa sổ hẹp):
- Chế độ: Khung đầu / Ảnh tham chiếu;
- Tỉ lệ: 16:9 / 9:16;
- Chất lượng: 720p / 1080p;
- Luồng (1–10);
- Tự thử lại (0–5);
- ô tick **"Tự hậu kỳ luôn sau khi tạo"**.

Bảng, mỗi ảnh một dòng:
- ô chọn, ảnh nhỏ, tên file;
- **prompt sửa trực tiếp trong ô**: trống thì dùng prompt chung, placeholder hiện prompt chung;
- trạng thái;
- nút **Xem**: có video gốc thì mở video gốc, có thành phẩm thì mở thành phẩm;
- dòng lỗi: hover thấy lý do.

Chân trang: "x/y đã tạo", **Bắt đầu tạo**, **Dừng**, **Thử lại N dòng lỗi**, **Mở folder video gốc** (`_1click/raw`).

### 2.2 Bước 2, "Hậu kỳ"

Hai cột.

**Cột trái: danh sách video.**
- Mỗi dòng gồm: ô chọn, STT, ảnh nhỏ, ô **Text** sửa trực tiếp, chọn **Nhạc** (Tự động / từng file trong folder nhạc), trạng thái.
- Bấm một dòng để xem trước dòng đó.
- Trên danh sách có các công cụ hàng loạt (mục 4): **Dán nhiều text**, **Text theo mẫu**, **Gán nhạc lần lượt**, **Nhập Excel/CSV**.

**Cột phải: xem trước.**
- Khung đúng tỉ lệ. Nền là **video gốc của dòng đang chọn**: phát lặp, tắt tiếng, `object-fit: cover`. Dòng chưa có video gốc thì nền là ảnh gốc.
- Chữ vẽ bằng canvas phủ lên trên, kéo thả được, có 9 điểm hít.
- Ô tick "Kiểu/vị trí riêng cho video này".

Dưới cùng có ba mục gập lại được (`<details>`):
- **Kiểu chữ**: lưới 4 cột gọn — font, file font, cỡ, đậm, màu, viền (màu, độ dày), bóng, nền hộp (màu, độ mờ, bo góc, đệm), canh lề, rộng tối đa.
- **Nhạc nền**: folder, chế độ (Ngẫu nhiên / Lần lượt / Gán + dự phòng), âm lượng nhạc, âm gốc, fade vào/ra.
- **Đầu ra**: folder Output, ghi đè.

Chân trang: **Xuất dòng chọn**, **Xuất tất cả**, **Mở folder Output**.
"Xuất tất cả" chỉ lấy các dòng đã có video gốc. Không có dòng nào thì nút bị vô hiệu kèm gợi ý "Tạo video ở bước 1 trước".

### 2.3 Khung xem trước đúng tỉ lệ

Nguyên nhân lỗi: `.frame { width: 100%; max-height: 60vh; aspect-ratio }`. Khi bị giới hạn chiều cao, khung vẫn rộng 100%, còn canvas thì kéo giãn 100%×100%.
Cách sửa:
- khung có `width: min(100%, calc(<maxH> * w / h))` và `aspect-ratio: w / h`;
- căn giữa khung;
- `maxH` là `55vh` ở bước 2.

Toạ độ kéo thả vẫn lấy từ `getBoundingClientRect()` của canvas, nên tự đúng theo khung mới.

## 3. Trạng thái và luồng

- **`RowStatus::Generated`** (JSON `{"state":"generated"}`, nhãn **"Đã tạo"**): video gốc đã chép vào `_1click/raw`, chưa hậu kỳ. Đây là trạng thái kết thúc của bước 1.
- **`GenSettings.auto_post_process: bool`** (JSON `autoPostProcess`, serde default `false`):
  - `false`: `on_raw_ready` → `Generated`, không phát `PostProcess`.
  - `true`: như hiện tại, `Downloaded` → `PostProcess`.
- `running` chỉ đúng khi còn dòng đang gửi, đang render, `Downloaded` hoặc `PostProcessing`. Dòng `Generated` không tính là đang chạy.
- **Bắt đầu tạo** chỉ render overlay khi `autoPostProcess = true`; không thì gọi thẳng `start_run`. Engine chỉ gửi dòng `Pending`, như hiện tại.
- **Xuất** dùng lệnh `reprocess_rows` đã có:
  - UI render overlay cho các dòng được chọn, rồi gọi `reprocess_rows`;
  - `Runner::reprocess` nhận thêm các dòng `Generated`, ngoài `Done`, `Downloaded` và `Failed{PostProcess}` vốn có, với điều kiện dòng có `raw_video`;
  - nhạc được chọn lại theo thiết lập hiện tại, như hiện nay.
- **Dừng**: dòng `Generated` giữ nguyên, không bị hủy.
- **Thử lại**: giữ như cũ.
  - Lỗi khi tạo hoặc tải thì dòng về Chờ rồi gửi lại.
  - Lỗi hậu kỳ thì chỉ hậu kỳ lại.
- **Mở lại dự án** (`recover_after_load`):
  - dòng `Generated` còn file raw thì giữ nguyên;
  - dòng `Generated` mất file raw thì về `Pending` và xoá `raw_video`;
  - `Downloaded` và `PostProcessing` xử lý như cũ.
- **Dự án cũ**: thiếu `autoPostProcess` thì coi là `false`. Dòng `Done` vẫn là Xong và vẫn xuất lại được.

## 4. Hàng loạt (theo thứ tự video = STT = tên file tự nhiên)

| Công cụ | Lệnh backend | Hành vi |
|---|---|---|
| Dán nhiều text | `paste_texts(startStt, text)` | Mỗi dòng không rỗng là text của một video, điền lần lượt từ dòng đang chọn (không chọn dòng nào thì từ dòng 1). Trả về số dòng đã điền. Cùng quy tắc với `paste_prompts`. |
| Text theo mẫu | `apply_text_template(template, stts)` | `{stt}` thay bằng STT, `{ten}` thay bằng tên ảnh không đuôi. `stts` rỗng thì áp dụng cho mọi dòng. Ví dụ `Tập {stt}` cho ra "Tập 1", "Tập 2"… |
| Gán nhạc lần lượt | `assign_music_in_order(stts)` | Lấy file trong folder nhạc theo thứ tự tên tự nhiên, gán vào `row.music` của các dòng được chọn (rỗng = mọi dòng) theo STT tăng dần, hết thì quay vòng. Folder trống hoặc chưa chọn thì báo lỗi "Chưa có file nhạc trong folder nhạc". |
| Nhập Excel/CSV | `import_table(path)` (sửa) | Có cột `anh` thì khớp theo tên như hiện tại. **Không có cột `anh`** thì dòng dữ liệu thứ i (bỏ dòng tiêu đề) khớp với video có STT thứ i. Dòng thừa được báo "Dòng Excel N không có video". Phải có ít nhất một cột trong `prompt`, `text`, `nhac`, không thì báo "Bảng cần ít nhất một cột prompt, text hoặc nhac". Ô trống không ghi đè. |

Mọi lệnh hàng loạt đều:
- ghi `project.json` trong cùng transaction với các sửa đổi khác;
- phát sự kiện `project`;
- giống `update_row`: không chặn khi dòng đang chạy; thay đổi có hiệu lực ở lần xuất sau.

## 5. Kiến trúc frontend

| File | Vai trò |
|---|---|
| `src/App.svelte` | Header, hai tab, ô Preset, menu đèn Extension, toast, khóa chuyển tab, flush preset. |
| `src/tabs/GenerateTab.svelte` | Bước 1. Thay `SourceTab` và `RunTab`. |
| `src/tabs/PostTab.svelte` | Bước 2. Thay `PresetTab` và `RowPanel`. |
| `src/components/GenSettingsBar.svelte` | Hàng cài đặt tạo video, sửa `preset.gen`. |
| `src/components/PostList.svelte` | Danh sách video ở bước 2 và các công cụ hàng loạt. |
| `src/components/TextPreview.svelte` | Sửa tỉ lệ, thêm nền là video gốc. |
| `src/components/TextStyleEditor.svelte` | Lưới gọn 4 cột. |
| `src/components/MusicSettings.svelte`, `OutputSettings.svelte` | Nội dung các mục gập. |
| `src/lib/presetSync.ts` | Debounce/flush/scope cho `set_preset`. Tách từ PresetTab, giữ đúng hành vi cũ đã có test. |

Các test component hiện có của PresetTab và RunTab được chuyển sang component mới, giữ nguyên ý nghĩa. Không xoá test nào để cho xanh.

## 6. Xử lý lỗi

- Xuất mà không có dòng nào có video gốc: nút bị vô hiệu kèm gợi ý.
- Gán nhạc khi folder nhạc trống: toast lỗi, không đổi gì.
- Excel không khớp: toast liệt kê tên ảnh hoặc số dòng không khớp, như hiện nay.
- Video gốc không phát được trong xem trước: dùng ảnh gốc làm nền, không báo lỗi.
- Các lỗi FFmpeg, extension và quota giữ như spec gốc.

## 7. Kiểm thử

Viết test trước cho từng hành vi, thấy RED rồi mới GREEN.

**Rust**
- `on_raw_ready` cho ra `Generated` khi auto tắt, `PostProcess` khi auto bật.
- `running` là false khi chỉ còn dòng `Generated`.
- `reprocess` nhận dòng `Generated`.
- `recover_after_load` giữ dòng `Generated`, đưa về `Pending` khi mất raw.
- Dự án cũ thiếu `autoPostProcess` thì coi là false.
- `paste_texts`.
- `apply_text_template` với `{stt}`/`{ten}` và với `stts`.
- `assign_music_in_order`: thứ tự tự nhiên, quay vòng, folder trống.
- `apply_table`: không có cột `anh` thì khớp theo thứ tự; có dòng thừa; thiếu mọi cột dữ liệu.

**UI (vitest + happy-dom)**
- `TextPreview` 9:16: bề ngang khung không vượt `maxH * 9/16`.
- `TextPreview`: khung giữ đúng tỉ lệ.
- `TextPreview`: dùng video gốc làm nền khi có, ảnh gốc khi không.
- `GenerateTab`: Bắt đầu không render overlay khi auto tắt.
- `GenerateTab`: giữ các test của Dừng và Thử lại.
- `PostTab`: Xuất tất cả chỉ gửi các dòng có video gốc.
- `PostTab`: Xuất render overlay trước khi gọi `reprocess_rows`.
- `PostList`: công cụ hàng loạt gọi đúng lệnh với dòng đang chọn.
- Các test preset flush/scope chuyển sang `presetSync`.

**E2E**: `tests/e2e.rs` thêm một kịch bản: auto tắt, tải về thì ra `Generated`, xuất thì ra `Done`.

**Kiểm tra trên app thật** (không tốn quota): mở dự án `live-run`, chụp màn hình cả hai bước ở 16:9 và 9:16.
- Bước 2 xem trước phát video gốc.
- Xuất lại một dòng thì tạo được file mới trong Output.
