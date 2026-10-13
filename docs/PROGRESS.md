# Tiến độ — Linh Phố

Cập nhật: 2026-10-13. Theo quy trình Prompt 00 (A–F), mỗi module chạy riêng và có bằng chứng.

## Đã hoàn thành

### Module 00 — Quy tắc và cấu trúc repo
- Repo theo layout GDD G3: `src/app`, `src/engine`, `src/ui`, `src/shared`, `src/tests`, `docs`.
- Các thư mục `domain/`, `content/`, `ports/`, `adapters/` chưa tạo vì chưa có code dùng đến. Tạo khi module cần.
- Tài liệu thiết kế (`LINH_PHO_*.md`) vẫn ở thư mục gốc `linh-pho/`, không sao chép vào `docs/`.

### Module 01 — Bootstrap và cảnh 3D
- Vite + React 19 + TypeScript strict. PlayCanvas Engine 2.23.2 dùng qua npm.
- Canvas nằm dưới HUD root trong suốt. Engine chỉ chạy WebGL2.
- Blockout 60×60 m bằng primitive: nền, quảng trường, sông, cầu, nhà tiệm (có bảng hiệu trống), xưởng, cổng, 4 quầy, đèn lớn quảng trường, 4 đèn góc, bụi cây. Đèn có emissive, không dùng đèn điểm thật.
- Ánh sáng: ambient indigo + directional ấm từ tây bắc, có shadow.
- Resize theo container (`ResizeObserver`), DPR tối đa 2, tạm dừng khi ẩn tab, dispose đầy đủ khi unmount hoặc HMR.
- Lỗi khởi động WebGL2 hiển thị panel tiếng Việt, không để trắng trang.
- Scripts: `dev`, `build` (có typecheck), `typecheck`, `test`, `preview`.

## Bằng chứng kiểm thử (đã chạy thật)

| Lệnh | Kết quả |
|---|---|
| `npm run typecheck` | Đạt (exit 0) |
| `npm test` | 5 file, 16 test, tất cả đạt |
| `npm run build` | Đạt. `index-*.js` 2,309.69 kB (gzip 606.34 kB), CSS 1.59 kB |

Các test:
- `display.test.ts` — giới hạn DPR, giá trị không hợp lệ.
- `color.test.ts` — parse hex.
- `hubLayout.test.ts` — ID duy nhất, nằm trong 60 m, không lún dưới đất, màu hợp lệ, có đủ 3 landmark.
- `startupErrors.test.ts` — ánh xạ `AggregateError` → `webgl2_unavailable`.
- `GameApp.startup.test.ts` — mock `playcanvas`, kiểm tra `GameApp.create` từ chối với `webgl2_unavailable` và chỉ yêu cầu WebGL2.

Kiểm tra trong trình duyệt (dev server, `http://localhost:5173`, built-in browser):
- Cảnh render đúng. Console không có lỗi. Hai dòng "Powered by PlayCanvas" là do StrictMode mount hai lần khi dev.
- DOM có 1 canvas, cả sau khi HMR. Kích thước backbuffer = CSS × DPR: 1348×914 (DPR 1), 750×1624 cho viewport 375×812 (DPR 2).
- Đổi kích thước trực tiếp không reload: canvas cập nhật đúng.
- Không cuộn ngang ở 375 px.
- Đo `requestAnimationFrame`: 60 lần/giây, một vòng lặp duy nhất.

## Chưa kiểm chứng (phải nói rõ)
- **Panel lỗi WebGL2 trên trình duyệt thật:** chỉ có test logic. Không có trình duyệt không hỗ trợ WebGL2 để thử.
- **Tạm dừng khi ẩn tab:** code có, chưa thử đổi tab thật.
- **Thiết bị di động thật:** chỉ có giả lập viewport trong trình duyệt.
- **Hiệu năng:** chưa đo FPS trên GPU thật. Chỉ đo được số rAF/giây trong môi trường dev.

## Vấn đề đã biết
1. **Kích thước bundle:** JS 2.3 MB minify, 606 kB gzip, chủ yếu do PlayCanvas. Build còn cảnh báo chunk size. Xử lý ở Module 10 (tách chunk, đo lại).
2. **Khi mất WebGL context** (GPU reset): chưa xử lý. Hiện chỉ có log lỗi.
3. **Đổi DPR không đổi kích thước** (kéo cửa sổ sang màn hình DPR khác): chưa phát hiện, canvas giữ DPR cũ.
4. **Frame đầu có thể trống thoáng qua** sau khi tải trang. Chưa xác định là do dev server hay do engine. Cần kiểm tra lại trên build production.
5. **Copy tiếng Việt hard-code** trong `StartupErrorPanel.tsx`. Chuyển sang locale ở Module 08.

## Việc tiếp theo
- **Module 02:** `PlayerController`, `CameraController`, `InputService`. Thay camera overview tạm bằng camera 3/4 có giới hạn. Thêm dt clamp và kiểm tra xuyên tường.
- Trước khi làm Module 02, người dùng nên xác nhận blockout đủ rõ trên máy của họ (checklist bên dưới).

## Checklist kiểm thử thủ công (Module 01)
- [ ] `npm install` rồi `npm run dev` chạy không lỗi.
- [ ] Trang mở ra thấy cảnh 3D, không có panel lỗi.
- [ ] Console không có lỗi đỏ (dòng "Powered by PlayCanvas" xuất hiện là bình thường).
- [ ] Đổi kích thước cửa sổ: cảnh không bị méo, không có thanh cuộn.
- [ ] Nhìn được cả 4 góc hub, đèn quảng trường và cầu gỗ.
- [ ] `npm run build` và `npm run preview` chạy được.
- [ ] Trên điện thoại: cảnh hiện đầy màn hình, không cuộn ngang.
