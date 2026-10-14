# Nguồn và giấy phép asset bên thứ ba

Mỗi asset có nguồn gốc từ bên ngoài (model, texture, animation, âm thanh, font) phải có một dòng ở đây trước khi được commit. Ghi đủ bốn mục: URL, giấy phép, ngày tải, và phạm vi được phép dùng (thương mại, phái sinh, tái phân phối).

Asset tự làm bằng Blender thì ghi "tự làm" ở cột nguồn. Không có dòng nào bên dưới nghĩa là hiện chưa có asset bên thứ ba nào trong repo.

| Asset | Loại | Nguồn (URL) | Giấy phép | Ngày tải | Phạm vi dùng | Ghi chú |
|---|---|---|---|---|---|---|
| Nhan_Vat.glb, Dong_hanh.glb, Den_Long.glb | Model và texture | Người dùng cung cấp trong docs/ | Chưa được cung cấp | 2026-10-14 | Chưa được cung cấp | Bản chỉnh sửa Blender và cách dựng lại: SUPPLIED_MODELS.md |
| Ba_NGhiem.glb, Co_Lam.glb, Ong_Do.glb | Model và texture | Người dùng cung cấp trong docs/ | Chưa được cung cấp | 2026-10-14 | Chưa được cung cấp | Thay model riêng cho ba NPC tương ứng; chuẩn hóa và thêm idle bằng Blender |
| Quaternius Universal Animation Library Standard | Animation | https://quaternius.itch.io/universal-animation-library | CC0 1.0 Universal | 2026-10-14 | Cá nhân, thương mại, sửa đổi và tái phân phối | Tải miễn phí qua itch.io; UAL1_Standard.glb không root motion; Walk_Formal_Loop, Idle_Loop và Jog_Fwd_Loop được retarget vào player_hero bằng assets_src/retarget_quaternius.py. License.txt giữ trong assets_src/vendor/quaternius/standard/ |

Quy tắc: không chép scene hay nhân vật từ ảnh trên internet. Ảnh chỉ dùng làm tham chiếu tâm trạng. Âm thanh tổng hợp trong game (`src/shared/audio/sfx.ts`) là mã của dự án, không thuộc mục này.
