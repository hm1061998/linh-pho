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

## D-010 — Camera overview tạm thời (Module 01) — đã thay thế bởi D-013

- **Trạng thái:** Đã bỏ ở Module 02. Camera overview cố định được thay bằng `CameraController`.

## D-011 — Input tách thành ba lớp

- **Chọn:** `InputService` (DOM: sự kiện bàn phím, con trỏ, wheel, blur) → `InputFrame` (một lần đọc mỗi frame) → logic di chuyển/camera thuần. `KeyboardState`, `keyBindings`, `moveInput` không dùng DOM.
- **Quy tắc:**
  - Phím theo `KeyboardEvent.code` (đúng vị trí vật lý, không phụ thuộc bố cục).
  - Bỏ qua khi đang gõ trong `input`, `textarea`, `select` hoặc vùng `contenteditable`.
  - Không chặn tổ hợp Ctrl/Cmd/Alt.
  - Chỉ `preventDefault` cho phím đã bind, để mũi tên không cuộn trang.
- **Khoá gameplay:** `pushBlocker(id)` / `popBlocker(id)`. Khi có blocker, `frame()` trả về trung tính và xoá phím đang giữ. Module dialogue/crafting/pause sẽ gọi hai hàm này.
- **Mất focus:** Sự kiện `blur` và `visibilitychange` (khi ẩn tab) xoá phím, joystick, drag và lần nhấn đang chờ. Nhân vật không trôi sau khi mất focus.
- **Lý do:** Prompt 02 yêu cầu tách input khỏi movement để sau này thêm gamepad mà không sửa logic di chuyển.

## D-012 — Va chạm 2D trên mặt đất, không dùng physics engine

- **Chọn:** Va chạm tròn–hộp (AABB) trên mặt phẳng XZ, tự viết trong `engine/player/collision.ts`. Vật cản lấy từ prop có `solid: true` trong `hubLayout.ts`. Footprint là hộp bao quanh `position ± size/2`.
- **Chia bước:** Mỗi lần di chuyển chia thành bước tối đa `0.25 × bán kính` (0.0875 m). Với bước này, vật mỏng 0.12 m (cọc quầy) không thể bị xuyên qua trong một khung hình. Test `cannot tunnel through a thin obstacle` kiểm chứng điều này.
- **Sông và cầu:** Sông được tách thành hai đoạn (`ENV_River_West`, `ENV_River_East`) và để trống ở đúng vị trí cầu (x 6.9–9.1). Cầu (`walkable`) là lối đi duy nhất qua sông. Hình ảnh không đổi vì mặt cầu che khe hở.
- **Độ cao:** `walkable` là mặt trên của prop. Quảng trường cao 0.08 m, mặt cầu 0.375 m, còn lại 0.
- **Lý do không dùng Ammo/PlayCanvas rigidbody:** Chỉ có vật cản tĩnh, cần kết quả xác định và test được trong Node. Nếu sau này có vật động hoặc địa hình phức tạp, xem xét lại.

## D-013 — Camera 3/4 có giới hạn

- **Chọn:** Góc nghiêng 45° cố định, yaw đổi bằng kéo ngang trên canvas (0.008 rad/px), zoom 30–90 m (wheel hoặc pinch), camera bám người chơi với `followRate` 6/s, tiêu điểm luôn nằm trong biên hub.
- **Không xuyên mái nhà:** Ở khoảng cách tối thiểu 30 m, camera cao khoảng 21 m so với mặt đất. Mái nhà cao tối đa 4.8 m, nên camera không bị kẹt trong mái. Mờ mái (roof fade) chưa làm vì chưa cần.
- **Yaw và di chuyển:** Phím W luôn đi về phía xa khỏi camera (`worldMoveDirection` theo yaw). Khi yaw đổi, W/D thay đổi theo hướng màn hình.

## D-014 — Nhân vật placeholder và ngữ nghĩa vận tốc

