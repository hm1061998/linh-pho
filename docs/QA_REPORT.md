# Báo cáo QA — màn chơi đầu tiên (Module 10)

Ngày: 2026-10-14. Phạm vi: Q00 → Q01 → Q02, bản dựng production (`npm run build`, chạy bằng `npm run preview`), và bộ kiểm thử tự động.

**Quy tắc của báo cáo này:** mọi con số đo được đều ghi rõ cách đo. Thứ chưa đo thì ghi "chưa đo", không ước lượng. FPS không đo được trong môi trường hiện tại (xem mục 3).

---

## 1. Bản dựng và kích thước (đo thật)

Lệnh: `npm run build` (có `tsc --noEmit` trước khi build).

| Tệp | Kích thước | Gzip |
|---|---|---|
| `dist/index.html` | 0.84 kB | 0.52 kB |
| `dist/assets/index-*.css` | 15.90 kB | 3.34 kB |
| `dist/assets/index-*.js` | 2,449.45 kB | 646.86 kB |

Tải về trong trình duyệt (đo bằng Resource Timing, bản preview cục bộ): script 642,655 byte truyền đi (2,449,451 byte sau giải nén), CSS 3,638 byte truyền đi. Không có tài nguyên nào khác (không font ngoài, không ảnh, không asset GLB khi chơi thường).

- **Mục tiêu ≤ 20 MB ban đầu:** đạt (≈ 0.65 MB gzip cho toàn bộ JS và CSS).
- **Thời điểm tải (bản preview, cục bộ):** DOMContentLoaded 263 ms, load 263 ms. Đây là máy cục bộ, không phản ánh mạng di động.
- **Phần lớn kích thước là PlayCanvas.** Đã tách thành ba file: engine 2.08 MB (535 kB gzip), React 219 kB, và phần game 159 kB. Khi chỉ sửa game, trình duyệt tải lại khoảng 47 kB gzip thay vì 647 kB (D-065). Engine vẫn là một file vì cần khi khởi động, nên chưa tải lười.
- **Cảnh báo của Vite:** ngưỡng đặt 2200 kB để chặn đúng chunk engine. Mọi chunk khác vượt 500 kB vẫn được báo.

## 2. Không có 404 và không có lỗi console (đo thật)

- Mọi tài nguyên của trang đều trả về 200 (Resource Timing).
- Trình duyệt tự xin `/favicon.ico` khi không có icon. Đã thêm icon nội tuyến (data URI) trong `index.html`, nên không còn yêu cầu này. Trước khi sửa, `/favicon.ico` trả về 404.
- Console trên bản production: không có lỗi.

## 3. Hiệu năng

| Chỉ số | Kết quả | Cách đo |
|---|---|---|
| Lệnh vẽ (draw calls), cảnh mở đầu, production | 164 | Bộ đếm của engine, F3 |
| Lệnh vẽ, cảnh mở đầu, dev | 162 | Bộ đếm của engine, F3 |
| Model đã tải, production | 0 / 6 | Đúng: asset `dev.*` không tải trong bản phát hành |
| **FPS, desktop** | **Chưa đo được** | Pane trình duyệt chạy ở khoảng 2–3 khung hình/giây, kể cả với scene trống (D-032). Số này phản ánh môi trường, không phải game. |
| **FPS, di động (mục tiêu 30)** | **Chưa đo** | Không có thiết bị Android. |
| Thời gian khung hình, bộ nhớ, GPU | Chưa đo | Cần đo trên máy thật, Chrome DevTools hoặc Performance panel. |

**Nơi tối ưu đã làm:** hub chỉ là hình khối (không có texture); quality preset giới hạn mật độ điểm ảnh (1.0 / 1.5 / 2.0) và tự động chọn 1.5 trên màn hình cảm ứng; canvas tạm dừng khi tab ẩn; hiệu ứng ánh sáng dùng pool 8 hạt; asset `dev.*` không tải trong bản phát hành.

