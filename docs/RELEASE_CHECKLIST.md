# Checklist phát hành

Dùng cho mỗi bản chơi thử hoặc bản phát hành. Mục nào chưa làm thì để trống, không đánh dấu thay.

## Mã và kiểm thử

- [ ] `npm run typecheck` sạch.
- [ ] `npm test` đạt hết (hiện 42 tệp, 354 test).
- [ ] `npm run build` thành công. Ghi lại kích thước `index-*.js` và gzip vào `docs/QA_REPORT.md`.
- [ ] Số phiên bản trong `package.json` đã tăng, và ghi chú thay đổi.
- [ ] Mọi thay đổi định dạng lưu có bước migration và test migration (`saveMigration.test.ts`).

## Bản production

- [ ] `npm run preview` mở được, HUD hiện, canvas hiện, không lỗi console.
- [ ] Không có 404 (kiểm tra danh sách tài nguyên và `/favicon.ico`).
- [ ] Không có dev hook: `window.__linhPho` không tồn tại, và `dist/` không chứa `__linhPho`.
- [ ] Không có công cụ dev: F4 không mở được bảng asset, và asset `dev.*` không tải.
- [ ] Menu tạm dừng: tiếp tục, ngôn ngữ, hiệu ứng, âm thanh, chữ lớn, chất lượng, bắt đầu lại đều hoạt động.
- [ ] Lưu và tải lại giữ đúng tiến trình giữa Q00, Q01, Q02.

## Nội dung và pháp lý

- [ ] Mọi asset bên thứ ba có dòng trong `docs/ASSET_SOURCES.md` với giấy phép và phạm vi dùng.
- [ ] `docs/ASSET_MANIFEST.md` khớp với các model thực sự có trong `assets.json`.
- [ ] Thẻ câu chuyện: không có sự kiện nào được đánh dấu `verified` mà thiếu nguồn. Teaser chương 2 đã được biên tập (`src/content/story_cards.json`).
- [ ] `docs/PRIVACY.md` đã được người phụ trách duyệt. Hiện chỉ là bản nháp.

## Thiết bị (ghi rõ đã thử hay chưa)

- [ ] Desktop Chromium: FPS đo bằng công cụ của trình duyệt, không dùng pane. Mục tiêu 60.
- [ ] Android tầm trung: xoay ngang, joystick, minigame kéo thả, FPS. Mục tiêu 30.
- [ ] Firefox: đặc biệt kiểm tra chữ lớn (`zoom`) và lưu.
- [ ] Safari (iOS và macOS): lưu và âm thanh.

## Ghi chú cho bản PWA (nếu thêm sau)

Xem `docs/PWA.md`. Hiện chưa có manifest, nên không mục nào ở đây bắt buộc.
