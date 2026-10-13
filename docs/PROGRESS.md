# Tiến độ — Linh Phố

Cập nhật: 2026-10-13. Theo quy trình Prompt 00 (A–F), mỗi module chạy riêng, có bằng chứng và một commit.

## Lịch sử commit

| Commit | Nội dung |
|---|---|
| `299ea45` | `docs(module-00)`: bộ tài liệu thiết kế |
| `5aa6d3f` | `feat(module-01)`: bootstrap PlayCanvas và blockout hub |
| `111df20` | `chore`: `.gitattributes` (LF, file nhị phân) |
| (Module 02) | `feat(module-02)`: nhân vật, camera, input, va chạm |

## Đã hoàn thành

### Module 00 — Quy tắc và cấu trúc repo
- Repo theo layout GDD G3: `src/app`, `src/engine`, `src/ui`, `src/shared`, `src/tests`, `docs`.
- Các thư mục `domain/`, `content/`, `ports/`, `adapters/` chưa tạo vì chưa có code dùng đến.
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
- **Va chạm:** `collision.ts` (tròn–hộp, chia bước chống xuyên vật mỏng). Vật cản lấy từ prop `solid` trong `hubLayout.ts`. Sông được tách để cầu là lối duy nhất qua.
- **Camera (`engine/camera/`):** `CameraController`, nghiêng 45°, kéo ngang để xoay, zoom 30–90 m, bám người chơi mượt, tiêu điểm trong biên.
- **Điều khiển cảm ứng (`ui/hud/TouchControls.tsx`):** joystick trái dưới và nút "Tương tác" (placeholder), chỉ hiện với `(pointer: coarse)`.
- **Hook dev:** `window.__linhPho.game` chỉ có trong dev, đã kiểm chứng là không có trong bundle production.

## Bằng chứng kiểm thử (đã chạy thật)

| Lệnh | Kết quả |
|---|---|
| `npm run typecheck` | Đạt |
| `npm test` | 10 file, 59 test, tất cả đạt |
| `npm run build` | Đạt. `index-*.js` 2,320.75 kB (gzip 610.15 kB) |

Test thuần (chạy trong Node):
- `math.test.ts`: clamp, đổi độ/radian, wrap góc, góc ngắn nhất qua ±π.
- `collision.test.ts`: đẩy ra khỏi hộp, góc, chặn tường, không xuyên vật mỏng 0.12 m, trượt dọc tường, giới hạn biên.
- `movement.test.ts`: hướng theo camera (yaw 0 và 90°), deadzone, chuẩn hoá đường chéo, làm mượt không phụ thuộc frame rate, vị trí camera.
- `keyboardState.test.ts`: WASD và mũi tên tương đương, phím đối nhau triệt tiêu, clear khi mất focus, không bind Tab.
- `hubCollision.test.ts`: điểm xuất phát tự do, mọi vật cản trong biên, sông chặn, cầu đi qua được, độ cao mặt đất/quảng trường/cầu.
- `hubLayout.test.ts`, `display.test.ts`, `color.test.ts`, `startupErrors.test.ts`, `GameApp.startup.test.ts`: từ Module 01.

Kiểm tra trong trình duyệt (dev server, built-in browser). Vị trí đọc từ `__linhPho.game.debugSnapshot()`:

| Kiểm tra | Kết quả |
|---|---|
| Giữ W 4.5 s từ (0, 10) | Dừng ở z = 1.15, đúng mép chân đèn quảng trường (0.8 + 0.35). Thả phím thì vận tốc về 0 |
| Giữ A vào nhà tiệm | Dừng ở x = −12.65, đúng mép đông nhà (−13 + 0.35) |
| Giữ D 0.8 s, yaw 0 | dz = 0 (đi thẳng sang đông) |
| Kéo chuột thật 11 px và 5 px trên canvas | Yaw thay đổi theo chuột. Đưa về 0 được, rồi W/D đi đúng hướng |
| Phím E: 1 lần nhấn + 2 lần lặp | Đếm đúng 1 |
| `pushBlocker` khi đang giữ D | Không di chuyển, E không được tính |
| `popBlocker` | Di chuyển lại (dx = 3.36 sau 0.8 s) |
| Mất focus (`blur`) khi đang giữ D | Dừng ngay, không trôi (drift 0 sau 0.8 s) |
| Wheel: 10 lần vào, 10 lần ra | Dừng đúng ở 30 m và 90 m |
| Viewport 375×812, `(pointer: coarse)` | Hiện joystick (24,648, 140 px) và nút tương tác (241,708). Không cuộn ngang |
| Kéo joystick thật lên trên | Stick: (0,0) → (0,0.7) → (0,1) → (0,0). Thả tay về (0,0), knob về tâm, không trôi |
| Console | Không có lỗi |