**Chưa tối ưu:** số lệnh vẽ chưa gộp, chưa có occlusion, chưa có LOD (cần asset thật để có ý nghĩa).

## 4. Kiểm thử tự động

Lệnh: `npm test` (Vitest). Kết quả: 41 tệp, 340 test, tất cả đạt.

| Nhóm | Tệp | Nội dung |
|---|---|---|
| Smoke, cả chương | `smokeCampaign` | Q00 → lưu/tải → Q01 → lưu/tải → Q02 → lưu/tải. Mỗi phần thưởng trả đúng một lần. Lưu/tải nhiều lần không sinh thêm tiền hay đồ. Cờ màn kết thúc giữ sau khi tải. |
| Smoke, HUD (jsdom) | `uiSmoke` | Màn lỗi khởi động (WebGL2, engine, không rõ). Số Xu Đèn và Uy Tín. Nhiệm vụ và tiến độ thu nhặt đổi khi nhặt. Hội thoại mở đúng lời chào. Kho đồ liệt kê đồ và đóng bằng nút. Kho trống. |
| Migration lưu | `saveMigration` | Bước migration chạy đúng và được kiểm tra lại. Thiếu bước thì báo `no_migration`. Bản đã là phiên bản hiện tại không chạy bước nào. Bước làm hỏng tiến trình bị bắt. Bản từ game mới hơn bị từ chối. |
| Kiểm tra lưu | `saveDocument`, `saveRoundTrip`, `localSaveAdapter` | Kiểu từng trường, cài đặt hỏng về mặc định, tải lại giữ đúng trạng thái, IndexedDB và localStorage dự phòng. |
| Giao dịch và trạng thái | `inventory`, `crafting`, `questSystem`, `shopDomain`, `q02` | Giữ chỗ nguyên tử, tiêu một lần, nhiệm vụ đếm nguồn riêng biệt và trả thưởng một lần, mua không bao giờ âm. |
| Sự kiện | `eventBus` | Listener lỗi bị cô lập, không làm dừng các listener khác. |
| Nội dung | `contentValidation`, `gameplayContent`, `shopContent`, `assetManifest`, `localeCoverage` | Nội dung thật không có lỗi. Mục hỏng bị loại có lý do. Khoá locale có đủ cả hai ngôn ngữ. |
| Asset | `assetFormats` | GLB của test đúng cấu trúc, clip thiếu rơi về `idle`. |

**Bộ kiểm tra không tự động (đã làm bằng tay trong trình duyệt):** xem `docs/PROGRESS.md`, mục "Kiểm tra trong trình duyệt" cho các Module 04 đến 09.

## 5. Khả năng truy cập

| Hạng mục | Trạng thái |
|---|---|
| Điều khiển bằng bàn phím | Có: di chuyển, E tương tác, Q đèn, I kho, Esc menu/đóng panel, F3 số liệu. Nút dùng thẻ `button`, nên Tab và Enter hoạt động. |
| Điều khiển bằng chuột và cảm ứng | Có: joystick, nút tương tác, nút Đổi đèn, nút Menu, chạm để chọn rồi chạm ô, kéo thả minigame. |
| Nhãn cho đọc màn hình | Có: `aria-label` cho canvas, `role="dialog"` và `aria-modal` cho panel và menu, `role="status"` cho thông báo, `aria-pressed` cho lựa chọn bật tắt. |
| Không chỉ dựa vào màu | Có: ký hiệu có hình dạng và chữ (Vòng, Sóng, Lửa), dấu đã sáng có ✓, ô trưng bày có chữ "Trống" hoặc tên món. |
| Giảm chuyển động | Có: `prefers-reduced-motion` tắt animation CSS, và cài đặt giảm hiệu ứng tắt hạt. |
| Chữ lớn | Có: cài đặt "Chữ lớn" phóng HUD lên 125%, qua CSS `zoom`. Đã kiểm tra trên bản production. |
| Đổi phím | **Đã làm (D-068).** Đổi trong menu tạm dừng. Đã kiểm tra trong trình duyệt: đổi phím, Esc huỷ, từ chối phím dành riêng, phím còn nguyên sau khi tải lại, đặt lại mặc định. Chưa thử với bàn phím có layout khác. |
| Trình đọc màn hình | **Rà soát, chưa thử với phần mềm thật (D-067).** Đã sửa focus khi mở và đóng panel, menu, màn kết thúc. Tiến độ nhiệm vụ đọc được «đã xong» hoặc «chưa xong». Nút Menu báo trạng thái mở. Khung chế tạo có vai trò nhóm. Chưa chạy NVDA, VoiceOver hay TalkBack. |
| Độ tương phản | **Chưa đo.** Màu chữ và nền chưa qua công cụ đo WCAG. |

