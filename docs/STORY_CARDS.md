# Thẻ câu chuyện

Mỗi câu có thật hoặc hư cấu xuất hiện trong game có một thẻ trong `src/content/story_cards.json`. Thẻ ghi câu, loại, trạng thái, nơi câu xuất hiện trong game, và nguồn. Quy tắc được kiểm tra bởi `validateStoryCards`:

- **`verified`** chỉ dùng cho hư cấu đã được tài liệu thiết kế xác nhận, hoặc cho sự kiện có thật đã có ít nhất một nguồn được đọc toàn văn.
- **`needs_review`** là mọi thứ khác. Một sự kiện có thật thiếu nguồn bị từ chối nếu ghi là `verified`.
- **`usedIn`** chỉ nhận khoá locale có thật. Thẻ trỏ tới khoá không tồn tại bị loại.

## Trạng thái hiện tại

| Thẻ | Loại | Trạng thái | Dùng ở đâu | Việc còn lại |
|---|---|---|---|---|
| Giấy dó là giấy thủ công làm từ vỏ cây dó | sự kiện có thật | verified | `item.paper.name` | Không. Đã đọc bài Tạp chí Công Thương, ngày 14/10/2026. Bài không nêu tên khoa học, nên game không ghi tên loài. |
| Thu hoạch vỏ dó khoảng tháng 8–10 âm lịch | sự kiện có thật | needs_review | chưa dùng | Chưa có nguồn đã đọc nêu tháng. Bài Công Thương về xứ Mường nói cây dướng, không nói tháng. File VNPT (.doc) hỏng, không đọc được. Cần nguồn khác, hoặc bản VNPT đọc được. |
| Làng Bưởi làm giấy dó từ đầu thế kỷ XV | sự kiện có thật | verified | chưa dùng | Không. Đã đọc bài Vietcetera, ngày 14/10/2026. Mục đích viết và in tranh bị bỏ, vì bài nói về giấy dó nói chung. |
| Chợ đêm là nơi hư cấu | hư cấu | verified | `dlg.ba_nghiem.market` | Không cần nguồn ngoài. Căn cứ: GDD v1, mục C1. |
| Đèn Soi Linh và Bấc là hư cấu | hư cấu | verified | `item.spirit_lantern.name`, `dlg.bac.greet` | Không cần nguồn ngoài. Căn cứ: GDD v1. |
| Chương 2 mở ngõ Giấy | hư cấu | needs_review | `end.teaser` | Biên tập, và viết nội dung chương 2 thật. |

## Ghi chú về nguồn

Các nguồn được đọc qua công cụ tải trang (WebFetch) ngày 14/10/2026. Công cụ trả về phần trích xuất của trang, không phải bản sao từng ký tự. Các câu được dẫn trong ghi chú của thẻ là trích xuất đó. **Người phụ trách nên mở lại từng nguồn và kiểm tra câu được dẫn trước khi phát hành.**

- VNPT, "141. Giấy dó" (file .doc): **không đọc được.** Nội dung bị lỗi mã hoá. Công cụ chỉ lấy được vài đoạn rời, có tên hai loài khác nhau. Không dùng để xác nhận gì.
- Tạp chí Công Thương, "Giấy dó, giấy sắc phong trong lịch sử văn hóa dân tộc": **đã đọc.** Xác nhận giấy dó làm từ vỏ cây dó. Không nêu thời vụ.
- Tạp chí Công Thương, "Giữ nghề giấy dó xứ Mường": **đã đọc.** Nói về cây dướng và cách làm. Không nêu tháng thu hoạch.
- Vietcetera, "Zó Project: Lưu giữ nét đẹp giấy dó Việt": **đã đọc.** Nói làng Bưởi làm giấy từ đầu thế kỷ XV.

Các nguồn không thống nhất về loài cây (dó và dướng), thời vụ và mốc lịch sử. Thẻ nào chưa có nguồn đã đọc xác nhận vẫn là `needs_review`.

## Cách chuyển `needs_review` thành `verified`

1. Đọc toàn văn ít nhất một nguồn, và ghi tên người đọc và ngày trong trường `note`.
2. Nếu nguồn nói khác đi, sửa câu cho khớp nguồn, không giữ câu gốc.
3. Đổi `status` thành `verified`. Validator sẽ kiểm tra có nguồn hay không.
4. Chạy `npm test`. Thẻ không hợp lệ sẽ bị báo.
