# Season 1 — Đêm Khai Phố

Mở ngày 14/10/2026. Nguồn: `LINH_PHO_GDD_v1.md` mục J (Season 1), B5 và C3. Vertical slice Q00–Q02 đã xong theo [COMPLETION.md](COMPLETION.md), nên phase này bắt đầu từ đó.

## Điểm xuất phát

- 3 quest (Q00, Q01, Q02), 2 công thức, 8 vật phẩm, 6 đơn hàng, 4 NPC, 6 thẻ «Chuyện Đằng Sau».
- 2 mini-game: lắp khung (B5.1) và khắc (B5.2).
- Cấp tiệm dừng ở L2 (Q02 đặt). Chưa có cấp L3 hay «Góc Ký Ức».
- Chưa có «Mảnh Ký Ức» (tiền cốt truyện, GDD B4).

## Phạm vi

**Trong phase:**
- 8 quest sau Q02, đánh số Q03 đến Q10.
- 2 mini-game mới (GDD J ghi «2 mini-games mới», chưa nói là game nào).
- Vẫn trong một hub, không thêm khu mới.
- Nội dung đi qua dữ liệu JSON khi có thể. Chỉ thêm code khi cần loại mục tiêu hoặc mini-game mới.

**Ngoài phase:**
- Season 2 đến Season 4 (GDD J).
- Chương 2 và cấp L3 «Góc Ký Ức» (GDD B4 ghi là sau MVP).
- Kỹ năng post-MVP (GDD B4).
- Ngôn ngữ ngoài Việt và Anh, thanh toán, tài khoản.

## Định nghĩa hoàn thành

Phase xong khi:

1. Có thể đi từ Q00 đến Q10 trong một lượt. Mỗi quest mới có test đầu cuối trong Node, như `q01.test.ts`, và `smokeCampaign` được mở rộng tới Q10.
2. Hai mini-game chạy được, có test domain, và trạng thái của chúng đi qua save (`saveRoundTrip`).
3. Nội dung mới không có lỗi từ các validator (`contentValidation`, `gameplayContent`). Mọi chuỗi có khoá ở cả `vi.json` và `en.json` (`localeCoverage`).
4. Save của bản hiện tại vẫn tải được. Trường mới có test migration (`saveMigration`).
5. Mỗi thẻ «Chuyện Đằng Sau» mới có trạng thái đúng: sự kiện có thật chỉ là `verified` khi có nguồn đã đọc (D-058). Không bịa nguồn.
6. Typecheck, test và build đạt. Một lượt Q00 → Q10 trong trình duyệt có ảnh chụp từng chặng. [COMPLETION.md](COMPLETION.md) có mục riêng cho Season 1.

Không nằm trong định nghĩa: playtest, thiết bị thật, trình đọc màn hình thật (như COMPLETION.md).

## Module

Mỗi module là một commit trên `dev`, cập nhật [PROGRESS.md](PROGRESS.md) và có bằng chứng kiểm thử.

| Module | Việc | Chặn bởi |
|---|---|---|
| S1-M0 | Mở phase (tài liệu này) | — |
| S1-M1 | Chốt bốn quyết định nội dung bên dưới | Chủ dự án |
| S1-M2 | Đề cương 8 quest: người giao, mục tiêu, thưởng, mở khoá. Duyệt trước khi viết dữ liệu | S1-M1 |
| S1-M3 | Dữ liệu Q03–Q05: quest, thoại, công thức, điểm nhặt, trạm, đơn, cùng test | S1-M2 |
| S1-M4 | Q06–Q07 và mini-game 1 (domain, giao diện, test) | S1-M2 và quyết định mini-game |
| S1-M5 | Q08–Q10 và mini-game 2 | S1-M4 |
| S1-M6 | Save và migration, `smokeCampaign` tới Q10, kiểm tra locale | S1-M5 |
| S1-M7 | Lượt chơi trong trình duyệt có ảnh chụp, mục Season 1 trong COMPLETION.md | S1-M6 |

Mục mini-game: giữ mẫu của B5. Phần logic nằm trong `domain/minigame`, phần hiển thị 3D là một `CraftStage` đọc snapshot, và input là HTML (D-071).

## Quyết định cần chủ dự án

Chưa có quyết định nào trong bốn mục này thì không viết được S1-M2.

1. **Season 1 dừng ở cấp tiệm nào?** Khuyến nghị: L2. L3 «Góc Ký Ức» mở chương 2, mà GDD xếp sau MVP.
2. **Hai mini-game mới là gì?** GDD đã có Nhuộm Giấy (B5.3, post-MVP, «phối màu/sắp họa tiết»). Chưa có ứng viên thứ hai.
3. **Ai viết nội dung quest và thoại?** Khuyến nghị: chủ dự án viết đề cương và duyệt; tôi làm dữ liệu, code và test.
4. **«Mảnh Ký Ức» có trong Season 1 không?** Khuyến nghị: chưa. Thêm tiền mới kéo theo UI, save và cách kiếm, nên để sau khi đã có nội dung.
