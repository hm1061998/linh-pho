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

## D-024 — Thiết bị cảm ứng phải xoay ngang

- **Chọn:** Khi `(pointer: coarse) and (orientation: portrait)` (điện thoại hoặc máy tính bảng cầm dọc), `OrientationGate` phủ toàn màn hình bằng thông báo "Xoay ngang thiết bị để chơi". Overlay có `pointer-events: auto` và `touch-action: none` nên chạm không xuống canvas (đã kiểm chứng: phần tử ở giữa màn hình là overlay). Trong lúc overlay hiện, `pushBlocker('orientation')` khoá input gameplay. Xoay ngang thì gỡ overlay và gỡ blocker.
- **Vì sao không dùng `screen.orientation.lock`:** Chỉ hoạt động khi đang toàn màn hình (một số nền tảng) và Safari iOS không hỗ trợ. Không thể bắt trình duyệt xoay máy. Overlay là cơ chế thực thi.
- **Phạm vi:** Cùng một media query trong TypeScript (`PORTRAIT_TOUCH_QUERY`). Không có bản sao trong CSS, nên không lệch giữa hai nơi. Máy tính bảng cầm dọc cũng bị chặn, vì điều kiện là `pointer: coarse`. Nếu chỉ muốn chặn điện thoại, thu hẹp truy vấn (ví dụ thêm `max-width`).
- **Việc sau này:** Khi có PWA (Module 11), khai báo `orientation: "landscape"` trong manifest để lúc cài đặt cũng hướng ngang.
- **Kiểm chứng:** 375×812 hiện overlay, input khoá, nhân vật không đi. 740×360 ẩn overlay, input mở, đi được 2.98 m. Overlay chặn chạm xuống canvas.

## D-025 — Không bôi đen chữ trong HUD

- **Chọn:** `body, body *` có `user-select: none` và `-webkit-touch-callout: none`. Trường nhập liệu (`input`, `textarea`, `contenteditable`) được giữ `user-select: text`, để khi có form (ví dụ đặt tên) vẫn gõ và chọn chữ được.
- **Phạm vi:** Áp dụng cho mọi phần tử HUD và overlay. Chữ trong panel hội thoại, nhãn nút, hint đều không chọn được (đã kiểm chứng: nhấp ba lần không chọn gì).
- **Lưu ý:** Nhấp ba lần lên thân hội thoại vẫn đi tiếp hội thoại, vì đó là chạm để tiếp tục (đúng thiết kế, không phải lỗi bôi đen).
- **Kiểm tra tự động:** `localeKeys.test.ts` đảm bảo mọi chuỗi `t('...')` trong code đều có trong `vi.json`, và hai locale có cùng tập khoá. Overlay mới được bắt bởi test này.

## D-026 — Ánh xạ vật phẩm theo GDD

- **Tám vật phẩm:** tre, giấy dó, mực, màu lam, dây gai, gỗ vụn (nguyên liệu), Đèn Mộc, Đèn Vân Linh.
- **Lồng đèn soi vết:** GDD liệt kê "lồng đèn soi vết" trong danh sách 8 vật phẩm, nhưng Prompt 05 gọi cùng món là Spirit Pattern Lantern (Đèn Vân Linh) và GDD B4 làm công thức phụ ra Đèn Vân Linh. Ta dùng một món duy nhất: `spirit_lantern` = Đèn Vân Linh. Nếu cần món thứ tám riêng, thêm vào `items.json`.

## D-027 — Kho đồ: giữ chỗ trước, tiêu một lần khi xong

- **Chọn:** `Inventory.reserve` giữ nguyên liệu cho một lần chế tạo. `commit` tiêu đúng một lần khi thành công. `release` trả lại khi huỷ. Mọi thao tác là nguyên tử: thiếu một mục thì không đổi gì.
- **Chất lượng:** Chỉ vật phẩm `qualifiable` có chất lượng (thường, đẹp, hoàn mỹ), mỗi chất lượng một stack riêng. Nguyên liệu thô không có chất lượng, và yêu cầu chất lượng với nguyên liệu thô là lỗi nội dung.
- **Lý do:** Prompt 06 yêu cầu nguyên liệu bị giữ, chỉ tiêu khi thành công, và huỷ không mất đồ.

## D-028 — Nhiệm vụ đếm nguồn riêng biệt, thưởng đúng một lần

- **Chọn:** Mỗi mục tiêu đếm các `sourceId` khác nhau. Một lần nhặt, một lần chế tạo, một lần đặt chỉ tính một lần, dù sự kiện lặp lại. Khi mọi mục tiêu xong, nhiệm vụ chuyển `completed` và phát `quest.completed` một lần. Nhiệm vụ đã xong bỏ qua mọi sự kiện sau đó.
- **Kích hoạt:** `autoStart` nhiệm vụ không có tiên quyết bắt đầu khi `start()`. Nhiệm vụ có tiên quyết bắt đầu khi tiên quyết xong. `startQuest` cho nhiệm vụ không tự bắt đầu.
- **Phần thưởng:** `GameSession` áp dụng thưởng khi nhận `quest.completed`, nên thưởng chỉ đến một lần. Test: `pays 30 coins exactly once`.
- **Khôi phục:** `restore` bỏ qua ID nhiệm vụ và mục tiêu không còn trong nội dung, để save cũ vẫn tải được.

## D-029 — Phiên chơi là domain thuần, engine chỉ gửi và nhận sự kiện