## 6. Thiết bị và trình duyệt đã thử

| Thiết bị / trình duyệt | Kết quả |
|---|---|
| Desktop, Chromium (pane trình duyệt trong ứng dụng) | Q00–Q02 chạy qua lời gọi phiên và thao tác UI cho minigame, cửa hàng, menu. Lưu và tải lại được kiểm tra giữa các chặng. Bản production: mở đầu, menu, chữ lớn, không 404. FPS không đo được. Chưa đi bộ tới các điểm tương tác. |
| Android (điện thoại tầm trung) | **Chưa thử.** Không có thiết bị. |
| iOS / Safari | **Chưa thử.** |
| Firefox | **Chưa thử.** Lưu dùng IndexedDB, chữ lớn dùng CSS `zoom`. Cần kiểm tra `zoom` trên Firefox, vì chưa xác minh phiên bản hỗ trợ. |
| Chế độ riêng tư | **Chưa thử.** Lưu có thể rơi về localStorage hoặc không lưu. Đã có test giả lập cho trường hợp này. |

## 7. Giới hạn

1. **Không có FPS thật.** Mục tiêu 60 (desktop) và 30 (di động) chưa được xác nhận. Đây là lỗ hổng lớn nhất của báo cáo.
2. **Không có thiết bị di động.** Mọi thứ về cảm ứng mới được kiểm tra trên chuột, bằng click giả lập và kéo giả lập.
3. **Âm thanh chưa được nghe.** Trình duyệt tự động không phát được âm để kiểm tra.
4. **Chưa có model thật.** Hiệu năng và tải asset thật chưa đo được. Xem `docs/ASSET_MANIFEST.md`.
5. **Lưu nhiều tab.** Đã có khoá bằng Web Locks (D-066). Tab thứ hai hiện thông báo và chờ, rồi vào khi tab đầu đóng. Trình duyệt không có Web Locks thì không khoá.
6. **Trình đọc màn hình chưa thử với phần mềm thật.** Đổi phím đã làm (D-068).

## 8. Việc cần làm trước khi gọi là "có thể chơi thử"

- Đo FPS và thời gian khung hình trên Chrome desktop, và trên ít nhất một điện thoại Android tầm trung.
- Thử toàn bộ Q00–Q02 trên điện thoại (cảm ứng, xoay ngang, minigame kéo thả).
- Thử trên Firefox và Safari.
- Đo lại FPS với model GLB trên máy thật. Bước thay hình khối bằng GLB đã xong: có 83 model trong `public/assets`.

## 9. Lượt chơi Q00 → Q02 (T1, bản dev trên trình duyệt)

Cách làm: bắt đầu lại từ Q00 (Menu → Bắt đầu lại). Phím E, Q, Enter, nút trong panel và minigame là thao tác thật. Vị trí nhân vật đặt bằng hook dev (`window.__linhPho.game.player.position`) vì đi bộ tới từng vật mất quá nhiều bước; vì vậy lượt này không kiểm lại va chạm khi đi (xem đi bộ thử bên dưới).

