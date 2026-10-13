# Hoàn chỉnh: định nghĩa, danh sách, và những gì nằm ngoài môi trường

Tài liệu này là thước đo cho câu «hoàn thiện đồ hoạ và gameplay». Nguồn gốc: `LINH_PHO_GDD_v1.md` mục B5 (chế tạo 3D), C3 (nhiệm vụ), E2 (ngân sách asset), F (UX), H (MVP scope lock), và `docs/ASSET_MANIFEST.md`.

## Định nghĩa

Game được coi là hoàn chỉnh khi:

1. Mọi dòng trong «MVP scope lock» (GDD H) được làm.
2. Hai chế tác B5.1 và B5.2 chạy trong không gian 3D, không chỉ là HTML.
3. Mọi vật nhìn thấy được trong MVP có model, không còn hộp placeholder. Ngoại lệ: mặt đất và mặt nước là diorama, được ghi rõ.
4. Một lần chơi từ đầu đến hết Q00–Q02 được kiểm chứng trong trình duyệt, kèm ảnh chụp.
5. Typecheck, toàn bộ test, và build production đều đạt.

Không nằm trong định nghĩa (cần thiết bị hoặc người khác, môi trường này không làm được): FPS đo trên máy thật, Android và iOS, Firefox và Safari, trình đọc màn hình thật, duyệt pháp lý chính sách riêng tư, playtest 10–20 người.

## Gameplay

| Mã | Mục | Nguồn | Trạng thái |
|---|---|---|---|
| G1 | Đủ 6 đơn hàng để tái chơi | GDD C3 | xong: 4 đơn thêm, mở lần lượt sau chương đầu (`replayOrders.test.ts`) |
| G2 | Lắp Khung Đèn 3D: khung 3D tại bàn nghề, thanh tre cắm vào 3 ổ, hiệu ứng nam châm, tiếng tách, xoay vật thể | GDD B5.1 | chưa (hiện là HTML) |
| G3 | Vẽ Nét Sáng 3D: đường sáng chạy quanh đèn 3D theo thứ tự chạm | GDD B5.2 | chưa (hiện là HTML) |
| G4 | «Chuyện Đằng Sau»: thẻ đọc được sau nhiệm vụ, tách Sự thật văn hoá và Hư cấu, người chơi tự chọn đọc | GDD B6 | xong (D-070). Còn: biên tập để đủ 50–100 từ mỗi thẻ |
| G5 | Nhật ký (phím J): nhiệm vụ đang làm và thẻ đã đọc | GDD B2 | xong (D-070) |
| G6 | Roof fade: mái che nhân vật được làm mờ | GDD B2, E1 | chưa |

## Đồ hoạ

| Mã | Mục | Nguồn | Trạng thái |
|---|---|---|---|
| V1 | Nhân vật người chơi: model, Idle và Walk | GDD E2, Art bible §5 | chưa (đang là capsule) |
| V2 | Pickup cho 6 loại vật liệu: tre, giấy dó, mực, màu lam, dây gai, gỗ vụn | GDD B4 | chưa (đang là hộp) |
| V3 | Bàn nghề, bàn khắc, điểm trạm | GDD E2 | chưa (đang là hộp) |
| V4 | Chân đèn trước tiệm và vật đặt lên đó | GDD C3 Q00 | chưa |
| V5 | Đèn Mộc và Đèn Vân Linh (2 mẫu craftable) | GDD E2 | chưa |
| V6 | Ba glyph Đèn Soi Linh | GDD B3 | chưa (đang là đĩa) |
| V7 | Modular kit còn thiếu: nền gạch quảng trường, bờ sông 2 đoạn, xe hàng, 2 chậu | GDD E3 mục 7 | chưa |
| V8 | Cảnh từ camera mặc định: NPC đọc được rõ hơn nền | GDD E3 «visual acceptance» | chưa kiểm |

## Kiểm chứng

| Mã | Mục | Trạng thái |
|---|---|---|
| T1 | Một lượt Q00 → Q02 trong trình duyệt, có ảnh chụp mỗi chặng | chưa |
| T2 | Typecheck, test, build production | liên tục |

## Ghi chú tiến độ

Cập nhật khi xong mỗi mục: đổi «chưa» thành «xong» kèm commit, và ghi cách kiểm chứng.