- **Chọn:** `domain/GameSession.ts` nối cờ, ví, kho, chế tạo, nhiệm vụ, hội thoại và điểm đặt. Không có import PlayCanvas hay DOM, nên toàn bộ luồng Q00 chạy được trong test Node với nội dung thật (`gameSession.test.ts`).
- **Engine:** `GameApp` chỉ chuyển tương tác thành lời gọi phiên (`routeInteraction`), và đẩy trạng thái thế giới qua `WorldView.sync(snapshot)`. Không giữ trạng thái gameplay riêng.
- **Thông báo:** Phiên phát `notice` với khoá locale. Tham số kết thúc bằng `Key` (ví dụ `itemKey`) là khoá và được dịch ở giao diện (`renderNotice`).

## D-030 — Tương tác: loại mục tiêu và panel khoá đầu vào

- **Loại:** `npc` (hội thoại), `pickup` (nhặt), `station` (mở panel chế tạo), `placement` (đặt đồ). Mỗi loại có động từ hint riêng (`ui.action.*`).
- **Hết việc:** Pickup đã nhặt và placement đã đầy được gỡ khỏi `InteractionSystem`, nên hint biến mất.
- **Panel:** Phiên giữ một panel mở tại một thời điểm (`craft` hoặc `inventory`). Mở panel đẩy blocker `panel`, đóng thì gỡ. Đóng panel chế tạo đang dở sẽ trả nguyên liệu (`cancelCraft`).
- **Phím:** I mở kho, Escape đóng panel. Hai phím bị bỏ qua khi có hội thoại mở, vì hội thoại dùng chúng trước.

## D-031 — Minigame chế tạo là placeholder xác nhận (tạm thời)

- Module 04 chỉ có nút "Lắp" để chế tạo ngay, để kiểm chứng luồng kho và nhiệm vụ. Module 06 thay bằng minigame lắp khung và khắc, theo Prompt 06. `recipe.miniGame` đã có trong dữ liệu để đổi mà không sửa phiên. **Đã thay ở Module 06 (D-037 đến D-040).**

## D-032 — Đo khung hình trong pane trình duyệt không đáng tin lúc này

- Ở phiên kiểm thử Module 04, pane trình duyệt cho khung hình chỉ khoảng 3 lần/giây. Đã kiểm tra: GPU rảnh, luồng chính không bị chặn (độ trễ timer bình thường), iframe trống cũng 3 lần/giây, và scene rỗng cũng chậm. Lỗi nằm ở môi trường, không ở game.
- Khi khung hình thấp, `dt` bị giới hạn ở 0.1 s nên nhân vật đi chậm hơn. Trong phiên kiểm thử đã tăng `app.maxDeltaTime` lên 0.5 s **chỉ trong trình duyệt** để rút ngắn thời gian. Đây không phải thay đổi code, và không có trong bản build.

## D-033 — Đèn Soi Linh: máy trạng thái hai pha, chuyển tiếp 0.35 s (Module 05)

- **Chọn:** `domain/lantern/LanternPhase.ts` giữ bốn pha `real`, `to_spirit`, `spirit`, `to_real`. Chuyển tiếp mất `LANTERN_TRANSITION_S` = 0.35 s, tính bằng `dt` của engine. `spiritAmount` là smoothstep của tiến độ, dùng cho hình ảnh.
- **Hàng đợi:** Nhấn Q trong lúc đang chuyển tiếp chỉ xếp hàng đúng một lần. Các lần nhấn thêm bị bỏ qua, nên nhấn liên tục không lật đèn nhiều lần.
- **Cập nhật hình ảnh:** Phiên phát `changed` khi đổi pha, và ở mỗi khung hình trong lúc chuyển tiếp, vì ký hiệu và tint đọc `spiritAmount` theo từng khung (`GameSession.updateLantern`). Khi đã ổn định thì không phát nữa.
- **Đầu vào:** Phím Q (`LANTERN_KEYS`) và nút đổi đèn trên cảm ứng gọi cùng một đường `pressLantern()`, không có đường riêng.

## D-034 — Ký hiệu chỉ tồn tại ở Đèn Soi Linh

- **Hiển thị:** `WorldView.sync` bật các ký hiệu khi `spiritAmount` > 0, nên chúng hiện dần theo chuyển tiếp.
- **Tương tác:** Ký hiệu chỉ nhận focus và hint khi pha đã là `spirit` ổn định (`InteractionSystem.setEnabled`). Trong pha `real` chúng không có hint.
- **Quy tắc ở domain:** `scanGlyph` tự kiểm tra `isSpirit` và trả `not_spirit`. Engine không được phép quyết định việc quét. Thông báo `error.not_spirit` là lỗi được hiển thị cho người chơi.

## D-035 — Puzzle thứ tự: sai thì xoá mục nhập, không mất gì

- **Chọn:** `domain/puzzle/GlyphPuzzle.ts`. Người chơi chọn đủ ba ký hiệu rồi khắc. Chọn trùng, chọn ký hiệu không thuộc puzzle, chọn khi đã đủ, hoặc chọn khi đã giải đều bị từ chối.
- **Sai thứ tự:** Xoá mục nhập và tăng `attempts`. Không tiêu nguyên liệu, vì mục nhập không phải tài nguyên.
- **Gợi ý mở dần** (`puzzles.json`): `puzzle.hint.1` sau 1 lần thử, `puzzle.hint.2` sau 3 lần. Panel hiện gợi ý ở cấp cao nhất đã mở.
- **Giải đúng:** Đặt cờ `recipe_spirit_lantern_known` (mở công thức Đèn Vân Linh) và tính mục tiêu `puzzle` của nhiệm vụ. Puzzle đã giải không mở lại.

## D-036 — Hiệu ứng: tint bằng CSS, hạt có pool, cầu dùng material riêng

