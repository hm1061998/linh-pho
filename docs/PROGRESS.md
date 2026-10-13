# Tiến độ — Linh Phố

Cập nhật: 2026-10-13. Theo quy trình Prompt 00 (A–F), mỗi module chạy riêng, có bằng chứng và một commit. Mục tiêu hiện tại: màn chơi đầu tiên (vertical slice Q00 → Q02, theo GDD mục C3 và H).

## Lịch sử commit

| Commit | Nội dung |
|---|---|
| `299ea45` | `docs(module-00)`: bộ tài liệu thiết kế |
| `5aa6d3f` | `feat(module-01)`: bootstrap PlayCanvas và blockout hub |
| `111df20` | `chore`: `.gitattributes` (LF, file nhị phân) |
| `9aeb7ff` | `feat(module-02)`: nhân vật, camera, input, va chạm |
| `35ca79b` | `feat(module-03)`: tương tác, hội thoại, 4 NPC placeholder |
| `033e3f0` | `feat(hud)`: chặn bôi đen và yêu cầu xoay ngang trên điện thoại |
| (module-04) | `feat(module-04)`: kho đồ, công thức, nhiệm vụ, Q00 đầy đủ |

## Đã hoàn thành

### Module 00 — Quy tắc và cấu trúc repo
- Repo theo layout GDD G3: `src/app`, `src/engine`, `src/ui`, `src/shared`, `src/tests`, `docs`, cùng `src/content` và `src/domain`.
- Thư mục `ports/`, `adapters/` chưa tạo vì chưa có code dùng đến.
- Tài liệu thiết kế (`LINH_PHO_*.md`) vẫn ở thư mục gốc `linh-pho/`.

### Module 01 — Bootstrap và cảnh 3D
- Vite + React 19 + TypeScript strict. PlayCanvas Engine 2.23.2 qua npm, chỉ WebGL2.
- Canvas nằm dưới HUD React trong suốt. React không render 3D.
- Resize theo container, DPR tối đa 2, tạm dừng khi ẩn tab, dispose đầy đủ khi unmount và HMR.
- Blockout 60×60 m bằng primitive: quảng trường, sông, cầu, nhà tiệm, xưởng, cổng, 4 quầy, đèn lớn, đèn góc, bụi cây.

### Module 02 — Nhân vật, camera, input, va chạm
- **Input (`engine/input/`):** `InputService` đọc bàn phím, kéo chuột/cảm ứng, wheel, pinch. Blocker khoá gameplay. Xoá trạng thái khi mất focus.
- **Nhân vật, camera, va chạm:** capsule có làm mượt, camera 45° có kéo xoay và zoom 30–90 m, va chạm tròn–hộp chống xuyên vật mỏng. Sông tách để cầu là lối duy nhất qua.
- **Điều khiển cảm ứng:** joystick và nút tương tác, chỉ hiện với `(pointer: coarse)`.

### Module 03 — Tương tác, hội thoại, NPC placeholder
- **Event bus có kiểu** (`shared/events/EventBus.ts`): listener lỗi bị ghi log và bỏ qua.
- **Tương tác** (`engine/interaction/InteractionSystem.ts`): mục tiêu có ID ổn định, tầm 2 m (XZ), một mục tiêu được focus (gần nhất).
- **Hội thoại** (`domain/dialogue/DialogueSystem.ts`): mục vào có điều kiện, nút có lựa chọn và hiệu ứng (`setFlag`). Mọi lỗi phát `dialogue.error`, không ném ra ngoài.
- **Nội dung JSON** (`src/content/`) và bộ kiểm tra (`domain/content/validate.ts`): nội dung sai bị loại có báo lỗi, game vẫn chạy.
- **NPC:** Bà Nghiêm, Cô Lam, Ông Độ (capsule có va chạm), Bấc (quả cầu phát sáng, lơ lửng, không chặn).

### Thay đổi HUD: chặn bôi đen và yêu cầu xoay ngang trên điện thoại
- Toàn bộ UI có `user-select: none`. Ô nhập liệu vẫn chọn được chữ (D-025).
- Điện thoại cầm dọc (`pointer: coarse` và `orientation: portrait`) thấy màn hình "Xoay ngang thiết bị để chơi", chặn chạm và khoá gameplay (D-024).

