# Model người dùng cung cấp — 2026-10-14

Nguồn: `docs/Nhan_Vat.glb`, `docs/Dong_hanh.glb`, `docs/Den_Long.glb`, `docs/Ba_NGhiem.glb`, `docs/Co_Lam.glb`, `docs/Ong_Do.glb` do người dùng cung cấp. Chưa có thông tin URL hoặc giấy phép; không suy đoán giấy phép.

Chạy `assets_src/adapt_supplied_models.py` trong Blender để xuất lại các asset, rồi chạy `assets_src/compact_supplied_sources.py` để mỗi file nguồn chỉ giữ scene của asset đó. Chạy pipeline này **sau** `build_assets.py` nếu dựng lại toàn bộ asset, vì script cũ sinh model blockout tại cùng đường dẫn. `preview_supplied_models.py` render GLB đã xuất để kiểm tra hình ảnh.

- `Nhan_Vat` → `player_hero`: cao 1,70 m ở rest pose, pivot giữa chân; rig 13 bone với gối, cổ chân và khuỷu tay, trọng số chuyển tiếp mềm, clip idle và walk. Walk dựng lại bằng giải hai đoạn chân theo quỹ đạo cổ chân: 60% pha trụ trên mặt đất, 40% pha vung chân thấp (8,5 cm); chân trụ lùi đều 0,64 m trong 0,6 giây để triệt chuyển động tiến. Thân chuyển trọng tâm nhẹ, tay đánh ngược chân; điểm đầu/cuối khớp nhau. Tốc độ đi bộ giảm từ 4,2 xuống 1,5 m/s để phù hợp dáng đi. Game blend idle/walk 0,2 giây, cadence theo tốc độ di chuyển thực tế chia cho tốc độ pha trụ (0,64/0,6 m/s); khi bị vật cản chặn sẽ trở về idle.
- Ba NPC dùng model riêng tương ứng: `Ba_NGhiem` → `npc_ba_nghiem`, `Co_Lam` → `npc_co_lam`, `Ong_Do` → `npc_ong_do`. Giữ tạo hình và texture gốc, cao 1,70 m, pivot giữa chân, hướng glTF −Z; thêm rig và clip `idle`. Các model riêng này thay thế biến thể màu từ `Nhan_Vat` trước đó.
- `Dong_hanh` → `npc_bac`: cao 0,50 m, giữ tỉ lệ, pivot tâm, clip idle lắc nhẹ. Hành vi Bấc hiện có trong game được giữ nguyên.
- `Den_Long` → đèn đặt, đèn nội thất treo, đèn hoàn thiện ở bàn khắc, đèn xưởng/cổng và sáu gian hàng. Các đèn môi trường khớp kích thước và pivot hiện có; đèn đặt cao 0,50 m và giữ tỉ lệ gốc. Khung lắp ráp vẫn dùng model khung hiện có.

Giảm mesh bằng Decimate, giữ UV và PBR texture, atlas 1024 px và JPEG chất lượng 85 cho GLB web; khoảng 5.400 tam giác cho nhân vật chính, 5.900 cho mỗi NPC người, 4.400 cho đồng hành và 2.300 cho đèn. Các `.blend` tương ứng chứa scene nguồn, material, texture đóng gói và rig/clip khi có. GLB giữ tên node và tên clip game đang sử dụng, không cần đổi manifest URL. Sửa hướng mặt trước theo quy ước glTF −Z; renderer xoay cả NPC người và Bấc về hướng người chơi. Đèn có emissive nhẹ màu vàng ấm.

Ngân sách kiểm tra asset được cập nhật cho model thật: đồng hành 4.500, đèn 2.500 tam giác; NPC người vẫn trong 6.000, nhân vật trong 8.000. Kích thước đồng hành và đèn đặt thay thế quy định khối cầu/hộp 0,36 m cũ trong manifest.

Để chỉ dựng lại ba NPC, thêm `-- --npcs-only` sau lệnh Blender `--python` cho từng script adapt, compact và preview. Preview riêng lưu ở `docs/npc_models_preview.png`.

Để chỉ dựng lại nhân vật và locomotion, dùng `-- --player-only` cho script adapt và compact, **sau đó chạy `retarget_quaternius.py`**. Bản production hiện dùng hai clip CC0 từ Quaternius Standard (`Walk_Loop` và `Idle_Loop`), thay thế chu kỳ procedural mô tả ở trên. Retarget bổ sung khớp Pelvis, cân tỉ lệ gối, gắn trọng số phần balô phía sau vào Spine, hiệu chỉnh hướng T-pose của tay và đặt đế giày xuống đất; rig nhân vật hiện có 14 bone. Chi tiết và giấy phép nằm trong `assets_src/vendor/quaternius/README.md`. Cadence dựa trên bước dài 1,3 m của source, co theo tỉ lệ chân nhân vật, tương đương khoảng 0,86 m/s ở tốc độ phát 1.

Camera chơi mặc định 14 m (trước đây 40 m), zoom 9–60 m, góc 40°, focus cao 0,85 m để nhìn vào thân nhân vật. Test playerAnimation kiểm tra crossfade không restart, dữ liệu chân/gối có chuyển động, clip lặp khớp và root không trôi khỏi vị trí.

**Cập nhật đi/chạy:** clip `walk` hiện lấy `Walk_Formal_Loop`, tốc độ đi 2,2 m/s; giữ Shift trái hoặc phải để chạy 5,4 m/s với `Jog_Fwd_Loop` xuất dưới tên `run`. Thả Shift thì giảm tốc và blend về walk; đứng yên giữ Shift không chạy tại chỗ. Mất focus, mở hội thoại hoặc pause sẽ xóa Shift đang giữ. Phần nhấc cả hai chân của Jog được giữ, không ép nhân vật chạm đất trong pha bay.

**Dáng thư thả:** idle hiện là loop thở nhẹ trên pose đứng gốc, chân thẳng, tay buông; thay cho Idle_Loop của donor. Walk giữ động tác chân Formal, giảm chuyển động vai còn 35%, cẳng tay còn 8% theo hướng tay buông, giảm độ nghiêng thân/đầu và bỏ độ gập tay thêm 12° trước đó.

**Cập nhật tay/tay áo:** thay việc giảm chuyển động tay bằng nhịp đánh tay đối xứng theo bước chân: walk ±12°, run ±20°; khuỷu tay walk 4–8°, run 18–26°. Tính lại vùng trọng số cổ tay áo, giữ vải phía sau thân trên Spine và làm mượt chuyển tiếp theo topology/UV seam để tránh vải bị kéo nhọn. `validate_player_sleeves.py` kiểm tra mỗi frame trong GLB đã xuất và lưu số liệu trong `sleeve_validation.json`.

Cập nhật chân và tốc độ: giải IK hai đoạn cho walk/run, cổ chân theo hai làn cách nhau 19 cm, giữ quỹ đạo nâng chân và chỉnh mũi giày hướng tiến. Đi 2,2 m/s, Shift chạy 5,4 m/s; cadence walk lấy mốc 1,3 m/s để giữ nhịp bước vừa phải. Test kiểm tra khoảng cách ngang hai cổ chân nhỏ hơn 23 cm trong toàn clip walk.

Biên độ vung vai tăng lên ±24° khi đi, ±32° khi chạy; khuỷu vẫn thả lỏng như bản trước. Làm mềm trọng số áo 48 lượt để hỗ trợ biên độ lớn; kiểm tra toàn chu kỳ: biên độ 48°/63,7°, p95 giãn cạnh áo 1,032/1,027.