- **Tint:** Một `div` có `opacity` = `spiritAmount`, với transition CSS 0.35 s. Không vẽ lại canvas.
- **Hạt `SpiritBurst`:** Tám hạt cố định, dùng lại, sống 0.45 s. Không tạo entity mới mỗi lần bật đèn. Khi `setReducedVfx(true)` thì không phát hạt. Tint và ký hiệu vẫn hiện vì đó là phản hồi chức năng.
- **Cầu sáng:** `ENV_Bridge_Deck` dùng chung material với các vật gỗ khác trong blockout. `WorldView` clone material một lần rồi chỉ chỉnh bản clone, nên sáng cầu không làm sáng gỗ khác. Cầu sáng khi cờ `bridge_glow` bật (đặt khi Q01 hoàn thành).

## D-037 — Minigame là đối tượng riêng, không đụng kho (Module 06)

- **Chọn:** `domain/minigame/`: `AssemblyGame` (ba ô, mỗi ô nhận một thanh tre) và `EngravingGame` (ba dấu, theo thứ tự). Trạng thái minigame không nằm trong kho. Kho chỉ được giữ chỗ khi bắt đầu chế tạo, và commit hoặc release khi kết thúc (`CraftingSystem`).
- **Hoàn tất tự động:** Khi minigame báo `complete`, `GameSession` gọi `CraftingSystem.complete` với chất lượng do minigame tính. `completeCraft(quality)` đã bị bỏ. Không còn đường nào để giao chất lượng từ bên ngoài, nên UI không thể tự cấp Đẹp hay Hoàn Mỹ.
- **Chỉ một lần:** Sau khi hoàn tất, craft và minigame được xoá cùng lúc. Các lần chạm sau đó trả `no_minigame`, không thêm đồ.
- **Vòng đời craft:** Craft chỉ tồn tại khi panel chế tạo của nó đang mở. Rời panel (đổi sang kho, nhấn Escape, đóng panel) thì huỷ craft và trả nguyên liệu. Phím I bị chặn khi đang craft, để không mất minigame vô tình.
- **Engraving gọi ngược về puzzle:** Thứ tự khắc là thứ tự của puzzle đã giải tại trạm. Không có puzzle đã giải thì công thức báo `locked` trước khi giữ chỗ.

## D-038 — Chất lượng theo điểm, ngưỡng rộng

- **Ngưỡng:** Good từ 0.6, Perfect từ 0.8 (`domain/minigame/quality.ts`). Dưới 0.6 vẫn là Thường: một món hoàn tất không bao giờ là thất bại.
- **Lắp khung:** Độ chính xác của mỗi lần gắn là `1 - 0.5 × offset`, với offset tính bằng bán kính ô (0 là tâm, 1 là mép). Mép vẫn được một nửa điểm. Mỗi lần thả trượt trừ 0.05 điểm, và không bao giờ rút lại thanh đã gắn.
- **Khắc:** Điểm là `1 - 0.25 × số lần sai`. Không sai là Hoàn Mỹ (perfect), sai một lần là Đẹp (good), sai hai lần trở lên là Thường.
- **Không dùng thời gian:** Prompt cho phép chính xác hoặc thời gian. Chọn chính xác, vì thời gian làm khó người chơi cảm ứng mà không thêm thông tin.

## D-039 — Khắc không lộ thứ tự, sai không reset

- Giao diện chỉ hiện ba dấu theo thứ tự hiển thị cố định. Thứ tự đúng không được gửi đến UI (`MiniGameView` không có trường `order`, có test kiểm tra). Người chơi phải nhớ thứ tự đã tìm ở Q01.
- Chạm sai không xoá các dấu đã sáng. Chạm lại dấu đã sáng tính là một lần sai. UI khoá dấu đã sáng để không chạm nhầm.

## D-040 — Giao diện minigame là placeholder HTML, chưa phải 3D

- **Khung lắp:** Vẽ bằng HTML và CSS, ba ô tròn trên một vòng đứt nét. Chưa có khung 3D và chưa có xoay vật thể (GDD, phần «Lắp Khung Đèn»). Hai phần này chờ Module 09 khi có asset.
- **Cách chọn:** Chạm thanh tre rồi chạm ô; hoặc kéo thả vào ô gần nhất. Bàn phím dùng nút thường. Chạm hoặc kéo ra ngoài mọi ô tính là một lần trượt.
- **Phản hồi:** Ô sáng lên bằng animation CSS 450 ms và rung ngắn (`navigator.vibrate`, nếu trình duyệt hỗ trợ). Chưa có tiếng «tách», để Module 08 làm cùng SFX tổng hợp.
- **Giảm chuyển động:** `prefers-reduced-motion` tắt animation.

## D-041 — Cửa hàng: tiền kiếm được, mua và đặt là một bước nguyên tử

- **Tiền:** Chỉ có Xu Đèn kiếm được (phần thưởng nhiệm vụ, đơn hàng). Không có tiền thật, không tích hợp thanh toán (Prompt 07).
- **Mua:** `GameSession.buyFurniture` kiểm tra đủ mọi điều kiện trước (cấp tiệm, cờ, số tiền), rồi mới trừ tiền và thêm tồn kho. Số dư không bao giờ âm. Test: `q02.test` (không đủ tiền thì từ chối, số dư giữ nguyên).
- **Ô trưng bày:** Ba ô cố định (`shop.json`). Một ô chỉ giữ một món. Ô mở theo cấp tiệm (ô 3 ở cấp 2). Đặt món khỏi tồn kho vào ô là một bước: kiểm tra trước, rồi chuyển.
- **Cấp tiệm:** Cấp 1 sau Q00, cấp 2 khi Q02 xong (khai báo trong `quests.json`, dùng lại cơ chế `unlocks.shopLevel` có sẵn).
- **Dữ liệu:** Năm món nội thất và ba ô trong `shop.json`, hai đơn trong `orders.json`. Kiểm tra bằng `validateShop.ts`, món sai bị loại kèm lý do. Tên và thông báo là khoá locale.