### Module 04 — Kho đồ, công thức, nhiệm vụ, Q00
- **Nội dung (`src/content/`):** `items.json` (8 vật phẩm), `recipes.json` (2 công thức), `quests.json` (Q00), `world.json` (14 vật nhặt được, 2 trạm, 1 điểm đặt đèn). Mọi chuỗi là khoá locale, có bản tiếng Anh.
- **Domain:**
  - `Inventory`: xếp chồng theo chất lượng, giữ chỗ (`reserve`/`commit`/`release`) nguyên tử (D-027).
  - `CraftingSystem`: một lần chế tạo tại một thời điểm, giữ nguyên liệu khi bắt đầu, tiêu một lần khi xong, trả lại khi huỷ.
  - `QuestSystem`: mục tiêu đếm nguồn riêng biệt, thưởng đúng một lần, tự kích hoạt nhiệm vụ kế tiếp (D-028).
  - `GameSession` (`domain/GameSession.ts`): nối cờ, ví, kho, chế tạo, nhiệm vụ, hội thoại, điểm đặt. Không phụ thuộc engine (D-029).
  - `validateGameplay.ts`: kiểm tra vật phẩm, công thức, nhiệm vụ và tham chiếu chéo. Mục sai bị loại có báo lỗi.
- **Engine:** `WorldView` vẽ vật nhặt được (hộp theo màu vật phẩm), trạm (vạch sáng dưới đất), điểm đặt (bệ đèn, đầu đèn sáng khi đã đặt). `GameApp` định tuyến tương tác theo loại (`npc`, `pickup`, `station`, `placement`) (D-030).
- **HUD:** thanh tiền và uy tín (góc trên phải), bảng nhiệm vụ hiện tại (góc trên trái), thông báo ngắn, panel bàn nghề (xác nhận tạm thời, D-031), kho đồ (phím I).
- **Q00 đầy đủ:** nói chuyện với Bà Nghiêm → nhặt 2 tre, 1 giấy dó, 1 dây gai → chế tạo Đèn Mộc ở bàn nghề → đặt lên chân đèn trước tiệm → nhận 30 Xu Đèn đúng một lần, đặt cờ `q00_complete` và `shop_lamp_lit`, cấp shop level 1.
- Q01 và Q02 chưa có nội dung. Module 05 và 07 sẽ thêm.

## Bằng chứng kiểm thử (đã chạy thật)

| Lệnh | Kết quả |
|---|---|
| `npm run typecheck` | Đạt |
| `npm test` | 22 file, 169 test, tất cả đạt |
| `npm run build` | Đạt. `index-*.js` 2,375.28 kB (gzip 626.81 kB). Hook dev không có trong bundle |

Test thuần (chạy trong Node), theo nhóm:
- **Module 01–03 và HUD:** `math`, `collision`, `movement`, `keyboardState`, `hubCollision`, `hubLayout`, `display`, `color`, `startupErrors`, `GameApp.startup`, `eventBus`, `translator`, `interactionSystem`, `dialogueSystem`, `contentValidation`, `interactPolicy`, `localeKeys`.
- **Module 04:**
  - `inventory`: xếp chồng, chất lượng, giữ chỗ nguyên tử, commit và release một lần, spend nguyên tử.
  - `crafting`: từ chối (công thức lạ, sai trạm, chưa mở, thiếu nguyên liệu, đang bận), tiêu nguyên liệu một lần, huỷ trả lại, không nhân đôi đầu ra, đầu ra thô không có chất lượng.
  - `questSystem`: kích hoạt, mục tiêu đếm nguồn riêng biệt, thưởng đúng một lần, khôi phục save không thưởng lại.
  - `gameSession`: Q00 chạy đầu đến cuối với nội dung thật (30 xu một lần), thiếu nguyên liệu không giữ chỗ, huỷ trả nguyên liệu, thông báo khi đặt thiếu đèn.
  - `gameplayContent`: nội dung thật không có lỗi, mọi vị trí tương tác nằm trong hub và không chồng vật cản, các lỗi tham chiếu bị loại đúng chỗ.

### Kiểm tra trong trình duyệt (Q00 đầy đủ, bằng phím và chuột thật khi có thể)

| Bước | Kết quả |
|---|---|
| Mở game | Bảng nhiệm vụ Q00 với 6 mục tiêu. Thanh tiền 0 |
| Nói chuyện với Bà Nghiêm | Mục tiêu "Nói chuyện" được đánh dấu ✓ |
| Nhặt 2 tre (2 vật khác nhau), 1 giấy, 1 dây | Mỗi mục tiêu tăng đúng; thông báo "Nhận được Tre/Giấy dó/Dây gai" dịch đúng |
| Chế tạo ở bàn nghề (panel mở, nút "Lắp" bằng click) | Nguyên liệu biến mất, có Đèn Mộc, thông báo "Đã làm xong Đèn Mộc" |
| Đặt lên chân đèn trước tiệm | Thông báo "Hoàn thành: Đêm Mở Chợ", "+30 Xu Đèn", "Đã đặt Đèn Mộc"; thanh tiền 30; cờ `q00_complete`, `shop_lamp_lit` |
| Bảng nhiệm vụ | Không còn nhiệm vụ hiện tại (Q01 chưa có) |
| Console | Không có lỗi mới. Lỗi `npc_ghost` còn lại là bài kiểm tra có chủ đích từ Module 03 |

