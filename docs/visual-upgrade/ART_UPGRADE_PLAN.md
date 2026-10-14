# Kế hoạch nâng cấp đồ họa Linh Phố

Nhánh làm việc: `visual-upgrade/stage-1-camera` (từ `dev`). Chưa commit, chưa push. Báo cáo kết quả và giới hạn: [FINAL_ART_REPORT.md](FINAL_ART_REPORT.md).

## 1. Kiến trúc đồ họa (đã kiểm tra trong repo)

- **Engine:** PlayCanvas 2.x (`playcanvas`), giao diện React 19, build bằng Vite 8.
- **Scene:** hub 60×60 m, toạ độ mét, gốc ở tâm, +X đông, +Z nam. Layout nằm trong `src/engine/scene/hubLayout.ts` (`HUB_PROPS`). `buildHubBlockout.ts` dựng từng prop thành hộp, rồi thay bằng GLB nếu `assets.json` có khoá `hub.<id>`.
- **Model:** GLB do `assets_src/build_assets.py` sinh (chạy trong Blender). Mọi prop nhìn thấy được đã có GLB. Mặt đất và mặt nước là hộp theo chủ đích (D-072).
- **Camera:** `CAMERA_CONFIG` trong `CameraController.ts`. Góc nghiêng 40°, FOV 50°, khoảng cách mở đầu 40 m, zoom 30–90 m (D-075, D-076).
- **Gameplay gắn với vị trí:** NPC, trạm, glyph, quầy, nơi đặt đèn và pickup nằm trong `src/content/*.json`. Quest tham chiếu bằng id, không dùng toạ độ.
- **Kiểm thử:** `npm test` (50 file, 935 test), `npm run typecheck`, `npm run build`. Tất cả đạt sau khi hoàn thành các giai đoạn.

## 2. Trạng thái theo giai đoạn

| Giai đoạn | Nội dung | Trạng thái | Quyết định |
|---|---|---|---|
| 0. Kiểm tra dự án | Kiến trúc, anchor, baseline test | Xong | — |
| 1. Camera & composition | Khoảng cách 40 m, góc 40°; làn cầu–quảng trường | Xong, một phần | D-075, D-076, D-077 |
| 2. Environment layout | Gian hàng 3 dời, thêm gian hàng 5–6, xe hàng dời; anchor không đổi | Xong, một phần | D-077 |
| 3. Prop density | 29 prop trang trí; mỗi gian hàng có ba prop phụ | Xong, một phần (prop còn nhỏ) | D-077 |
| 4. Modular asset kit | Kit nhà hai biến thể (tường vôi, tường ván), mái cong (2), đèn thùng bát giác (12), prop mới (29); hiên và hàng ngói (D-082); chưa có lan can chạm | Xong, một phần | D-079, D-081, D-082 |
| 5. Lighting | Năm đèn omni ấm không đổ bóng; AO và bloom ở preset cao | Xong, một phần | D-078, D-083 |
| 6. Material polish | Sơn mài cho cổng, iron cho đai thùng; chưa có texture hay biến thể màu | Một phần | D-079 |
| 7. Atmosphere & VFX | Đom đóm (14 hạt), tắt khi giảm hiệu ứng; chưa có đung đưa đèn và mái | Một phần | D-079 |
| 8. NPC & animation | NPC quay về người chơi trong 4.5 m; chưa có hoạt ảnh chào | Một phần | D-079 |
| 9. QA & tối ưu | Test, build, số liệu tĩnh, gameplay mô phỏng; chưa đo FPS | Một phần | Xem báo cáo |

## 3. Việc còn lại (theo thứ tự ưu tiên đề xuất)

1. Đo FPS trên máy thật (desktop và điện thoại). Pane không vẽ khung liên tục nên không đo được ở đó.
2. Kiểm tra mái che nhân vật ở góc 40° (`RoofFader`) khi đi sau nhà tiệm và xưởng.
3. ~~Xem lại gian hàng 5 ở phía tây làn~~ Đã dời lên đông bắc quảng trường (D-080).
4. Thêm đèn treo dây và cụm đèn treo (chưa có trong layout), và phông nền có tầng kiến trúc xa (cần asset ngoài hoặc model mới).
5. Lan can chạm và cửa sổ chạm. Ngói hiện chỉ xen hai màu, chưa có texture.
6. Hoạt ảnh chào cho NPC và đung đưa nhẹ cho đèn và mái vải.
7. Đo chi phí AO và bloom trên điện thoại, rồi quyết định có bật ở preset mobile không.

## 4. Rủi ro gameplay khi sắp xếp lại layout

Mọi vị trí dưới đây là toạ độ game, không đổi trong các giai đoạn đã làm. Nếu dời một anchor, phải dời cả vật thể liên quan rồi chạy `gameplayContent.test.ts`.

- **NPC** (`npcs.json`): `npc_ba_nghiem` (-3, -2), `npc_co_lam` (-10, -15), `npc_ong_do` (-14, 28), `npc_bac` (4, -2, lơ lửng).
- **Trạm và glyph** (`world.json`): `station_workbench` (-12.6, -12.6), `station_engraving` (6.5, -12); `glyph_gate` (12.5, -19.8), `glyph_bridge` (8, 17.2), `glyph_signboard` (-19.5, 14.6).
- **Đặt đèn** (`world.json`): `shop_lamp` (-11.5, 13.5).
- **Quầy tiệm** (`shop.json`): quầy (-13.8, 15.2); ô 1–3 (-17.5, 16.8), (-15, 16.8), (-12.5, 16.8).
- **Pickup** (`world.json`): 18 pickup có toạ độ riêng.
- **Quest** (`quests.json`): tham chiếu bằng id, không dùng toạ độ.

## 5. Cách hoàn tác

- Camera: `CAMERA_CONFIG` (`pitchDeg` 40, `defaultDistance` 40). Đổi lại là 45 và 70; ghi chú trong D-075 và D-076.
- Layout và prop: các mục `stall(...)`, `PROP_Crate_*`, `PROP_Jar_*`, v.v. trong `hubLayout.ts`, và các dòng tương ứng trong `assets.json`. Hoàn tác theo commit khi đã commit.
- Model: sửa builder trong `build_assets.py` rồi build lại. File `.blend` nguồn nằm trong `assets_src/`.
- Ghi chú: bản preview Blender cũ (`assets_src/blender_hub_composition.py`, `assets_src/hub_preview/`) dựng bằng primitive, không phản ánh game, có thể xoá.