## D-042 — Đơn hàng: mở → nhận → giao, một lần, chỉ khi nhiệm vụ đang cần

- **Trạng thái:** Mỗi đơn đi qua `open`, `accepted`, `delivered`, không đi ngược. `OrderBoard` giữ trạng thái đó.
- **Chỉ nhận khi nhiệm vụ đang hỏi:** Một đơn chỉ nhận được khi có nhiệm vụ đang hoạt động có mục tiêu `accept` trỏ tới đơn đó. Ngoài Q02, quầy không nhận đơn. Đây là lý do `GameSession.orderIsRequested` đọc nội dung nhiệm vụ.
- **Giao nguyên tử:** Giao dùng `Inventory.spend`, tiêu hết các món hoặc không món nào. Thiếu món thì đơn vẫn ở trạng thái đã nhận. Không giao được hai lần: đơn đã giao thì trả `already_delivered`, không cộng tiền thêm.
- **Nguồn đếm:** Mỗi đơn là một nguồn duy nhất cho mục tiêu `accept` và `deliver`, nên lặp lại không đếm thêm.

## D-043 — Q02 và nguồn nguyên liệu đủ để giao đơn

- **Mục tiêu:** Nhận hai đơn, giao hai đơn, mua Kệ Đèn, đặt Kệ Đèn vào một ô. Mục tiêu `buy` và `place` trỏ tới mã món nội thất.
- **Kệ Đèn cần cờ `q01_complete`:** Nếu không, người chơi có thể mua trước khi Q02 bắt đầu, và mục tiêu `buy` sẽ không bao giờ đếm. Cờ này buộc việc mua xảy ra sau khi Q02 đã bắt đầu.
- **Thêm nguyên liệu vào thế giới:** Q00 và Q01 đã dùng hết 4 tre, 2 giấy dó, 2 dây gai trong thế giới, nên đơn Đèn Mộc không thể giao nếu không có thêm. Đã thêm 2 tre, 1 giấy dó, 1 dây gai (`world.json`). Thêm đúng số cần, không dư.
- **Phần thưởng:** Q02 cộng 10 Uy Tín, cấp tiệm lên 2, đặt cờ `q02_complete` và `mvp_complete`.

## D-044 — Hiển thị nâng cấp và màn hình kết thúc

- **Hình học tạm (D-040):** Quầy, ô trưng bày và món nội thất là hình khối đơn giản lấy từ `visual` trong JSON. Chưa có mô hình thật (Module 09).
- **Nâng cấp nhìn thấy được:** Thân tiệm và biển hiệu sáng dần theo cấp (`SHOP_GLOW_LEVEL_1` và `_2`). Ô trưng bày hiện theo cấp. Món đặt vào ô hiện trong cảnh. Mỗi nhân bản vật liệu được clone trước khi chỉnh sáng, để không làm sáng vật gỗ khác.
- **Màn hình kết thúc:** Hiện khi cờ `mvp_complete` bật và `end_card_seen` chưa bật. Nó đóng panel đang mở, khoá đầu vào gameplay trong lúc hiện, và "Đi dạo tiếp" đặt `end_card_seen`. Lời teaser là bản nháp, cần kiểm tra ở Module 12.
- **Đã xem lưu:** Việc đã đóng màn kết thúc là cờ `end_card_seen` trong tiến trình, nên không hiện lại sau khi tải lại trang (D-045).

## D-045 — Lưu: tài liệu có phiên bản, kiểm tra từng trường, sao lưu khi lỗi

- **Cổng và adapter:** `ports/SavePort.ts` chỉ chuyển văn bản (đọc, ghi, ghi bản sao). `adapters/LocalSaveAdapter.ts` ghi vào IndexedDB, và dùng localStorage khi IndexedDB không mở được. Mọi truy cập đều được bọc, lỗi trả về `false` hoặc `null`, không ném ra vòng lặp game.
- **Tài liệu:** `domain/save/SaveDocument.ts` có `version`, `savedAt`, `progress` và `settings`. Mọi trường được kiểm tra kiểu. Trường lạ được bỏ qua, nên bản lưu mới vẫn đọc được phần đã biết.
- **Tiến trình tách khỏi UI:** `domain/save/SessionProgress.ts` mô tả một ván chơi. Panel, hội thoại, và minigame đang dở không được lưu. Craft đang dở lưu thành nguyên liệu (vẫn nằm trong kho), nên tải lại không mất nguyên liệu.
- **Lỗi đọc:** Tiến trình không qua kiểm tra, hoặc khôi phục ném lỗi, thì văn bản cũ được giữ ở khoá bản sao, trò chơi bắt đầu lại, và một banner báo cho người chơi. Không mất gì âm thầm.
- **Cài đặt hỏng:** Chỉ thay trường hỏng bằng giá trị mặc định. Tiến trình vẫn giữ.
- **Migration:** Bảng `MIGRATIONS` theo từng phiên bản cũ, hiện rỗng vì phiên bản 1 là đầu tiên. Khi đổi định dạng, thêm bước mới, không sửa bước cũ.
- **Khôi phục không trả thưởng lần hai:** `restoreProgress` đặt lại mọi hệ thống, áp dữ liệu đã lưu, rồi gọi `start()` (idempotent). Phần thưởng đã nhận không được cộng lại.

## D-046 — Tự lưu, khôi phục, đặt lại có xác nhận