Lưu ý quan trọng về môi trường kiểm thử: pane trình duyệt đang cho khung hình chỉ khoảng 3 lần/giây, kể cả iframe trống (D-032). Vì vậy các bước đi bộ được thực hiện với thời gian chờ dài hơn, và `maxDeltaTime` được tăng lên 0.5 s **chỉ trong trình duyệt** để rút ngắn. Logic gameplay không thay đổi.

## Chưa kiểm chứng (phải nói rõ)
- **FPS thực tế:** không đo được trong pane lúc này. Cần kiểm tra lại trên máy thật khi môi trường ổn định.
- **Panel chế tạo bằng minigame:** chưa có, hiện là nút xác nhận tạm (Module 06).
- **Lưu và tải tiến trình:** chưa có. Mất khi tải lại trang (Module 08).
- **Đọc bằng trình đọc màn hình, giữ joystick lâu, pinch zoom, tạm dừng khi ẩn tab, thiết bị thật:** như các module trước.

## Vấn đề đã biết
1. **Nội dung hội thoại và thông báo là bản nháp.** Module 12 sẽ biên tập và thêm `status` cho thẻ văn hoá.
2. **Bàn nghề và bàn khắc dùng vạch sáng dưới đất.** Chưa có mô hình thật. Chấp nhận ở placeholder.
3. **Vị trí tương tác chưa kiểm tra có hệ thống là không chặn đường đi.** Các điểm đã kiểm tra không nằm trong vật cản (test), nhưng đường đi tối ưu chưa được xem xét.
4. **Lồng đèn soi vết** trong GDD được ánh xạ thành Đèn Vân Linh (D-026).
5. **`speed` là vận tốc dự định** (D-014). Không ảnh hưởng vị trí.
6. **Mất WebGL context** (GPU reset): chưa xử lý, chỉ có log lỗi.
7. **Bundle 2.38 MB minify, 627 kB gzip,** chủ yếu do PlayCanvas. Xử lý ở Module 10.
8. **Copy tiếng Việt còn hard-code** trong `StartupErrorPanel.tsx` và `TouchControls.tsx`. Sẽ chuyển sang locale ở Module 08.

## Việc tiếp theo
- **Module 05:** máy trạng thái Đèn Soi Linh (REAL/SPIRIT, khoá chuyển đổi, hàng đợi một lần, nút Q và cảm ứng), hiệu ứng tint và hạt sprite (có tắt VFX), 3 ký hiệu (cổng, cầu, bảng hiệu) chỉ hiện ở SPIRIT, puzzle thứ tự 3 ký hiệu với gợi ý từ Bấc theo cấp, Q01 đầy đủ (kích hoạt sau Q00 + nói chuyện Cô Lam; mở công thức Đèn Vân Linh khi giải đúng).

## Checklist kiểm thử thủ công (Q00)
- [ ] `npm run dev`, mở http://localhost:5173. Không có lỗi trong console.
- [ ] Bảng nhiệm vụ hiện Q00 với 6 mục tiêu ở góc trên trái.
- [ ] Nói chuyện với Bà Nghiêm: mục tiêu đầu được đánh dấu.
- [ ] Nhặt 2 tre, 1 giấy dó, 1 dây gai ở các vị trí khác nhau. Nhặt lại cùng vật không tăng số.
- [ ] Mở bàn nghề (phía tây bắc, gần xưởng Cô Lam), nhấn "Lắp" khi đủ nguyên liệu. Nguyên liệu biến mất và có Đèn Mộc.
- [ ] Đặt Đèn Mộc lên chân đèn trước tiệm (đông nam nhà tiệm). Thông báo hoàn thành và +30 Xu Đèn hiện một lần.
- [ ] Nhấn I để mở kho đồ. Escape đóng panel. Đóng panel đang chế tạo không làm mất nguyên liệu.
- [ ] Trên điện thoại: bảng nhiệm vụ và thanh tiền không che nút điều khiển.
