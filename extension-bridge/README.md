# Bridge cho extension 1Click

`assets/oneclick-bridge.js` là bản nguồn được lưu trong git. Kiểm thử `npm run test:ext`
chạy trực tiếp module đã cài trong extension ở folder bên cạnh repo.

Để cài lại bridge vào extension v1.1.9.9:

1. Sao lưu toàn bộ extension.
2. Chép `assets/oneclick-bridge.js` vào `assets/` của extension.
3. Thêm `import './assets/oneclick-bridge.js';` sau import hiện có trong
   `service-worker-loader.js`.
4. Trong `manifest.json`, đặt `version` thành `1.1.10.0`, `version_name` thành
   `1.1.10.0 - bridge cho 1Click Video Tool`, thêm quyền `alarms` và host
   `http://127.0.0.1/*`.
5. Ghi thay đổi vào `FIX_NOTES.txt`, chạy kiểm thử và kiểm tra cú pháp ES module.
6. Bấm Reload extension trong `chrome://extensions`.

Module dùng giao thức hiện có của content script. Giữ nguyên
`assets/index.ts-DUXzPPUe.js` và `assets/index.ts-Bqt83c-l.js`.