- **Tự lưu:** `app/SaveController.ts` lưu sau 800 ms kể từ thay đổi cuối. Khi trang bị ẩn hoặc đóng (`visibilitychange`, `pagehide`), lưu ngay. Ghi lỗi được báo một lần, không lặp lại.
- **Thứ tự:** Màn hình chỉ hiện sau khi tải xong, nên người chơi không thấy thế giới mới thay thế tiến trình đã lưu. Tự lưu bắt đầu sau khi tải, nên không ghi đè bản lưu bằng trạng thái trống.
- **Đặt lại:** "Bắt đầu lại" cần xác nhận, vì xoá ván đang chơi. Đặt lại được lưu ngay, để tải lại không khôi phục ván cũ.

## D-047 — Cài đặt, menu tạm dừng, đổi ngôn ngữ

- **Escape:** Một phím, hai việc theo thứ tự: đóng panel nếu đang mở, không thì mở menu tạm dừng. Hội thoại giữ phím riêng, nên Escape không làm gì khi đang nói chuyện. Nút Menu trên HUD dành cho cảm ứng và bàn phím.
- **Tạm dừng:** Khoá đầu vào gameplay bằng blocker `pause`. Trạng thái menu là UI, không lưu, không đổi phiên.
- **Ngôn ngữ:** `content/index.ts` đổi bộ dịch khi người chơi chọn, ngôn ngữ kia làm dự phòng. HUD được đặt `key` theo ngôn ngữ, nên mọi chuỗi render lại cùng lúc. Cách này đơn giản hơn truyền ngôn ngữ vào từng component.
- **Cài đặt:** Ngôn ngữ, giảm hiệu ứng, và âm thanh được lưu cùng tiến trình, áp dụng ngay khi đổi, và giữ qua lần tải lại.

## D-048 — Âm thanh tổng hợp, mở khoá sau cử chỉ người chơi

- **Không có file âm thanh:** `shared/audio/sfx.ts` tổng hợp âm bằng Web Audio API (sóng sin, tam giác, vuông). Tám âm: đèn bật, đèn tắt, nhặt, tách (gắn ô), trượt, sai, chuông, xu. Âm tiếng «tách» là thứ GDD yêu cầu cho lắp khung.
- **Mở khoá:** `AudioContext` chỉ được tạo sau cử chỉ đầu tiên (pointerdown hoặc keydown), vì trình duyệt chặn âm thanh trước đó. Mọi lệnh phát đều là no-op khi tắt âm, khi chưa có context, hoặc khi trình duyệt chưa chạy context.
- **Chưa kiểm chứng bằng tai:** Trình duyệt tự động không nghe được. Phần này cần kiểm tra trên máy thật.

## D-049 — Bộ nạp GLB: mọi asset có dự phòng, không bao giờ bắt buộc

- **Manifest:** `src/content/assets.json` được kiểm tra bởi `domain/content/validateAssets.ts`. Nguồn chỉ là `/assets/…glb` cùng gốc, hoặc một bộ sinh có tên trong danh sách. Mục hỏng bị loại có lý do, phần còn lại vẫn chạy.
- **Dự phòng:** Một asset không có nguồn, hoặc tải lỗi, hoặc hết thời gian (8 s), thì dùng hình khối. `AssetLoader.instantiate` không bao giờ ném lỗi, nên thiếu model không làm dừng việc dựng cảnh.
- **Tải một lần:** Mỗi model được tải một lần, nhiều lần gọi đồng thời chia sẻ cùng một lần tải. Mỗi lần dùng là một bản sao từ container.
- **Thay một asset:** Đổi một dòng trong `assets.json`. Không sửa code gameplay (mục 8 của `docs/ASSET_MANIFEST.md`).
- **Animation thiếu:** `resolveAnimation` chọn clip được yêu cầu nếu có, không thì `idle`, không thì không gì cả. Tên clip lấy từ track của PlayCanvas (`AnimTrack.name`). Tên asset có dạng `<file>/animation/<n>`, nên không dùng tên đó.
- **Chỉ dev:** Các asset có id bắt đầu bằng `dev.` chỉ được tải trong chế độ phát triển. Bản phát hành không tải chúng.

## D-050 — Test GLB sinh bằng code, đã nạp thành công trong trình duyệt

- **Chọn:** `engine/assets/testGlb.ts` dựng một khối lập phương glTF 2.0 nhị phân với một clip `idle`. Không có file nhị phân trong repo, và không cần Blender để kiểm tra bộ nạp.
- **Kiểm chứng:** `assetFormats.test.ts` đọc lại từng phần của file (header, chunk, accessor, chỉ số tam giác, clip). PlayCanvas nạp `dev.test_crate` thành công trong Chrome: trạng thái `loaded`, clip `idle`, và khối hiện đúng trong cảnh.
- **Giới hạn:** Đây là asset thử, không phải model thật. Nó không chứng minh được đường nhập từ Blender (hướng, vật liệu, pivot). Mục đó vẫn chờ lần nhập đầu tiên theo mục 8 của `docs/ASSET_MANIFEST.md`.

## D-051 — Preset chất lượng: hiện chỉ đổi mật độ điểm ảnh

- **Chọn:** Thấp 1.0, di động 1.5, cao 2.0 (giới hạn mật độ điểm ảnh của canvas). Chế độ tự động chọn di động cho màn hình cảm ứng, cao cho còn lại. Người chơi đổi trong menu tạm dừng, lưu trong cài đặt.
- **Vì sao chỉ một núm:** Số hạt, bóng đổ, và lightmap đều phụ thuộc asset thật, nên chưa có cách đo. Khi thêm núm nào thì đo trên thiết bị trước. Không thêm núm chỉ để điền bảng.
- **Đổi tức thì:** `GameApp.setQuality` cập nhật thiết bị render và đo lại canvas. Không cần tải lại trang.

## D-052 — Công cụ đo và kiểm tra: F3 cho mọi bản, F4 chỉ dev

