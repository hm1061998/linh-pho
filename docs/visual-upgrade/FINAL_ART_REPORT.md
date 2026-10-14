# Báo cáo nâng cấp đồ họa Linh Phố (Giai đoạn 0–9)

Nhánh: `visual-upgrade/stage-1-camera` (từ `dev`). Chưa commit, chưa push. Kế hoạch và trạng thái từng giai đoạn: [ART_UPGRADE_PLAN.md](ART_UPGRADE_PLAN.md).

## 1. Tóm tắt

Khu chợ đã đổi từ bản đồ hộp sang khu chợ có làn đi, cụm gian hàng và prop, đèn ấm, mái cong và đom đóm. Gameplay vẫn chạy: người chơi đi tới NPC, tương tác mở hội thoại, cờ nhiệm vụ được đặt, test và build đạt.

Chưa đạt mục tiêu hình ảnh của IMAGE A. Chất lượng model vẫn đơn giản, nền xa là khoảng xám, hub còn thưa ở rìa, không có đèn treo dây và chưa đo FPS trên máy thật. Các phần này nằm trong danh sách việc còn lại (mục 6).

## 2. So sánh trước và sau

Ảnh chụp ở camera mặc định, trong trình duyệt, cùng một phiên dev. Ảnh chỉ có trong phiên làm việc, chưa lưu thành file.

| Khía cạnh | Trước | Sau |
|---|---|---|
| Khoảng cách mở đầu | 70 m: người chơi và NPC chỉ vài pixel | 40 m: người chơi, NPC, gian hàng, đèn trung tâm đọc được |
| Góc nghiêng | 45° | 40° (biên dưới GDD) |
| Quảng trường | Vuông trống, gian hàng đối xứng | Có làn từ cầu tới đèn trung tâm, hai gian hàng hai bên làn |
| Mật độ prop | Vài cụm đơn lẻ | Mỗi gian hàng có ba prop phụ; thêm 29 prop trang trí |
| Đèn | Quả cầu vàng, không chiếu sáng | Thùng bát giác có nan; năm đèn omni ấm tại landmark |
| Mái nhà | Hình hộp phẳng | Mép nâng về phía góc |
| Vật liệu | Gỗ đồng đều, cổng màu gỗ | Cổng sơn mài đỏ nâu; dải đai thùng bằng sắt |
| Sinh khí | Tĩnh | Đom đóm trôi quanh đèn; NPC quay về người chơi khi lại gần |

## 3. Đánh giá theo tiêu chí (ước lượng từ ảnh, không tự chấm 5/5)

| Tiêu chí | Điểm | Bằng chứng |
|---|---|---|
| Camera & composition | 3/5 | 40 m, 40°. Vẫn nhìn từ trên, mép nền 60 m còn thấy ở góc |
| Architecture quality | 2/5 | Mái cong, đèn thùng; nhà vẫn là hình hộp với cửa sổ đơn giản |
| Props & environment density | 3/5 | 29 prop mới, mỗi gian hàng ba prop; rìa hub vẫn thưa |
| Lighting & atmosphere | 3/5 | Năm đèn omni ấm, không đổ bóng; chưa có AO, bloom |
| Material consistency | 2/5 | Hai vật liệu mới; chưa có texture, chưa có biến thể màu |
| Vietnamese visual identity | 2/5 | Mái cong, cổng sơn mài, đèn lồng. Chưa có nhà kiểu Việt riêng |
| Gameplay readability | 3/5 | Đèn trung tâm và làn đọc được; chưa có chỉ dẫn trong thế giới cho nhiệm vụ |
| Runtime performance | Chưa đo | Xem mục 5 |

## 4. Thay đổi trong repo

- **Camera:** `src/engine/camera/CameraController.ts` (góc 40°, khoảng cách 40 m).
- **Layout:** `src/engine/scene/hubLayout.ts` (gian hàng 3, 5, 6; xe hàng; 29 prop trang trí). Anchor NPC, trạm, glyph, quầy, đặt đèn và pickup không đổi.
- **Ánh sáng:** `src/engine/scene/buildHubBlockout.ts` (`LANDMARK_LIGHTS`, năm đèn omni).
- **VFX và NPC:** `src/engine/fx/Fireflies.ts` (mới); `src/engine/npc/NpcRenderer.ts` (quay mặt khi lại gần); `src/app/GameApp.ts` (nối đom đóm, giảm hiệu ứng, cập nhật NPC).
- **Model:** `assets_src/build_assets.py` (builder mới: prop trang trí, mái cong, đèn thùng, gian hàng 5–6, vật liệu sơn mài và iron); `src/content/assets.json` (khai báo 39 model mới).
- **GLB:** 39 file mới và 15 file có sẵn được sinh lại trong `public/assets/`. Mỗi file sinh kèm `.blend` nguồn trong `assets_src/`.
- **Tài liệu:** `docs/DECISIONS.md` (D-075 đến D-079, D-013 được ghi chú đã thay đổi), `docs/ASSET_MANIFEST.md` (mục 3c), `docs/visual-upgrade/` (kế hoạch và báo cáo này).

