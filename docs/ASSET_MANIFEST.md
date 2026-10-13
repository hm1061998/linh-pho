# Manifest tài sản — Linh Phố (MVP)

Cập nhật: 2026-10-14. Tài liệu này là hợp đồng giữa code và Blender. Mọi model 3D phải khớp với dòng tương ứng ở đây trước khi nhập vào game.

**Tình trạng hiện tại:** repo không có model 3D production nào. Mọi vật thể trong game là hình khối placeholder, vẽ từ dữ liệu (`src/content/shop.json`, `src/engine/scene/hubLayout.ts`). Duy nhất có file GLB là **test GLB** do code sinh (`dev.test_crate`, xem mục 7), chỉ dùng để kiểm tra bộ nạp, không phải asset thật.

---

## 1. Quy tắc chung

| Mục | Quy định |
|---|---|
| Đơn vị | 1 đơn vị Blender = 1 m. Áp dụng transform (scale 1, rotation 0) trước khi xuất. |
| Hướng | Trục Y lên. Mặt trước của vật hướng về −Z. |
| Pivot | Vật tĩnh: giữa đáy, tại y = 0 (mặt sàn). NPC: giữa bàn chân, tại y = 0. Đèn treo: pivot tại điểm treo. |
| Định dạng | glTF 2.0 binary (`.glb`), một file cho một asset. Xuất từ `.blend` nguồn, giữ `.blend` trong kho. |
| Vật liệu | PBR metallic-roughness: base colour, roughness, metallic, normal, emissive. Không dùng shader Blender procedural (phải bake). |
| Atlas | Một atlas màu cho mỗi nhóm (`TEX_EnvAtlas_01`), tối đa 1024×1024 ở MVP. Không dùng texture riêng cho từng chi tiết nhỏ. |
| Tên node | Theo `LINH_PHO_BLENDER_ART_BIBLE.md`: `ENV_*`, `PROP_*`, `NPC_*`, `FX_*`, `COL_*`. Tên material: `MAT_*`. |
| Collider | Node `COL_*` là hình hộp hoặc trụ, không hiển thị. Không dùng mesh thật làm collider. |
| Shader | Chỉ StandardMaterial của PlayCanvas. Không shader riêng theo nền tảng. |
| Ánh sáng | Không bake lightmap ở MVP. Đèn phát sáng dùng emissive. Không color grading ở MVP. |
| Chất lượng | Các preset (thấp, di động, cao) hiện chỉ đổi mật độ điểm ảnh. Ngân sách tam giác ở MVP là một mức duy nhất. Số tam giác và atlas cho di động sẽ tách khi có model thật để đo. |

Ghi nguồn: mọi asset bên thứ ba (model, texture, animation, âm thanh) phải ghi trong `docs/ASSET_SOURCES.md` với URL, giấy phép, ngày tải. Hiện chưa có asset bên thứ ba nào.

---

## 2. Vật phẩm trong cửa tiệm (có trong `shop.json`)

Các vật này có hình khối placeholder ngay trong JSON. Khi có model, thêm `source` vào `assets.json`; hình khối vẫn là dự phòng. Các con số "Tam giác tối đa" là ngân sách đề xuất ban đầu, chưa đo trên model thật, và sẽ điều chỉnh sau lần nhập đầu tiên.

| Id manifest | Loại | Kích thước (m) | Tam giác tối đa | Pivot | Animation | Collider | Trạng thái |
|---|---|---|---|---|---|---|---|
| `furniture.lantern_shelf` | Kệ Đèn | 1.6 × 1.1 × 0.5 | 1500 | đáy giữa | không | không | placeholder |
| `furniture.bamboo_vase` | Bình tre | 0.5 × 0.9 × 0.5 | 800 | đáy giữa | không | không | placeholder |
| `furniture.paper_painting` | Tranh giấy dó | 1.0 × 0.8 × 0.08 | 600 | đáy giữa | không | không | placeholder |
| `furniture.stool` | Ghế đẩu | 0.6 × 0.45 × 0.6 | 800 | đáy giữa | không | không | placeholder |
| `furniture.hanging_lamp` | Đèn treo giấy | đường kính 0.5 | 1200 | điểm treo, cách sàn 1.3 m | không | không | placeholder, cần emissive |

Ô trưng bày (`shop_slot_1..3`) không cần model: là mặt đế tròn do code vẽ.

---

## 3. Vật thể trong hub (hiện là blockout trong code)

Kích thước và vị trí đọc trực tiếp từ `src/engine/scene/hubLayout.ts`. Khi thay bằng GLB, giữ đúng vị trí và kích thước đó. Không đổi bố cục để vừa model.

| Node (tên đề xuất) | Hiện tại (code) | Ghi chú cho Blender | Trạng thái |
|---|---|---|---|
| `ENV_House_Shop_Body` | khối 8 × 4 × 6, tâm (−17, 2, 10) | Thân tiệm. Vật liệu riêng: game làm sáng vật liệu này theo cấp tiệm. | blockout |
| `ENV_House_Shop_Roof` | khối 9.2 × 0.8 × 7.2 | Mái ngói đất nung. | blockout |
| `PROP_Signboard_Shop` | khối 4 × 0.9 × 0.15 | Biển hiệu. Game làm sáng biển này theo cấp tiệm. | blockout |
| `ENV_House_Workshop_Body` | khối 7 × 3.5 × 6 | Xưởng Cô Lam. | blockout |
| `PROP_Workbench_Workshop` | khối 1.6 × 1 × 1 | Bàn nghề. Va chạm. | blockout |
| `PROP_Lantern_Workshop` | cầu 0.5 | Đèn treo, phát sáng. | blockout |
| `ENV_Bridge_Deck` | mặt cầu | Mặt cầu. Vật liệu riêng: game làm sáng theo cờ `bridge_glow`. | blockout |