- **F3 (mọi bản):** Hiện FPS, số lệnh vẽ (draw calls), và số model đã tải. Số liệu lấy từ bộ đếm của engine (`app.stats`). Không ghi, không gửi đi đâu.
- **F4 (chỉ dev, `import.meta.env.DEV`):** Bảng asset: trạng thái, clip, nút Tải và Đặt trước mặt. Nhãn tiếng Anh vì người chơi không thấy bảng này.
- **Giới hạn đo:** Trong pane trình duyệt, FPS chỉ khoảng 3 (D-032). Con số đó không dùng để đánh giá hiệu năng. Đo thật trên máy thật ở Module 10.

## D-053 — QA: đo được thì ghi số, không đo được thì ghi "chưa đo"

- **Quy tắc:** Mọi con số trong `docs/QA_REPORT.md` đều có cách đo. FPS không đo được trong pane (D-032), nên báo cáo ghi "chưa đo" thay vì đưa ra một con số ước lượng.
- **Đo được:** Kích thước bundle (từ đầu ra của build), tải về và thời gian tải (Resource Timing), 404 và lỗi console (kiểm tra trên bản production), số lệnh vẽ và model đã tải (bộ đếm của engine, F3).
- **Kiểm thử tự động theo chương:** `smokeCampaign` chơi Q00 → Q01 → Q02 và lưu, tải lại giữa mỗi chặng. Đây là bài kiểm tra quan trọng nhất cho việc lưu, vì nó bắt được mất dữ liệu hoặc trả thưởng hai lần ở mọi biên chương.
- **Giới hạn đã nêu:** Không có Android, không có Firefox, không có trình đọc màn hình. Các mục này nằm ở "chưa thử" trong báo cáo.

## D-054 — Chữ lớn: phóng cả HUD bằng CSS `zoom`

- **Chọn:** Cài đặt "Chữ lớn" đặt `zoom: 1.25` lên `.hud-root`. Mọi kích thước HUD đều tính bằng px, nên phóng cả khối là cách ít sửa nhất và đúng cho mọi thành phần.
- **Lựa chọn khác bị bỏ:** Đổi `font-size` gốc không đổi được các kích thước px. Đổi từng cỡ chữ thành `rem` là việc lớn và dễ sót, và không làm được với nút và khoảng cách.
- **Đánh đổi:** `zoom` là thuộc tính không chuẩn lâu nay. Cần kiểm tra trên Firefox trước khi phát hành. Đã ghi trong báo cáo.

## D-055 — Thêm kiểm thử giao diện: jsdom và Testing Library (chỉ dev)

- **Chọn:** Thêm `jsdom`, `@testing-library/react`, và `@testing-library/dom` là phụ thuộc dev. Kiểm thử logic vẫn chạy trong Node. Chỉ tệp `.tsx` có chú thích `@vitest-environment jsdom` mới dùng DOM.
- **Smoke test thật:** `uiSmoke.test.tsx` render các thành phần HUD thật (màn lỗi khởi động, tiền, nhiệm vụ, hội thoại, kho đồ) với một phiên chơi thật. Không tải PlayCanvas. Đối tượng `game` chỉ là phần đầu vào và tương tác cần thiết.
- **Không dùng để thay thế kiểm tra trình duyệt:** Smoke test không thấy canvas, không thấy FPS, không chạm vào cảm ứng. Các phần đó vẫn kiểm tra bằng tay.

## D-056 — Migration của lưu được kiểm tra bằng bảng truyền vào

- **Vấn đề:** Bảng `MIGRATIONS` là hằng số đóng, nên không thể kiểm tra từng bước khi chưa có định dạng cũ thật.
- **Chọn:** `parseSaveDocumentWith(raw, migrations)` nhận bảng làm tham số. `parseSaveDocument` truyền bảng thật của game. Test dùng bảng riêng với một bước 0 → 1 giả lập.
- **Đổi nhỏ:** Phiên bản 0 nay được đưa vào bảng migration (trước đó bị từ chối ngay). Phiên bản 0 không có bước nào thì vẫn báo `no_migration`, nên hành vi với bản thật không đổi.

## D-057 — Analytics và nền tảng là cổng, bản cài sẵn không làm gì

- **Analytics:** `ports/AnalyticsPort.ts` có tên sự kiện đóng (một sự kiện hiện tại: hoàn thành chương đầu). Bản cài sẵn là `NO_ANALYTICS`, không gửi gì. Màn kết thúc phát sự kiện này khi hiện, để chỗ nối đã có sẵn khi làm bản thật.
- **Nền tảng:** `ports/PlatformPort.ts` mô tả thiết bị (cảm ứng đầu tiên, ngôn ngữ). `adapters/BrowserPlatform.ts` đọc từ trình duyệt, nhận môi trường làm tham số để test. Lưu dùng cổng này để chọn chất lượng tự động, thay vì tự đọc `matchMedia`.
- **Vì sao làm trước khi cần:** Hai cổng này là chỗ thay thế duy nhất để thêm analytics hoặc đổi nền tảng sau này. Đặt đúng chỗ bây giờ thì không phải sửa gameplay.

## D-058 — Thẻ câu chuyện: sự kiện có thật chỉ là `verified` khi có nguồn đã đọc

- **Quy tắc trong validator:** Hư cấu có thể `verified` theo tài liệu thiết kế. Sự kiện có thật `verified` phải có ít nhất một nguồn https. Thiếu nguồn thì thẻ bị loại có lý do.
- **Trạng thái thực tế:** Mọi sự kiện có thật hiện là `needs_review`. Tìm kiếm chỉ cho phần tóm tắt, và các nguồn không thống nhất về loài cây, thời vụ, mốc lịch sử. Không có sự kiện nào được ghi là đã kiểm chứng.
- **Chỗ dùng trong game:** Chỉ "giấy dó" là sự kiện có thật được dùng, và chỉ như tên vật liệu, không kèm mô tả quy trình. Chương 2 là nháp.

