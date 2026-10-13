# Nguồn và giấy phép asset bên thứ ba

Mỗi asset có nguồn gốc từ bên ngoài (model, texture, animation, âm thanh, font) phải có một dòng ở đây trước khi được commit. Ghi đủ bốn mục: URL, giấy phép, ngày tải, và phạm vi được phép dùng (thương mại, phái sinh, tái phân phối).

Asset tự làm bằng Blender thì ghi "tự làm" ở cột nguồn. Không có dòng nào bên dưới nghĩa là hiện chưa có asset bên thứ ba nào trong repo.

| Asset | Loại | Nguồn (URL) | Giấy phép | Ngày tải | Phạm vi dùng | Ghi chú |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | Chưa có |

Quy tắc: không chép scene hay nhân vật từ ảnh trên internet. Ảnh chỉ dùng làm tham chiếu tâm trạng. Âm thanh tổng hợp trong game (`src/shared/audio/sfx.ts`) là mã của dự án, không thuộc mục này.
