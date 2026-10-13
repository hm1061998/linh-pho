# Tiến độ — Linh Phố

Cập nhật: 2026-10-13. Theo quy trình Prompt 00 (A–F), mỗi module chạy riêng, có bằng chứng và một commit.

## Lịch sử commit

| Commit | Nội dung |
|---|---|
| `299ea45` | `docs(module-00)`: bộ tài liệu thiết kế |
| `5aa6d3f` | `feat(module-01)`: bootstrap PlayCanvas và blockout hub |
| `111df20` | `chore`: `.gitattributes` (LF, file nhị phân) |
| `9aeb7ff` | `feat(module-02)`: nhân vật, camera, input, va chạm |
| (xem `git log`) | `feat(module-03)`: tương tác, hội thoại, 4 NPC placeholder |

## Đã hoàn thành

### Module 00 — Quy tắc và cấu trúc repo
- Repo theo layout GDD G3: `src/app`, `src/engine`, `src/ui`, `src/shared`, `src/tests`, `docs`, cùng `src/content` và `src/domain` từ Module 03.
- Thư mục `ports/`, `adapters/` chưa tạo vì chưa có code dùng đến.
- Tài liệu thiết kế (`LINH_PHO_*.md`) vẫn ở thư mục gốc `linh-pho/`.

### Module 01 — Bootstrap và cảnh 3D
- Vite + React 19 + TypeScript strict. PlayCanvas Engine 2.23.2 qua npm, chỉ WebGL2.
- Canvas nằm dưới HUD React trong suốt. React không render 3D.
- Resize theo container, DPR tối đa 2, tạm dừng khi ẩn tab, dispose đầy đủ khi unmount và HMR.
- Lỗi WebGL2 hiện panel tiếng Việt.
- Blockout 60×60 m bằng primitive: quảng trường, sông, cầu, nhà tiệm (bảng hiệu trống), xưởng, cổng, 4 quầy, đèn lớn, đèn góc, bụi cây.

### Module 02 — Nhân vật, camera, input, va chạm
- **Input (`engine/input/`):** `InputService` đọc bàn phím (WASD và mũi tên), kéo chuột/cảm ứng trên canvas, wheel, pinch. Có blocker để khoá gameplay khi có modal. Xoá trạng thái khi mất focus.
- **Nhân vật (`engine/player/`):** `PlayerController`, capsule placeholder, làm mượt gia tốc và hướng quay, di chuyển theo camera, không vượt biên.
- **Va chạm:** `collision.ts` (tròn–hộp, chia bước chống xuyên vật mỏng). Vật cản lấy từ prop `solid`. Sông được tách để cầu là lối duy nhất qua.
- **Camera (`engine/camera/`):** `CameraController`, nghiêng 45°, kéo ngang để xoay, zoom 30–90 m, bám người chơi mượt, tiêu điểm trong biên.
- **Điều khiển cảm ứng:** joystick trái dưới và nút tương tác, chỉ hiện với `(pointer: coarse)`.
- **Hook dev:** `window.__linhPho.game` chỉ có trong dev, đã kiểm chứng là không có trong bundle production.