## D-059 — Riêng tư: tài liệu nháp, chưa phải chính sách

- `docs/PRIVACY.md` ghi những gì code thật sự làm: dữ liệu chỉ ở trên thiết bị, không có máy chủ, không có SDK, không có quyền hệ thống. Đã đối chiếu bằng tìm kiếm trong `src/` (không có `fetch` ra ngoài, không có font từ bên thứ ba).
- Tài liệu nói rõ đây không phải chính sách pháp lý, và liệt kê việc người phụ trách phải làm trước khi phát hành.

## D-060 — PWA: hoãn, icon nội tuyến đủ cho tab trình duyệt

- Chưa có manifest. Hướng ngang trên điện thoại được giữ bằng `OrientationGate` trong ứng dụng, không cần manifest.
- `docs/PWA.md` ghi các mục cần có nếu thêm sau. Không thêm manifest bây giờ, vì nó cần icon PNG thật và phải thử cài đặt trên Android.

## D-061 — Model được tải xong trước khi dựng cảnh, không thay sau

- **Chọn:** `GameApp.create()` chờ `AssetLoader.loadAll()` (mỗi model có timeout 8 s và không bao giờ reject) rồi mới `start()`. Hub và NPC được dựng một lần với model cuối cùng, hoặc với placeholder nếu model lỗi.
- **Lý do:** Lớp glow của tiệm và bến cầu clone material của node lúc đang dựng. Nếu model đến sau rồi thay node, glow đã cache sẽ trỏ vào vật đã bị hủy. Chờ trước thì không có trạng thái nửa vời.
- **Đánh đổi:** Lần khởi động chậm bằng thời gian tải model lâu nhất, tối đa 8 s khi mạng xấu. Model lỗi không làm treo game vì có timeout và placeholder.
- **Glow:** `WorldView` clone material của từng `meshInstance` dưới node, không qua `render.material`. Đặt `render.material` chỉ đổi mesh instance đầu tiên. Vì vậy một model có nhiều material (cửa sổ tiệm, ván cầu) không sáng. Lỗi này được tìm thấy khi kiểm tra trong game: code chạy không lỗi nhưng cầu và tiệm không sáng. Test không bắt được lỗi này, vì glow cần WebGL, nên kiểm chứng bằng trình duyệt.

## D-062 — Pivot của hub là tâm khối blockout; NPC tự căn chân

- **Chọn:** Mỗi GLB hub có gốc ở tâm khối blockout trong `hubLayout.ts`, với kích thước đúng bằng khối đó. Code đặt model tại `position`, không scale. NPC người có gốc ở chân (y = 0), Bấc có gốc ở tâm.
- **Lý do:** Giữ nguyên toạ độ trong `hubLayout.ts` và vùng va chạm. Quy tắc pivot "giữa đáy" của manifest mục 1 áp dụng cho vật tĩnh đặt trong tiệm, không áp cho hub.
- **Đánh đổi:** Hub lệch khỏi quy tắc chung của manifest mục 1. `docs/ASSET_MANIFEST.md` ghi ngoại lệ này. Đèn treo nội thất giữ pivot ở điểm treo như manifest quy định.
- **Kiểm chứng:** `src/tests/furnitureModels.test.ts` đọc accessor của từng GLB và so với `HUB_PROPS`. Kích thước và tâm đều khớp.

## D-063 — Đường dẫn asset theo manifest, không theo art bible

- **Chọn:** Mọi model nằm trong `public/assets/` và được gọi là `/assets/<tên>.glb`, theo `docs/ASSET_MANIFEST.md`. Art bible BLENDER-P06 ghi `/public/assets/models/`, nhưng không dùng đường dẫn đó.
- **Lý do:** Manifest là hợp đồng giữa code và Blender (đầu tài liệu). Code đọc `source.url` từ `assets.json`, nên một nguồn duy nhất đủ. Chọn quyết định của bạn ngày 14/10/2026.
- **Đánh đổi:** Art bible giữ nguyên đường dẫn cũ. Ai đọc art bible cần biết điều này. Nếu sau này chuyển sang thư mục con, phải đổi `assets.json` và manifest cùng lúc.

## D-064 — Phần còn lại của hub làm thành GLB, mỗi vật một file

- **Chọn:** Gian hàng, đèn góc, đèn quảng trường, cổng, cửa tiệm và bụi cây có GLB riêng, theo cùng cơ chế `hub.<id>` của mục 3. Mỗi file ở đúng kích thước khối blockout. Mặt đất, sông, lan can cầu và cột bên lề giữ blockout.
- **Lý do:** Các khối này nằm trong mọi ảnh chụp và làm hub trông chưa xong. Cơ chế hiện có đã đủ, không cần đổi code gameplay.
- **Đánh đổi:** 39 file mới, mỗi file chỉ một vật. Tổng số GLB lên 56. Cách gộp mỗi gian hàng vào một file sẽ cần đổi cơ chế nạp, nên chưa làm.
- **Kiểm chứng:** Test đọc danh sách `hub.*` từ `assets.json`, nên mọi vật hub mới đều được kiểm tra kích thước và tâm. Trong game: 56 asset không dev đều `loaded`, và gian hàng, cổng, đèn góc được chụp ở 30 m.

## D-065 — Tách chunk: engine, React và game ở ba file