Mục tiêu ngân sách tam giác cho hub: dưới 60 000 tam giác trên màn hình mặc định. Đây là mục tiêu chưa đo, sẽ kiểm tra bằng số liệu F3 khi có model thật.

---

## 4. Nhân vật và animation

| Nhân vật | Chiều cao (m) | Tam giác tối đa | Animation bắt buộc | Animation tùy chọn | Ghi chú |
|---|---|---|---|---|---|
| `NPC_BaNghiem` (Bà Nghiêm) | 1.7 | 6000 | `idle` | — | Pivot giữa bàn chân. Blockout: `NpcRenderer.ts`, cao 1.7 m. |
| `NPC_CoLam` (Cô Lam) | 1.7 | 6000 | `idle` | — | |
| `NPC_OngDo` (Ông Độ) | 1.7 | 6000 | `idle` | — | Có va chạm (bán kính 0.35 m). |
| `NPC_Bac` (Bấc, đèn sprite) | 0.36 đường kính | 1200 | `idle` | — | Không chặn đường. Phát sáng. Blockout: quả cầu 0.36 m. |

**Quy tắc animation:** một clip có tên chính xác như bảng. Thiếu clip được yêu cầu thì game chạy `idle`. Thiếu cả `idle` thì mô hình đứng yên, không lỗi. Hiện game chưa phát animation (NPC là placeholder); phần này chờ có model thật.

---

## 5. Lightmap, màu và ánh sáng

- Không bake lightmap ở MVP. Cấu trúc node phải giữ được để bake sau (không gộp các vật ở mức Blender khi chưa cần).
- Đèn phát sáng (lồng đèn, đèn treo, biển hiệu, dấu ký hiệu): dùng `emissive` của PBR, không dùng nguồn sáng thật nhiều.
- Màu: bảng màu tông ấm, nền tối (đêm). Không dùng màu lẫn lộn với tín hiệu gameplay (ví dụ: xanh ngọc chỉ dành cho Đèn Soi Linh và ký hiệu).

---

## 6. Kiểm tra trước khi nhập (checklist)

- [ ] Đúng tên node và tên material theo bảng.
- [ ] Transform đã áp dụng (scale 1, rotation 0).
- [ ] Pivot đúng vị trí quy định.
- [ ] Số tam giác không vượt cột "Tam giác tối đa".
- [ ] Không có shader Blender procedural, không có texture ngoài atlas.
- [ ] Animation đúng tên, đúng clip bắt buộc.
- [ ] Collider `COL_*` có và không hiển thị.
- [ ] File `.glb` nhập được trong test viewer trên desktop và Android trước khi làm hàng loạt.
- [ ] Ghi nguồn, giấy phép nếu có asset bên thứ ba.

---

## 7. Test GLB do code sinh

`src/engine/assets/testGlb.ts` tạo ra một khối lập phương glTF 2.0 nhị phân, có một clip `idle` quay. Mục đích:

- Kiểm tra bộ nạp GLB chạy trong trình duyệt (asset `dev.test_crate`).
- Kiểm tra cách xử lý animation thiếu (`animationFor` trả về `idle`).
- Kiểm tra cấu trúc file (`src/tests/assetFormats.test.ts`).

Đây **không** phải asset thật, và không có trong bản phát hành (chỉ nạp trong chế độ phát triển). Asset thật đi qua pipeline Blender ở mục 8.

---

## 8. Brief cho Blender

Dùng lại các prompt trong `LINH_PHO_BLENDER_ART_BIBLE.md` (BLENDER-P01 đến P06). Thứ tự làm:

1. **Kiểm tra pipeline trước:** xuất một khối với đúng quy tắc mục 1, nhập vào test viewer, xem hướng và vật liệu. Nếu sai, sửa pipeline trước khi làm hàng loạt.
2. **Vật trong cửa tiệm (mục 2)**, vì mỗi cái nhỏ và độc lập.
3. **Hub (mục 3)**, giữ bố cục, không đổi vị trí.
4. **Nhân vật (mục 4)** cuối cùng, vì cần rig và clip.

Mỗi model khi xong: đặt vào `assets/` (ngoài repo nếu quá lớn), thêm `source: { "kind": "url", "url": "/assets/<tên>.glb" }` vào `src/content/assets.json`, chạy lại trò chơi. Không cần sửa code gameplay.

---

## 9. Bảng trạng thái (cập nhật theo từng lần nhập)

| Asset | Có GLB | Đã kiểm tra trên desktop | Đã kiểm tra trên Android |
|---|---|---|---|
| Năm nội thất (mục 2) | không | — | — |
| Hub (mục 3) | không | — | — |
| NPC và animation (mục 4) | không | — | — |
| `dev.test_crate` (mục 7) | sinh bằng code | đã nạp trong Chrome (dev) | chưa thử |
