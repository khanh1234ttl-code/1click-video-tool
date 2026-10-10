# Extension Vids Automation – 1 Click Studio (v1.1.10.0)

Bản đầy đủ của extension, đã có bridge (`assets/oneclick-bridge.js`) để nói chuyện với 1Click Video Tool.
Bộ cài Windows/Mac đã kèm sẵn extension này trong trình duyệt Vids riêng, nên khách không cần cài tay.

## Cài vào Chrome có sẵn (tuỳ chọn)

1. Mở `chrome://extensions`, bật **Developer mode**.
2. Bấm **Load unpacked** và chọn folder `extension/` này.
3. Mở 1Click Video Tool. Lần đầu tool tin extension nào kết nối trước; muốn đổi thì bấm đèn
   **Extension** → **Quên extension**.

## Sửa extension

- Giữ nguyên luồng tạo video trong content script (`assets/index.ts-DUXzPPUe.js`,
  `assets/index.ts-Bqt83c-l.js`). Ghi mọi thay đổi vào `FIX_NOTES.txt`.
- Phần nối với tool nằm trong `assets/oneclick-bridge.js`, được nạp từ `service-worker-loader.js`.
- Kiểm thử bridge: `npm run test:ext`. Sau khi sửa, bấm Reload extension trong `chrome://extensions`.
- `python scripts/fetch-vendor.py` chép folder này vào bộ cài.