- **Chọn:** `vite.config.ts` gom `playcanvas` và `react`/`react-dom`/`scheduler` vào hai chunk riêng, phần còn lại là chunk game. Ngưỡng cảnh báo đặt 2200 kB để chặn đúng chunk engine.
- **Lý do:** Khi chỉ sửa game, trình duyệt chỉ tải lại chunk game (khoảng 47 kB gzip) thay vì cả bundle (647 kB gzip). Engine và React ít thay đổi nên được cache.
- **Đánh đổi:** Tổng gzip không giảm (647 kB). Engine vẫn một chunk 2.08 MB, vì game cần nó khi khởi động, nên không tải lười được.

## D-066 — Khoá save bằng Web Locks: một tab giữ save

- **Chọn:** `src/adapters/SaveLock.ts` xin khoá `linh-pho-save` trước khi tạo engine. Tab thứ hai hiện thông báo «Trò chơi đang mở ở một tab khác» và chờ. Khi tab đầu đóng, trình duyệt nhả khoá và tab thứ hai vào game.
- **Lý do:** Hai tab cùng ghi sẽ đè tiến trình của nhau. Web Locks có khoá theo origin, và trình duyệt tự nhả khi tab đóng, nên không cần dọn khi tab bị treo.
- **Đánh đổi:** Trình duyệt không có Web Locks thì không khoá, và game chạy như trước. Mở hai tab vẫn có thể ghi đè trên trình duyệt đó.
- **Kiểm chứng:** `saveLock.test.ts` dùng bản giả lập với hàng đợi, `ifAvailable`, và huỷ. Trong trình duyệt: tab hai hiện thông báo, đóng tab một thì tab hai vào game, và khoá không bị kẹt khi chạy dev có StrictMode.

## D-067 — Rà soát trình đọc màn hình: focus và nhãn, chưa thử với phần mềm thật

- **Chọn:** Mở panel, menu tạm dừng hoặc màn kết thúc thì focus vào hộp thoại, đóng thì trả focus về chỗ cũ. Tiến độ nhiệm vụ có chữ «đã xong» hoặc «chưa xong» cho trình đọc (`sr-only`). Nút Menu có `aria-expanded`. Khung chế tạo có `role="group"`.
- **Lý do:** Người dùng bàn phím và trình đọc màn hình không biết panel đã mở, và dấu ✓ bị ẩn khỏi trình đọc nên không ai biết nhiệm vụ đã xong.
- **Đánh đổi:** Đây là rà soát bằng cây accessibility của trình duyệt, không phải thử với NVDA, VoiceOver hay TalkBack. Mục này vẫn để «chưa thử» trong báo cáo.
- **Kiểm chứng:** Trong trình duyệt, cây accessibility có «— chưa xong» trên từng mục. Mở menu thì focus vào «Tiếp tục chơi», đóng thì về nút Menu. Mở kho đồ thì focus vào «Kho đồ», đóng thì về nút Menu.

## D-068 — Đổi phím trong menu tạm dừng

- **Chọn:** Mỗi hành động (tiến, lùi, trái, phải, tương tác, đổi đèn, kho đồ) có một phím chính, đổi được trong menu. Phím mũi tên luôn đi kèm bốn hướng và không đổi được. Gán một phím đã dùng thì hai hành động đổi chỗ, nên không bao giờ có hai hành động cùng phím. Phím dành riêng gồm Esc, Enter, Space, Tab, Backspace, các phím F và phím mũi tên. Bảng phím nằm trong `Settings.keys` và lưu cùng save. Save cũ không có trường này thì dùng phím mặc định, không đổi phiên bản save.
- **Lý do:** Phím cố định là một trong các nợ đã biết, và cần cho người dùng bố cục bàn phím khác hoặc có khó khăn khi bấm.
- **Đánh đổi:** Chỉ đổi phím chính. Mũi tên vẫn di chuyển được. Phím dành riêng không đổi được, và Esc vẫn là phím mở menu và huỷ chọn.
- **Kiểm chứng:** `keyMap.test.ts` và `keyboardState.test.ts` (613 test cùng các test khác). Trong trình duyệt: đổi Tiến sang T và nhân vật đi bằng T, W không đi nữa. Đổi Kho đồ sang B. Enter bị từ chối với thông báo. Esc huỷ không đóng menu. Tải lại trang thì phím còn nguyên, và nút «Đặt lại» trả về mặc định.

## D-069 — Thẻ câu chuyện: đọc nguồn qua WebFetch, chuyển hai thẻ sang verified

- **Chọn:** Đọc các nguồn trong `story_cards.json` qua công cụ tải trang. Hai thẻ có câu được nguồn xác nhận chuyển sang `verified`: giấy dó làm từ vỏ cây dó (Tạp chí Công Thương), và làng Bưởi làm giấy từ đầu thế kỷ XV (Vietcetera). Thẻ thu hoạch tháng 8–10 vẫn `needs_review`, vì không có nguồn đã đọc nêu tháng. Câu về làng Bưởi được rút gọn, bỏ mục đích viết và in tranh vì nguồn nói về giấy dó nói chung.
- **Lý do:** Quy tắc trong `STORY_CARDS.md` cho phép `verified` khi có nguồn đã đọc toàn văn và câu khớp nguồn. Hai câu đó khớp nguồn.
- **Đánh đổi:** Công cụ trả về phần trích xuất của trang, không phải bản sao từng ký tự. File VNPT (.doc) bị lỗi mã hoá, không đọc được. Các câu được dẫn cần người phụ trách mở lại nguồn kiểm tra trước khi phát hành.
- **Kiểm chứng:** `storyAndPlatform.test.ts` kiểm tra mọi thẻ `verified` có nguồn và ghi chú «đã đọc», và thẻ thu hoạch vẫn là `needs_review`. Typecheck sạch, 614 test pass.