- **Chọn:** Capsule bán kính 0.35 m, cao 1.75 m, mũi màu đất nung chỉ hướng. Tốc độ 4.2 m/s, làm mượt gia tốc 12/s, quay mặt 14/s theo đường ngắn nhất.
- **`speed` là vận tốc dự định, không phải vận tốc thực.** Khi áp sát tường và giữ phím, `speed` vẫn khoảng 4.2 m/s dù vị trí không đổi. Nguyên nhân: vận tốc không bị tường triệt tiêu. Không đổi, vì đưa vận tốc về quãng đường thực tế sẽ làm vận tốc tăng vọt khi bị đẩy ra khỏi vật cản.
- **Dt:** Dùng dt đã bị engine clamp về 0.1 s, nên tab bị ẩn rồi quay lại không gây nhảy vị trí.
- **Xuất phát:** `(0, 10)`, nằm ngoài quảng trường và mọi vật cản.

## D-015 — Hook gỡ lỗi chỉ có trong dev

- **Chọn:** `window.__linhPho.game` được gắn trong `GameView.tsx`, bọc bởi `import.meta.env.DEV`, và gỡ khi unmount.
- **Lý do:** Cho phép kiểm tra trong trình duyệt (`debugSnapshot()`, `input.pushBlocker()`).
- **Kiểm chứng:** Sau `npm run build`, chuỗi `__linhPho` xuất hiện 0 lần trong bundle.

## D-016 — Điều khiển cảm ứng hiện theo con trỏ thô

- **Chọn:** `TouchControls` chỉ render khi `(pointer: coarse)`. Joystick đưa vector vào `InputService.setStick()`. Nút tương tác gọi `pressInteract()`.
- **Nút tương tác là placeholder:** Module 02 chỉ đếm số lần nhấn (`interactPresses`). Module 03 (`InteractionSystem`) sẽ tiêu thụ sự kiện này.
- **Khoá:** Joystick và nút bị bỏ qua khi có blocker (qua `frame()`).

## D-017 — Sự kiện có kiểu, một bus cho mỗi hệ thống

- **Chọn:** `shared/events/EventBus.ts` là bus generic. Mỗi sự kiện là một thành viên của union có trường `type`. `on(type, listener)` chỉ nhận đúng loại đã đăng ký và trả về hàm huỷ.
- **Quy tắc:** Listener ném lỗi được `console.error` và bỏ qua, không chặn listener khác (test `keeps delivering to other listeners when one throws`).
- **Hai bus hiện có:** `InteractionSystem.events` (`interaction.focusChanged`, `interaction.triggered`) và `DialogueSystem.events` (`dialogue.opened`, `changed`, `closed`, `error`).
- **Lý do:** Prompt 03 yêu cầu sự kiện tương tác có kiểu và không phụ thuộc HUD. Domain không import React. HUD subscribe, không gọi ngược vào logic.

## D-018 — Tương tác: một mục tiêu focus, tầm 2 m trên mặt đất

- **Chọn:** Mục tiêu trong tầm (khoảng cách XZ ≤ `range`, mặc định 2 m) có thể focus. Chỉ focus mục gần nhất. Khi hoà, thắng mục đăng ký trước (`Map` giữ thứ tự chèn, nên kết quả xác định).
- **Chiều cao bị bỏ qua:** NPC lơ lửng (Bấc) cũng dùng khoảng cách trên mặt đất, để người chơi không phải nhảy.
- **Nhấn ngoài tầm:** `press()` trả về `false`, không phát `triggered`. Test kiểm chứng điều này.
- **Không có hysteresis:** Hint có thể nhấp nháy khi đứng đúng ranh giới. Chưa thấy cần, nên chưa làm.

## D-019 — Mô hình hội thoại: mục vào, nút, lựa chọn, hiệu ứng

- **Cấu trúc JSON:** Một hội thoại có `entries` (mục vào, mục đầu tiên có điều kiện đúng thắng, mục không điều kiện là fallback) và `nodes`. Mỗi node có `speaker`, `textKey`, `effects`, `choices` và `next`.
- **Điều kiện và hiệu ứng:** Chỉ là cờ boolean (`{flag, equals}` và `{setFlag, value}`). Cờ chưa đặt được coi là `false`. Hiệu ứng của node chạy khi node hiển thị. Hiệu ứng của lựa chọn chạy khi chọn.
- **Chọn:** Phải chọn khi có lựa chọn hiển thị. Chạm hoặc E chỉ đi tiếp khi không có lựa chọn hiển thị.
- **Không ngõ cụt:** Nếu mọi lựa chọn đều bị ẩn, node đi theo `next` (test `falls through`). `next: null` kết thúc hội thoại với lý do `finished`.
- **Lỗi không ném ra ngoài:** `unknown_dialogue`, `no_matching_entry`, `unknown_node` và `already_open` đều phát `dialogue.error` và trả về `{ ok: false }`. Nếu lỗi xảy ra khi đang mở (nút đích không tồn tại), hội thoại đóng với lý do `error`.
- **Lý do:** Prompt 03 yêu cầu nút có text locale, người nói, lựa chọn, điều kiện và hiệu ứng. Mô hình này đủ cho Q00–Q02 và giữ được logic ở domain.