### Module 03 — Tương tác, hội thoại, NPC placeholder
- **Event bus có kiểu** (`shared/events/EventBus.ts`): listener lỗi bị ghi log và bỏ qua, không làm hỏng listener khác.
- **Tương tác** (`engine/interaction/InteractionSystem.ts`): mục tiêu có ID ổn định, tầm 2 m (XZ), chỉ một mục tiêu được focus (gần nhất, hoà thì theo thứ tự đăng ký). Sự kiện `focusChanged` và `triggered`.
- **Hội thoại** (`domain/dialogue/DialogueSystem.ts`): mỗi node có lời thoại (khoá locale), mục vào có điều kiện (`when`), lựa chọn có điều kiện và hiệu ứng (`setFlag`). Không có ngoại lệ: ID sai, nút thiếu, không có mục khớp đều phát `dialogue.error` và đóng gọn.
- **Cờ truyện** (`domain/flags/FlagStore.ts`): dùng cho điều kiện hội thoại. Chưa lưu xuống đĩa (Module 08).
- **Nội dung JSON** (`src/content/`): `npcs.json` (4 NPC), `dialogues.json` (4 hội thoại), `locales/vi.json` và `en.json`. Nội dung sai bị loại có báo lỗi, game vẫn chạy.
- **Bộ kiểm tra nội dung** (`domain/content/validate.ts`): kiểm tra kiểu, tham chiếu nút, người nói, khoá locale, ID trùng.
- **NPC** (`engine/npc/NpcRenderer.ts`): Bà Nghiêm, Cô Lam, Ông Độ là capsule có va chạm (nhân vật không đi xuyên qua). Bấc là quả cầu phát sáng, lơ lửng và lắc nhẹ, không chặn.
- **HUD:** hint "E · Nói chuyện với …" (chỉ hiện khi không cảm ứng và không có hội thoại), panel hội thoại dưới màn hình (chạm để tiếp tục, chọn lựa chọn, E/Enter/Space để tiếp tục, Escape hoặc "Đóng" để đóng), nút cảm ứng đổi nhãn và ẩn khi hội thoại mở.
- **Khoá:** mở hội thoại thì đẩy blocker `dialogue` (chặn di chuyển và tương tác); đóng thì gỡ.

### Thay đổi HUD: chặn bôi đen và yêu cầu xoay ngang trên điện thoại
- **Không bôi đen:** toàn bộ UI (`body, body *`) có `user-select: none`. Ô nhập liệu (nếu có sau này) vẫn chọn được chữ (D-025).
- **Xoay ngang:** điện thoại hoặc máy tính bảng ở chế độ dọc (`pointer: coarse` và `orientation: portrait`) thấy màn hình "Xoay ngang thiết bị để chơi". Overlay chặn chạm và khoá gameplay. Xoay ngang thì tiếp tục (D-024).
- **Kiểm tra tự động:** `localeKeys.test.ts` (hai test) kiểm tra khoá locale.
- Các thay đổi này không thuộc module nào trong roadmap. Commit riêng.

## Bằng chứng kiểm thử (đã chạy thật)

| Lệnh | Kết quả |
|---|---|
| `npm run typecheck` | Đạt |
| `npm test` | 17 file, 124 test, tất cả đạt |
| `npm run build` | Đạt. `index-*.js` 2,342.28 kB (gzip 617.56 kB) |

Test thuần (chạy trong Node), theo nhóm:
- **Module 01–02:** `math`, `collision`, `movement`, `keyboardState`, `hubCollision`, `hubLayout`, `display`, `color`, `startupErrors`, `GameApp.startup`.
- **Module 03:**
  - `eventBus`: đúng loại sự kiện, huỷ đăng ký, listener lỗi không chặn listener khác.
  - `translator`: fallback, dấu thiếu key `[key]`, tham số `{name}`, không đọc thuộc tính kế thừa.
  - `interactionSystem`: tầm (biên tính vào), gần nhất, hoà theo thứ tự đăng ký, chỉ phát khi đổi focus, nhấn ngoài tầm không làm gì, ID trùng bị từ chối.
  - `dialogueSystem`: mục vào theo điều kiện, lựa chọn ẩn/hiện, hiệu ứng, kết thúc `finished`/`dismissed`/`error`, nút thiếu nút đích không dead-end, `constructor` không phải hội thoại.
  - `contentValidation`: nội dung thật không có lỗi, mọi key vi có bản en, các lỗi phổ biến bị loại đúng chỗ.
  - `interactPolicy`: E bị bỏ khi đang khoá, khi UI đã xử lý phím, và khi lặp phím.
  - `hubCollision` (bổ sung): NPC người chặn, Bấc không chặn.

Kiểm tra trong trình duyệt (dev server, built-in browser), bằng phím thật khi có thể:

| Kiểm tra | Kết quả |
|---|---|
| Load, console, nội dung | Không có lỗi nội dung hay i18n |
| Nhấn E ở điểm xuất phát (ngoài tầm) | Không mở gì, không có hint |
| Đi đến Bà Nghiêm (tầm 2 m) | Hint "E · Nói chuyện với Bà Nghiêm", NPC có tên đúng |
| Nhấn E thật | Mở `dlg_ba_nghiem` ở nút `greet`, panel nhận focus, input khoá, hint ẩn |
| Giữ A + W trong hội thoại | Nhân vật không di chuyển (dx = dz = 0) |
| Chạm thân hội thoại | Chuyển sang `task`, có 3 lựa chọn |
| Chọn "Chợ này là chợ gì vậy?" bằng click thật | Sang `market`; cờ `asked_market` và `met_ba_nghiem` được đặt |
| Quay lại `task` | Lựa chọn đã hỏi bị ẩn, còn 2 lựa chọn |
| Nhấn Escape thật | Đóng (`dismissed`), mở khoá, di chuyển lại được |
| Ra ngoài tầm rồi nhấn E | Không mở |
| Quay lại, nhấn E | Mở nhánh `return` vì cờ đã có |
| Nút "Đóng" bằng click | Đóng, mở khoá |
| Qua cầu, đến Ông Độ (bờ nam) | Hint đúng. Chọn "Ở đây có gì để lấy không?" sang `materials`. Chạm để kết thúc (`finished`) |
| Bấc (trên quảng trường) | Hint "Nói chuyện với Bấc". E mở, E tiếp tục đóng ngay (`finished`) |
| **Lỗi tìm thấy và đã sửa:** E tiếp tục hội thoại lại mở lại | Nguyên nhân: cùng một lần nhấn E vừa đóng hội thoại vừa đặt hàng đợi tương tác. Sửa: `shouldQueueInteract` bỏ qua khi bị khoá và khi UI đã `preventDefault`. Kiểm chứng lại: E đóng và giữ đóng; E sau đó mở lại; Escape đóng |
| `dialogue.start('dlg_missing')` | `{ ok: false, reason: 'unknown_dialogue' }`, game vẫn chạy |
| Mục tiêu không có định nghĩa NPC | Ghi `[Interaction] Target "npc_ghost" has no NPC definition; nothing opened`, không mở gì |
| Viewport 375×812, cảm ứng | Hint ẩn. Nút "Nói chuyện" khi có mục tiêu. Chạm nút mở hội thoại, controls ẩn, khoá bật. Panel nằm trong khung (trái 12, phải 363). Có 3 lựa chọn vẫn vừa màn hình. Không cuộn ngang |
| Đóng hội thoại trên điện thoại | Controls trở lại |

Lưu ý về công cụ kiểm tra: đường đi trong các bước trên dùng script đi thẳng về đích, không tìm đường. Khi đi từ cầu tới Ông Độ, script trượt dọc bờ bắc và bị sông chặn. Đây là hành vi đúng của va chạm, không phải lỗi game. Cách đi đúng: qua đầu cầu phía bắc.

## Chưa kiểm chứng (phải nói rõ)
- **Đọc bằng trình đọc màn hình:** chưa kiểm tra. Có `role="dialog"`, `aria-modal`, `aria-live` nhưng chưa thử.
- **Lưu và tải cờ truyện:** chưa có, cờ mất khi tải lại trang (Module 08).
- **Giữ joystick lâu:** công cụ kéo chuột chỉ có down → move → up nhanh (vẫn đúng ở Module 02).
- **Pinch zoom, tạm dừng khi ẩn tab, thiết bị cảm ứng thật, FPS trên GPU thật:** như Module 02.
- **Panel lỗi WebGL2 trên trình duyệt thật:** chỉ có test logic.
- **Xoay ngang và chặn bôi đen trên điện thoại thật:** chỉ kiểm chứng trên giả lập viewport. Chưa thử Safari iOS và Chrome Android thật, chưa thử nhấn giữ thật (long-press).

