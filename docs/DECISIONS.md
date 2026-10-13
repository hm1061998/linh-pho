# Quyết định kiến trúc

Ghi các quyết định có ảnh hưởng lâu dài. Mỗi mục: bối cảnh, lựa chọn, lý do, đánh đổi.

## D-001 — PlayCanvas Engine standalone qua npm, chỉ WebGL2 (Module 01)

- **Chọn:** `playcanvas@2.23.2` dùng như thư viện npm, không dùng PlayCanvas Editor. `createGraphicsDevice(canvas, { deviceTypes: ['webgl2'] })`.
- **Lý do:** GDD G1 chốt standalone + TypeScript. WebGL2 là baseline; WebGPU để sau.
- **Đánh đổi:** Chưa có WebGPU. Khi bật thử, thêm nhánh `webgpu` có fallback về WebGL2 và ghi quyết định mới.

## D-002 — Canvas tạo mới mỗi lần mount, ngoài React

- **Chọn:** `GameView` tạo `<canvas>` bằng DOM API cho mỗi lần chạy effect, gắn vào `.game-viewport`. Cleanup gọi `GameApp.dispose()` rồi gỡ canvas.
- **Lý do:** React StrictMode và HMR chạy effect hai lần trên cùng DOM node. Dùng chung canvas có thể làm hai engine dùng chung WebGL context. Canvas mới giúp mỗi instance độc lập.
- **Kiểm chứng:** Trong dev browser, DOM chỉ có 1 canvas sau khi StrictMode mount hai lần. Số `requestAnimationFrame` đo được là 60/s, nghĩa là chỉ còn một vòng lặp.

## D-003 — React không render object 3D

- **Chọn:** React chỉ sở hữu HUD và trạng thái khởi động. Scene, camera, ánh sáng và vật thể do `src/engine/` tạo qua PlayCanvas API.
- **Lý do:** GDD G1: "Đừng để React render 3D game objects mỗi frame".

## D-004 — Kích thước canvas: FILLMODE_NONE + RESOLUTION_AUTO, theo container

- **Chọn:** `setCanvasFillMode(FILLMODE_NONE)`, `setCanvasResolution(RESOLUTION_AUTO)`. `ResizeObserver` trên container gọi `app.resizeCanvas(clientWidth, clientHeight)`.
- **Lý do:** Engine không tự lắng nghe `resize` của window. Quan sát container còn bắt được đổi zoom trình duyệt và thanh địa chỉ trên mobile.
- **DPR:** `device.maxPixelRatio = min(devicePixelRatio, 2)` (`MAX_PIXEL_RATIO` trong `shared/utils/display.ts`). Trên màn hình 3x không render 9× pixel.
- **Đã kiểm chứng:** 1348×914 ở DPR 1; 375×812 ở DPR 2 cho backbuffer 750×1624; đổi kích thước trực tiếp cập nhật đúng.
- **Chưa xử lý:** Đổi DPR mà không đổi kích thước container (kéo cửa sổ sang màn hình khác) không được phát hiện. Ghi vào known issues.

## D-005 — Tạm dừng khi ẩn tab: timeScale = 0 + autoRender = false

- **Chọn:** Khi `document.hidden`, đặt `app.timeScale = 0` và `app.autoRender = false`. Khi hiện lại, khôi phục `1` và `true`.
- **Lý do:** Logic gameplay ở Module sau đọc `dt` nên không chạy khi ẩn tab. Ngoài ra không render khi không thấy được frame.
- **Dt clamp:** Dùng `maxDeltaTime` mặc định của engine (0.1 s) để không bị nhảy thời gian khi quay lại tab. Module 02 sẽ kiểm tra lại khi viết controller.
- **Chưa kiểm chứng:** Chưa thử đổi tab thật trong trình duyệt.

## D-006 — Blockout là dữ liệu TypeScript, không phải JSON content

- **Chọn:** `src/engine/scene/hubLayout.ts` khai báo mảng `HUB_PROPS` có kiểu rõ ràng.
- **Lý do:** GDD G2 yêu cầu JSON cho NPC, hội thoại, nhiệm vụ, vật phẩm và công thức. Bố cục hub là dữ liệu thiết kế cảnh, không nằm trong danh sách đó. Kiểu TS bắt lỗi ngay lúc compile.
- **Cần xem lại:** Nếu sau này cần chỉnh cảnh bằng công cụ ngoài code, chuyển sang JSON và giữ `BlockoutProp` làm schema.

## D-007 — Mã lỗi khởi động tách khỏi engine

- **Chọn:** `src/app/startupErrors.ts` (không import PlayCanvas/DOM) ánh xạ lỗi thành `GameStartupError` với `code`: `webgl2_unavailable` | `engine_init_failed`.
- **Quy tắc:** Vì chỉ yêu cầu WebGL2, một `AggregateError` từ `createGraphicsDevice` nghĩa là WebGL2 không khả dụng.
- **Lý do:** Test được trong Node. Panel lỗi nhận mã, không cần biết chi tiết engine.

## D-008 — Copy tiếng Việt tạm nằm trong UI

- **Chọn:** `StartupErrorPanel.tsx` có chuỗi tiếng Việt hard-code.
- **Lý do:** Prompt 00 yêu cầu locale files, nhưng hệ thống i18n thuộc Module 08. Chuỗi này chỉ là màn hình lỗi.
- **Việc cần làm:** Module 08 chuyển sang `src/content/locales/vi.json` và `en.json`.

## D-009 — Phiên bản công cụ

- **Chọn:** React 19.3, Vite 8.3 (Rolldown), Vitest 5.0, TypeScript 7.0.2 (trình biên dịch native), `@vitejs/plugin-react` 6.1.
- **Lý do:** Đây là bản mới nhất khi bắt đầu dự án. Typecheck, test và build đều đạt với bộ này.
- **Rủi ro:** TypeScript 7 là major mới. Nếu một plugin hoặc editor lỗi, hạ về 5.x và ghi quyết định mới.

## D-010 — Camera overview tạm thời (Module 01)

- **Chọn:** Camera cố định ở `(0, 50, 56)` nhìn `(0, 0, 6)`, góc nghiêng 45°, FOV 50°.
- **Lý do:** Chỉ để xem blockout. Module 02 thay bằng `CameraController` có giới hạn zoom và không xuyên tường.
- **Ghi chú:** Điểm nhìn lệch về nam 6 m để mép sông không bị cắt do phối cảnh.
