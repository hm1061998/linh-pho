# Ghi chú riêng tư (bản nháp)

**Đây không phải chính sách bảo mật pháp lý.** Trước khi phát hành, người phụ trách cần viết và duyệt bản chính thức. Tài liệu này chỉ ghi lại trạng thái hiện tại của code, để người duyệt biết cần kiểm tra điều gì.

Cập nhật: 2026-10-14, theo bản code `67ad06c` trở về sau.

## Game lưu gì

| Dữ liệu | Lưu ở đâu | Ai đọc được |
|---|---|---|
| Tiến trình chơi: xu, uy tín, cờ, kho đồ, nhiệm vụ, đơn hàng, cửa hàng | IndexedDB của trình duyệt trên thiết bị. Dự phòng: localStorage. | Chỉ trình duyệt trên thiết bị đó. |
| Cài đặt: ngôn ngữ, giảm hiệu ứng, âm thanh, chữ lớn, chất lượng | Cùng nơi với tiến trình. | Như trên. |
| Bản sao lưu của lưu bị hỏng | Khoá riêng trong cùng kho. | Như trên. |

Game **không** lưu: tên người chơi, email, định danh thiết bị, vị trí, ảnh, micro, camera.

## Game gửi gì ra ngoài

- **Không có máy chủ.** Game không gửi tiến trình, cài đặt, hay sự kiện đi đâu.
- **Không có SDK bên thứ ba.** Không có quảng cáo, không có đo lường từ bên ngoài.
- **Analytics là cổng rỗng.** `src/ports/AnalyticsPort.ts` định nghĩa sự kiện, nhưng bản cài sẵn không làm gì (`NO_ANALYTICS`). Nếu thêm bản thật, phải cập nhật tài liệu này, và cần xin đồng ý của người chơi ở khu vực yêu cầu.
- **Tài nguyên.** Trang tải mã và CSS từ cùng nguồn. Model GLB, nếu có, cũng chỉ từ `/assets/` cùng nguồn (`validateAssets`).

## Quyền của thiết bị

Game không hỏi quyền vị trí, camera, micro, hay thông báo. Âm thanh được tạo bằng Web Audio, không cần quyền.

## Xoá dữ liệu

- Trong game: menu tạm dừng → "Bắt đầu lại" (có xác nhận) xoá tiến trình.
- Trong trình duyệt: xoá dữ liệu của trang (site data) xoá cả tiến trình lẫn cài đặt.

## Việc còn lại trước khi phát hành

- [ ] Người phụ trách viết chính thức chính sách bảo mật, và duyệt tài liệu này.
- [ ] Nếu có analytics thật: cập nhật mục "Game gửi gì ra ngoài" và thêm cơ chế đồng ý.
- [ ] Nếu có tài khoản hoặc đồng bộ đám mây: viết lại toàn bộ tài liệu này.