| Chặng | Việc đã làm | Kết quả kiểm tra |
|---|---|---|
| Q00 | Nói Bà Nghiêm; nhặt 2 tre, 1 giấy dó, 1 dây gai; chế Đèn Mộc ở bàn nghề; đặt lên bệ trước tiệm | `q00_complete`, `shop_lamp_lit`; +30 xu; tiệm cấp 1 |
| Q01 | Nói Cô Lam; bật Đèn Soi Linh (Q); quét ba glyph; giải thứ tự «Sóng → Vòng → Lửa» ở bàn khắc; chế Đèn Vân Linh | `q01_complete`; uy tín 10 |
| Q02 | Nhận hai đơn; giao đơn giấy dó và dây gai; chế Đèn Mộc thứ ba và giao; mua Kệ Đèn; đặt vào ô trưng bày 1 | `q02_complete`, `mvp_complete`; tiệm cấp 2; màn «Tiệm đã sáng» hiện |

Điểm ghi nhận:

- **Công thức Đèn Mộc lệch số ổ (đã sửa, D-073).** Khung trước đó có ba ổ nhưng công thức chỉ trừ hai tre, nên thanh thứ ba được lắp mà không tốn nguyên liệu. Nay khung có hai ổ, khớp hai tre của công thức.
- **Thẻ «Chuyện Đằng Sau» chặn input.** Thẻ mở tự động sau mỗi nhiệm vụ (Q00 mở hai thẻ nối nhau) và chặn phím cho tới khi đóng. Đây là thiết kế đúng theo GDD B6.
- **Phím E đôi khi bị bỏ qua: đã điều tra 14/10, không thấy lỗi trong code.** Nhấn E được xếp vào hàng đợi (`InputService.interactQueued`) và xử lý ở khung hình kế tiếp. Trong pane, engine chỉ chạy khung hình khi có thao tác (chụp màn hình, phím). Đã xác nhận: đặt người chơi cạnh Bà Nghiêm rồi nhấn E thì hàng đợi vẫn `true` và khung hình đứng yên; chụp màn hình thì khung hình chạy, hàng đợi được xử lý và hội thoại mở. Trong code, phím chỉ mất khi cửa sổ mất focus hoặc khi một blocker mới được bật trước khung hình kế tiếp (`resetTransientInput`). Từ D-074, lần nhấn chờ quá 250 ms bị bỏ, nên không còn kích hoạt muộn. Trên máy có khung hình liên tục, độ trễ dưới một khung hình (chưa đo trên máy thật).
- Ảnh chụp từng chặng nằm trong phiên làm việc, không lưu vào repo.
- **Đi bộ thử (14/10).** Người chơi đi tới 29 mục tương tác: 4 NPC, 18 vật nhặt, 2 trạm, 1 bệ đặt, quầy tiệm và 3 glyph (bật Đèn Soi Linh để chúng hiện). Tới được 29/29. Hai mục cần qua cầu (Ông Độ và glyph cầu) đều tới được, vì sông chặn mọi chỗ ngoài cầu (x khoảng 6.9 đến 9.1). Một điểm kẹt khi đi thẳng (quanh (-19.5, 6.65), gần glyph bảng hiệu) thoát được bằng đi vòng. Phương pháp: phím là sự kiện `KeyboardEvent` gửi vào `window`, khung hình gọi bằng tay (`app.tick`) với dt 1/30 s. Hiệu chỉnh: giữ phím 1 s đi khoảng 3.9 m theo cả bốn hướng, vận tốc đạt 4.2 m/s. Chưa kiểm bằng phím vật lý và chưa kiểm xuyên vật bằng mắt.
- **Tầm tương tác chồng nhau.** Khi hai mục cùng nằm trong tầm 2 m, focus lấy mục gần nhất. Đứng gần Cô Lam có thể focus là giấy dó bên cạnh (`pk_paper_4`), nên E nhặt giấy thay vì nói chuyện. Đây là thiết kế hiện tại; nên xem lại khi playtest.

Kết luận: luồng Q00 → Q02 đi hết và các cờ hoàn thành đều bật. Lỗi số tre đã sửa ở D-073 và được kiểm lại trong trình duyệt.