## D-020 — Nội dung JSON: loại bỏ mục sai, báo lỗi rõ ràng

- **Chọn:** `domain/content/validate.ts` kiểm tra mọi file trước khi dùng. Lỗi cấp `error` làm loại bỏ mục đó:
  - NPC sai kiểu, sai màu hoặc ID trùng bị bỏ.
  - Hội thoại có nút đích không tồn tại, người nói không phải NPC, khoá locale thiếu, hoặc điều kiện sai kiểu bị bỏ.
- **Ngoại lệ:** NPC có `dialogueId` không tồn tại vẫn được giữ, để người chơi thấy NPC và gặp lỗi an toàn khi tương tác.
- **Cảnh báo:** Hội thoại không có mục fallback chỉ cảnh báo, không bị loại.
- **Lý do:** Prompt 03: "missing ID/content yields safe error without crashing". Game chạy và log đủ để sửa JSON.
- **Kiểm chứng:** Nội dung thật không có lỗi nào (test `loads with no errors or warnings`). Mỗi lỗi phổ biến có một test.

## D-021 — Chuỗi hiển thị nằm trong locale, domain chỉ giữ khoá

- **Chọn:** Mọi `nameKey`, `textKey`, `labelKey` là khoá dạng chấm (`dlg.ba_nghiem.greet`). `src/content/locales/vi.json` là ngôn ngữ chính, `en.json` là dự phòng. `shared/i18n/translator.ts` dịch khi render.
- **Thiếu khoá:** Trả về `[key]` để lỗi hiện ra trên màn hình, và cảnh báo một lần trong console.
- **Tham số:** `{name}` được thay bằng giá trị. Tham số không khớp giữ nguyên.
- **Lý do:** Prompt 00 quy định không có chuỗi cứng trong domain và game system. Dùng khoá cũng giúp Module 08 thêm bộ chuyển ngôn ngữ mà không đổi domain.

## D-022 — Phím E: một lần nhấn chỉ được dùng một lần

- **Vấn đề đã gặp:** Một lần nhấn E vừa tiếp tục hội thoại vừa đặt hàng đợi tương tác. Khung hình sau, hội thoại đã đóng nên hàng đợi được xử lý, và hội thoại mở lại.
- **Chọn:** `shouldQueueInteract` (`engine/input/interactPolicy.ts`) chỉ đặt hàng đợi khi: phím là phím tương tác, không lặp, chưa bị `preventDefault` bởi UI, và game không bị khoá.
- **Thứ tự sự kiện:** `InputService` đăng ký trước panel, nên khi mở hội thoại nó thấy game bị khoá. Điều kiện `defaultPrevented` bảo vệ cả trường hợp ngược thứ tự.
- **Kiểm chứng:** Test `interactPolicy` (5 test). Trong trình duyệt, E đóng hội thoại và không mở lại; E sau đó mở lại được.

## D-023 — NPC placeholder có va chạm, Bấc không chặn

- **Chọn:** NPC dạng người có hộp va chạm 0.7 m (bằng bán kính nhân vật × 2). `hubCollision.ts` thêm các hộp này vào `solids`. Bấc (`kind: "spirit"`) không chặn và lắc nhẹ tại chỗ (sin 2.2 rad/s, biên độ 8 cm).
- **Vị trí:** Bà Nghiêm trên quảng trường, Cô Lam trước xưởng, Ông Độ bờ nam (qua cầu), Bấc trên quảng trường. Chưa kiểm tra có hệ thống rằng vị trí không chặn đường đi; mới kiểm chứng bằng đường đi thử trong trình duyệt.
- **Quay mặt:** NPC quay về người chơi khi hội thoại mở (`faceToward`). Không quay liên tục.
- **Lý do:** Art Bible §5 cho phép Bấc không có rig. Capsule là placeholder, GLB thay ở Module 09.