## 5. Số liệu

Đo được:

- `npm run typecheck`: đạt.
- `npm test`: 50 file, 935 test đạt (ban đầu 779).
- `npm run build`: đạt (exit 0).
- Scene đang chạy (đếm từ scene graph, không phải thống kê khung hình): 208 render, 266 mesh instance (chưa batch), khoảng 27 000 tam giác (ngân sách hub 60 000), 6 đèn (1 directional có bóng, 5 omni không bóng).

Chưa đo:

- **FPS:** pane chỉ vẽ khung hình khi có thao tác, nên số đọc được (1 fps) không có ý nghĩa. Cần đo trên máy desktop và điện thoại mục tiêu.
- **Draw call thực tế:** 266 mesh instance chưa batch là giới hạn trên. Số thực tế cần đo trên khung hình.
- **Dung lượng tải và thời gian tải đầu tiên:** chưa đo.

## 6. Giới hạn và việc chưa làm

- **Model:** nhà và gian hàng vẫn là hình hộp với chi tiết tối thiểu. Chưa có nhà kiểu Việt riêng, chưa có kit kiến trúc (hiên, lan can chạm, cửa nhiều cánh).
- **Nền và rìa hub:** mặt đất và mặt nước vẫn là hộp theo thiết kế. Nền xa là màu `#0F1A2A`, không có đường chân trời hay tầng kiến trúc xa. Rìa hub thưa.
- **Đèn:** chưa có đèn treo dây và cụm đèn treo đúng như IMAGE A. Chưa có bóng tiếp xúc (AO) và bloom.
- **Chuyển động:** chưa có hoạt ảnh chào cho NPC (chỉ quay mặt), chưa có đung đưa đèn và mái vải. Đom đóm là chấm sáng trơn.
- **Gameplay:** đường chéo từ tây nam quảng trường tới cầu vẫn bị lan can cầu và mép sông chặn (hình học có sẵn). Người chơi đi qua làn đông nam. Chưa kiểm tra mái che nhân vật ở góc 40° khi đi sau mái.
- **Kiểm thử gameplay:** đã mô phỏng đi bộ, tương tác với Bà Nghiêm, mở hội thoại và đặt cờ; không chơi hết chuỗi nhiệm vụ, chưa thử chế tác, mua hàng, lưu và tải.
- **Di động:** chưa thử trên thiết bị thật.
- **Góc nghiêng:** 40° là biên dưới GDD. Hạ thấp hơn cần sửa GDD (xem D-076).

## 7. Cách mở rộng

Thêm một prop trang trí mới:

1. Viết builder trong `assets_src/build_assets.py` (dùng `Shape`, `_gbox`, `_game_lantern`). Cylinder dùng 16 đoạn để đỉnh nằm đúng biên hộp. Vị trí tâm (pivot) ở giữa hộp.
2. Thêm id và builder vào `HUB_DRESSING` (hoặc `_hub_detail` cho vật đã có).
3. Trong Blender, chạy `build(["hub.<id>"])`. Đọc dòng báo cáo `w h d` và so với kích thước đã khai báo.
4. Thêm `hub.<id>` vào `src/content/assets.json`, và `box(...)` hoặc `solid(box(...))` vào `HUB_PROPS` trong `hubLayout.ts`.
5. Chạy `npm test`. `furnitureModels.test.ts` kiểm tra kích thước, pivot, tam giác và tên node.

Lưu ý khi chạy build: `REPO` trong `build_assets.py` đang trỏ tới `D:\Works\Linh Phố\linh-pho`. Khi chạy trên máy khác, đổi đường dẫn này hoặc thay bằng đường dẫn thật.

## 8. Ghi chú về môi trường làm việc

- Cổng 5173 đang có game ở tab khác và giữ save qua Web Locks. Mọi kiểm thử trình duyệt dùng dev server ở cổng 5174 (origin khác, save riêng). Không đóng tab nào của người dùng.
- `.claude/launch.json` (mới) trỏ tới cổng 5174 để preview.
- Trong phiên Blender, các object preview cũ do chính phiên này tạo (collection `HUB_BLOCKOUT`) đã được xoá trước khi build lại. Session còn `Camera` và `Light` mặc định.
- Bản preview Blender cũ (`assets_src/blender_hub_composition.py`, `assets_src/hub_preview/`) dựng bằng primitive, không phản ánh game. Có thể xoá.
- Các file chưa theo dõi trong git: `docs/CURRENT GAME.png` và `docs/TARGET REFERENCE.png` (đã có sẵn từ trước).