## Vấn đề đã biết
1. **Nội dung hội thoại là bản nháp:** Câu thoại viết để kiểm chứng cơ chế. Module 12 (biên tập văn hoá) sẽ sửa, kèm `status` cho từng thẻ.
2. **NPC quay mặt về người chơi chỉ khi bắt đầu hội thoại:** Chưa có xoay mượt hay theo dõi liên tục.
3. **Không có nhãn tên trên đầu NPC:** Chỉ hiện tên trong hint và panel. Có thể cần ở Module 09.
4. **Hint và điều khiển cảm ứng dùng chung trạng thái focus:** Nếu thêm vật thể tương tác khác NPC, cần cập nhật `interactionLabel` và `useInteractionFocus`.
5. **Hàng đợi tương tác phụ thuộc thứ tự sự kiện:** `shouldQueueInteract` đã chặn cả hai trường hợp (bị khoá, và UI đã xử lý). Nếu thêm phím tương tác khác, dùng lại quy tắc này.
6. **Tương tác chưa lưu:** Lần tương tác và cờ chỉ tồn tại trong phiên.
7. **`speed` là vận tốc dự định** (D-014). Không ảnh hưởng vị trí.
8. **Bậc lên cầu:** Mặt cầu cao 0.375 m, không có dốc (chấp nhận ở placeholder).
9. **Mái nhà có thể che người chơi:** Chưa có roof fade.
10. **Bundle:** JS 2.34 MB minify, 617 kB gzip, chủ yếu do PlayCanvas. Xử lý ở Module 10.
11. **Mất WebGL context** (GPU reset): chưa xử lý, chỉ có log lỗi.
12. **Đổi DPR không đổi kích thước:** canvas giữ DPR cũ.
13. **Frame đầu có thể trống thoáng qua** sau khi tải trang. Chưa xác định là do dev server hay engine.
14. **Copy tiếng Việt và tiếng Anh** đã nằm trong locale. Phần còn lại trong `StartupErrorPanel.tsx` vẫn hard-code, sẽ chuyển ở Module 08.

## Việc tiếp theo
- **Module 04:** kho đồ (xếp chồng, giới hạn tuỳ chọn), công thức và vật phẩm trong JSON có kiểm tra, `QuestSystem` với mục tiêu khai báo và sự kiện, nhiệm vụ Q00 đầy đủ (thu thập 2 tre, 1 giấy, 1 dây → chế tạo Đèn Mộc → đặt trước tiệm → nhận 30 xu, mở Q01). Dùng `FlagStore` và sự kiện có kiểu từ Module 03.

## Checklist kiểm thử thủ công (Module 03)
- [ ] `npm run dev`, mở http://localhost:5173. Không có lỗi trong console.
- [ ] Đi đến Bà Nghiêm (quảng trường). Hint "E · Nói chuyện với Bà Nghiêm" xuất hiện khi trong tầm 2 m, biến mất khi đi ra.
- [ ] Nhấn E: hội thoại mở, nhân vật không đi được.
- [ ] Chạm lời thoại để tiếp tục. Chọn lựa chọn bằng click. Chọn "Chợ này là chợ gì vậy?" rồi quay lại thì lựa chọn đó không còn.
- [ ] Nhấn Escape hoặc "Đóng": hội thoại đóng và di chuyển lại được.
- [ ] Nhấn E khi đang hội thoại: lời thoại tiếp tục. Ở lời cuối thì đóng và không mở lại ngay.
- [ ] Qua cầu (từ phía bắc) đến Ông Độ và Bấc. Mỗi NPC đều có hội thoại đúng tên.
- [ ] Trên điện thoại: nút "Nói chuyện" xuất hiện khi gần NPC, chạm để mở. Joystick ẩn khi hội thoại mở, và hiện lại khi đóng.
- [ ] Điện thoại cầm dọc: thấy màn hình "Xoay ngang thiết bị để chơi", chạm không xuống được game. Xoay ngang: overlay biến mất, chơi tiếp được.
- [ ] Chữ trong HUD (hội thoại, hint, nhãn nút) không bôi đen được bằng nhấp đúp, nhấp ba lần, hoặc nhấn giữ trên điện thoại.
