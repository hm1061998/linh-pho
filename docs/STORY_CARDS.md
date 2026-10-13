# Thẻ câu chuyện

Mỗi câu có thật hoặc hư cấu xuất hiện trong game có một thẻ trong `src/content/story_cards.json`. Thẻ ghi câu, loại, trạng thái, nơi câu xuất hiện trong game, và nguồn. Quy tắc được kiểm tra bởi `validateStoryCards`:

- **`verified`** chỉ dùng cho hư cấu đã được tài liệu thiết kế xác nhận, hoặc cho sự kiện có thật đã có ít nhất một nguồn được đọc toàn văn.
- **`needs_review`** là mọi thứ khác. Một sự kiện có thật thiếu nguồn bị từ chối nếu ghi là `verified`.
- **`usedIn`** chỉ nhận khoá locale có thật. Thẻ trỏ tới khoá không tồn tại bị loại.

## Trạng thái hiện tại

| Thẻ | Loại | Trạng thái | Dùng ở đâu | Việc còn lại |
|---|---|---|---|---|
| Giấy dó là giấy thủ công làm từ xơ vỏ cây dó | sự kiện có thật | needs_review | `item.paper.name` | Đọc toàn văn hai nguồn. Tên loài cây không thống nhất (dó và dướng), nên không ghi tên khoa học. |
| Thu hoạch vỏ dó khoảng tháng 8–10 âm lịch | sự kiện có thật | needs_review | chưa dùng | Đọc toàn văn nguồn. |
| Làng Bưởi làm giấy dó | sự kiện có thật | needs_review | chưa dùng | Các nguồn ghi mốc thời gian khác nhau. Chọn một nguồn gốc và ghi rõ. |
| Chợ đêm là nơi hư cấu | hư cấu | verified | `dlg.ba_nghiem.market` | Không cần nguồn ngoài. Căn cứ: GDD v1, mục C1. |
| Đèn Soi Linh và Bấc là hư cấu | hư cấu | verified | `item.spirit_lantern.name`, `dlg.bac.greet` | Không cần nguồn ngoài. Căn cứ: GDD v1. |
| Chương 2 mở ngõ Giấy | hư cấu | needs_review | `end.teaser` | Biên tập, và viết nội dung chương 2 thật. |

## Ghi chú về nguồn

Các nguồn dưới đây được tìm bằng tìm kiếm web, và chỉ đọc được phần tóm tắt, chưa đọc toàn văn:

- VNPT, "141. Giấy dó" (tài liệu tóm tắt).
- Tạp chí Công Thương, "Giấy dó, giấy sắc phong trong lịch sử văn hóa dân tộc".
- Tạp chí Công Thương, "Giữ nghề giấy dó xứ Mường".
- Vietcetera, "Zó Project: Lưu giữ nét đẹp giấy dó Việt".

Tóm tắt của các nguồn đồng ý ở điểm cốt lõi (giấy dó từ vỏ cây dó), nhưng không đồng ý về chi tiết (loài, thời vụ, thời gian ngâm vôi, mốc lịch sử). Vì vậy mọi sự kiện có thật vẫn là `needs_review` cho đến khi có người đọc toàn văn.

## Cách chuyển `needs_review` thành `verified`

1. Đọc toàn văn ít nhất một nguồn, và ghi tên người đọc và ngày trong trường `note`.
2. Nếu nguồn nói khác đi, sửa câu cho khớp nguồn, không giữ câu gốc.
3. Đổi `status` thành `verified`. Validator sẽ kiểm tra có nguồn hay không.
4. Chạy `npm test`. Thẻ không hợp lệ sẽ bị báo.