## Chưa kiểm chứng (phải nói rõ)
- **Giữ joystick lâu:** Công cụ kéo chuột của trình duyệt chỉ có down → move → up nhanh. Không giữ được joystick đủ lâu để đo chuyển động liên tục. Chuyển động qua joystick dùng cùng đường đi với bàn phím (`addMoveInputs`), đã kiểm chứng ở trên.
- **Pinch zoom:** Chưa có thao tác hai ngón thật. Logic chỉ được đọc qua code.
- **Tạm dừng khi ẩn tab:** Code có, chưa đổi tab thật.
- **Thiết bị cảm ứng thật:** Chỉ có giả lập viewport.
- **Panel lỗi WebGL2 trên trình duyệt thật:** Chỉ có test logic.
- **FPS trên GPU thật:** Chưa đo.

## Vấn đề đã biết
1. **`speed` là vận tốc dự định:** Khi áp sát tường, `speed` vẫn khoảng 4.2 m/s (D-014). Không ảnh hưởng vị trí.
2. **Bậc lên cầu:** Mặt cầu cao 0.375 m, nhân vật bước lên ngay lập tức, không có dốc. Chấp nhận ở placeholder.
3. **Mái nhà có thể che người chơi:** Chưa có roof fade và chưa kiểm tra có hệ thống. Camera không xuyên mái (D-013), nhưng mái có thể che nhân vật khi đứng sát nhà ở góc nhìn nào đó.
4. **Bundle:** JS 2.3 MB minify, 610 kB gzip, chủ yếu do PlayCanvas. Xử lý ở Module 10.
5. **Mất WebGL context** (GPU reset): chưa xử lý, chỉ có log lỗi.
6. **Đổi DPR không đổi kích thước** (kéo cửa sổ sang màn hình khác): canvas giữ DPR cũ.
7. **Frame đầu có thể trống thoáng qua** sau khi tải trang. Chưa xác định là do dev server hay engine.
8. **Copy tiếng Việt hard-code** trong `StartupErrorPanel.tsx` và `TouchControls.tsx`. Chuyển sang locale ở Module 08.
9. **Lệch hướng do yaw không về 0:** Đây là hành vi đúng, nhưng dễ gây hiểu nhầm khi kiểm thử. Ghi nhận ở đây.

## Việc tiếp theo
- **Module 03:** `InteractionSystem` (ID ổn định, phạm vi 2 m, gợi ý E/chạm), `DialogueSystem` đọc JSON, `DialoguePanel`, 4 NPC placeholder (`npc_ba_nghiem`, `npc_co_lam`, `npc_ong_do`, `npc_bac`). `interactPresses` sẽ được thay bằng sự kiện interact thật.

## Checklist kiểm thử thủ công (Module 02)
- [ ] `npm install` rồi `npm run dev`, mở http://localhost:5173.
- [ ] W, A, S, D và các phím mũi tên đi đúng hướng so với màn hình (W là lên).
- [ ] Nhân vật không đi xuyên quầy, nhà, cột đèn, bụi cây, sông. Đi qua cầu được.
- [ ] Kéo chuột ngang trên nền để xoay camera. Phím di chuyển xoay theo.
- [ ] Lăn chuột để zoom, dừng ở mức gần và xa nhất.
- [ ] Nhấn E không gây lỗi. Đổi tab rồi quay lại, nhân vật không nhảy vị trí.
- [ ] Trên điện thoại (hoặc chế độ cảm ứng): joystick điều khiển được, thả tay là dừng, nút "Tương tác" có phản hồi.
- [ ] Không có lỗi đỏ trong console.
