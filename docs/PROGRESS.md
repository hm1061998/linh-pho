# Tiến độ — Linh Phố

Cập nhật: 2026-10-14. Theo quy trình Prompt 00 (A–F), mỗi module chạy riêng, có bằng chứng và một commit. Trạng thái so với định nghĩa «hoàn chỉnh» nằm trong [COMPLETION.md](COMPLETION.md). File này ghi lịch sử theo module; các mục «Chưa kiểm chứng», «Vấn đề đã biết» và «Việc tiếp theo» đã đồng bộ tới 14/10.

## Lịch sử commit

| Commit | Nội dung |
|---|---|
| `299ea45` | `docs(module-00)`: bộ tài liệu thiết kế |
| `5aa6d3f` | `feat(module-01)`: bootstrap PlayCanvas và blockout hub |
| `111df20` | `chore`: `.gitattributes` (LF, file nhị phân) |
| `9aeb7ff` | `feat(module-02)`: nhân vật, camera, input, va chạm |
| `35ca79b` | `feat(module-03)`: tương tác, hội thoại, 4 NPC placeholder |
| `033e3f0` | `feat(hud)`: chặn bôi đen và yêu cầu xoay ngang trên điện thoại |
| `cb90832` | `feat(module-04)`: kho đồ, công thức, nhiệm vụ, Q00 đầy đủ |
| `47bde1a` | `feat(module-05)`: Đèn Soi Linh, ký hiệu, puzzle thứ tự, Q01 |
| `6c5d40a` | `feat(module-06)`: minigame lắp khung và khắc, chất lượng Thường/Đẹp/Hoàn Mỹ |
| `73ee660` | `feat(module-07)`: cửa hàng, ba ô trưng bày, đơn hàng, Q02, màn hình kết thúc |
| `b52fb0e` | `feat(module-08)`: lưu và tải, tự lưu, khôi phục, cài đặt, menu tạm dừng, âm thanh |
| `4d9a078` | `feat(module-09)`: manifest tài sản, bộ nạp GLB có dự phòng, test GLB, preset chất lượng, F3/F4 |
| `67ad06c` | `feat(module-10)`: báo cáo QA, smoke test chương và HUD, migration, chữ lớn, icon nội tuyến |
| `bf28497` | `feat(module-11)`: cổng analytics và nền tảng, tài liệu riêng tư, checklist phát hành, ghi chú PWA |
| `f7912cf` | `feat(module-12)`: thẻ câu chuyện có nguồn, kiểm tra thẻ |
| `0625cdd` → `a5c41ad` | Sau Module 12: model 3D cho thế giới và nhân vật, chế tác 3D, «Chuyện Đằng Sau» và nhật ký, khung đèn hai ổ (D-069 đến D-073). Chi tiết ở mục «Sau Module 12» dưới đây |

## Đã hoàn thành

### Module 00 — Quy tắc và cấu trúc repo
- Repo theo layout GDD G3: `src/app`, `src/engine`, `src/ui`, `src/shared`, `src/tests`, `docs`, cùng `src/content` và `src/domain`.
- Thư mục `ports/`, `adapters/` chưa tạo vì chưa có code dùng đến.
- Tài liệu thiết kế (`LINH_PHO_*.md`) vẫn ở thư mục gốc `linh-pho/`.

### Module 01 — Bootstrap và cảnh 3D
- Vite + React 19 + TypeScript strict. PlayCanvas Engine 2.23.2 qua npm, chỉ WebGL2.
- Canvas nằm dưới HUD React trong suốt. React không render 3D.
- Resize theo container, DPR tối đa 2, tạm dừng khi ẩn tab, dispose đầy đủ khi unmount và HMR.
- Blockout 60×60 m bằng primitive: quảng trường, sông, cầu, nhà tiệm, xưởng, cổng, 4 quầy, đèn lớn, đèn góc, bụi cây.

### Module 02 — Nhân vật, camera, input, va chạm
- **Input (`engine/input/`):** `InputService` đọc bàn phím, kéo chuột/cảm ứng, wheel, pinch. Blocker khoá gameplay. Xoá trạng thái khi mất focus.
- **Nhân vật, camera, va chạm:** capsule có làm mượt, camera 45° có kéo xoay và zoom 30–90 m, va chạm tròn–hộp chống xuyên vật mỏng. Sông tách để cầu là lối duy nhất qua.
- **Điều khiển cảm ứng:** joystick và nút tương tác, chỉ hiện với `(pointer: coarse)`.

### Module 03 — Tương tác, hội thoại, NPC placeholder
- **Event bus có kiểu** (`shared/events/EventBus.ts`): listener lỗi bị ghi log và bỏ qua.
- **Tương tác** (`engine/interaction/InteractionSystem.ts`): mục tiêu có ID ổn định, tầm 2 m (XZ), một mục tiêu được focus (gần nhất).
- **Hội thoại** (`domain/dialogue/DialogueSystem.ts`): mục vào có điều kiện, nút có lựa chọn và hiệu ứng (`setFlag`). Mọi lỗi phát `dialogue.error`, không ném ra ngoài.
- **Nội dung JSON** (`src/content/`) và bộ kiểm tra (`domain/content/validate.ts`): nội dung sai bị loại có báo lỗi, game vẫn chạy.
- **NPC:** Bà Nghiêm, Cô Lam, Ông Độ (capsule có va chạm), Bấc (quả cầu phát sáng, lơ lửng, không chặn).

### Thay đổi HUD: chặn bôi đen và yêu cầu xoay ngang trên điện thoại
- Toàn bộ UI có `user-select: none`. Ô nhập liệu vẫn chọn được chữ (D-025).
- Điện thoại cầm dọc (`pointer: coarse` và `orientation: portrait`) thấy màn hình "Xoay ngang thiết bị để chơi", chặn chạm và khoá gameplay (D-024).

### Module 04 — Kho đồ, công thức, nhiệm vụ, Q00
- **Nội dung (`src/content/`):** `items.json` (8 vật phẩm), `recipes.json` (2 công thức), `quests.json` (Q00), `world.json` (14 vật nhặt được, 2 trạm, 1 điểm đặt đèn). Mọi chuỗi là khoá locale, có bản tiếng Anh.
- **Domain:**
  - `Inventory`: xếp chồng theo chất lượng, giữ chỗ (`reserve`/`commit`/`release`) nguyên tử (D-027).
  - `CraftingSystem`: một lần chế tạo tại một thời điểm, giữ nguyên liệu khi bắt đầu, tiêu một lần khi xong, trả lại khi huỷ.
  - `QuestSystem`: mục tiêu đếm nguồn riêng biệt, thưởng đúng một lần, tự kích hoạt nhiệm vụ kế tiếp (D-028).
  - `GameSession` (`domain/GameSession.ts`): nối cờ, ví, kho, chế tạo, nhiệm vụ, hội thoại, điểm đặt. Không phụ thuộc engine (D-029).
  - `validateGameplay.ts`: kiểm tra vật phẩm, công thức, nhiệm vụ và tham chiếu chéo. Mục sai bị loại có báo lỗi.
- **Engine:** `WorldView` vẽ vật nhặt được (model theo vật phẩm, hộp theo màu khi model chưa nạp), trạm (vạch sáng dưới đất), điểm đặt (bệ đèn, đầu đèn sáng khi đã đặt). `GameApp` định tuyến tương tác theo loại (`npc`, `pickup`, `station`, `placement`) (D-030).
- **HUD:** thanh tiền và uy tín (góc trên phải), bảng nhiệm vụ hiện tại (góc trên trái), thông báo ngắn, panel bàn nghề (xác nhận tạm thời, D-031), kho đồ (phím I).
- **Q00 đầy đủ:** nói chuyện với Bà Nghiêm → nhặt 2 tre, 1 giấy dó, 1 dây gai → chế tạo Đèn Mộc ở bàn nghề → đặt lên chân đèn trước tiệm → nhận 30 Xu Đèn đúng một lần, đặt cờ `q00_complete` và `shop_lamp_lit`, cấp shop level 1.
### Module 05 — Đèn Soi Linh, ký hiệu, puzzle thứ tự, Q01
- **Đèn Soi Linh (`domain/lantern/LanternPhase.ts`):** hai trạng thái REAL và SPIRIT, chuyển tiếp 0.35 s, nhấn Q trong lúc chuyển tiếp chỉ xếp hàng một lần (D-033). Phím Q và nút trên cảm ứng cùng đi qua `pressLantern()`.
- **Ký hiệu:** ba ký hiệu (Vòng ở cổng, Sóng trên cầu, Lửa ở bảng hiệu) chỉ hiện và nhận tương tác ở pha SPIRIT. Quét ngoài pha này bị domain từ chối (D-034).
- **Puzzle (`domain/puzzle/GlyphPuzzle.ts`):** chọn ba ký hiệu theo đúng thứ tự Sóng → Vòng → Lửa, rồi khắc tại bàn khắc. Sai thứ tự thì xoá mục nhập, không mất nguyên liệu, và gợi ý của Bấc mở dần theo số lần thử (D-035).
- **Q01 "Nét Mực Thất Lạc":** hỏi Cô Lam về các dấu vết → quét ba ký hiệu → khắc đúng thứ tự → chế tạo Đèn Vân Linh. Khi xong, cầu sáng (`bridge_glow`) và nhiệm vụ kết thúc (cờ `q01_complete`).
- **Hiệu ứng (D-036):** tint CSS theo `spiritAmount`, 8 hạt có pool (tắt khi giảm hiệu ứng), cầu dùng material clone để không làm sáng gỗ khác.
- **Sửa khi kiểm tra:** `updateLantern` chỉ phát `changed` khi đổi pha, nên ký hiệu không hiện dần. Đã sửa để phát mỗi khung hình trong lúc chuyển tiếp (test `lanternSession`). Lỗi typecheck trong `WorldView`: truy cập `.render` trên `GraphNode` đã sửa bằng kiểm tra `instanceof pc.Entity`.
- Q02 chưa có nội dung. Module 07 sẽ thêm.

### Module 06 — Minigame lắp khung và khắc
- **Thay nút "Lắp" tạm (D-031).** Chế tạo giờ là: bắt đầu → chơi minigame → hoàn tất tự động. Nguyên liệu được giữ chỗ khi bắt đầu, và chỉ bị tiêu khi minigame hoàn tất.
- **Lắp khung (`AssemblyGame`):** ba ô, chạm thanh tre rồi chạm ô, hoặc kéo thả vào ô gần nhất. Thả ra ngoài là một lần trượt, không làm mất gì. Chất lượng theo độ chính xác của từng lần gắn (D-038).
- **Khắc (`EngravingGame`):** chạm ba dấu theo thứ tự đã tìm ở Q01. Thứ tự không được hiện ra (D-039). Sai thì không reset, chỉ tính một lần sai.
- **Hoàn tất một lần:** craft và minigame bị xoá cùng lúc, nên chạm thêm sau khi xong không thêm đồ. Rời panel hoặc Escape thì huỷ và trả nguyên liệu (D-037).
- **Chất lượng từ minigame, không từ người gọi.** `completeCraft(quality)` đã bị bỏ.
- **Thông báo:** "Đã làm xong Đèn Vân Linh (Đẹp)" nêu chất lượng; món không có chất lượng giữ thông báo cũ.
- **Giao diện (placeholder HTML, D-040):** khung hai chiều và vòng khắc; chạm để chọn rồi chạm ô, kéo thả, và nút thường cho bàn phím. Không có 3D, không xoay, không tiếng.

### Module 07 — Cửa hàng, đơn hàng, Q02, màn hình kết thúc
- **Quầy tiệm (`shop.json`):** Một quầy mở bảng cửa hàng với ba phần: đơn hàng, nội thất, ô trưng bày. Ba ô cố định, mở theo cấp tiệm (ô 3 ở cấp 2). Năm món nội thất, mỗi món có giá, cấp yêu cầu, cờ yêu cầu và hình khối tạm (D-041).
- **Mua và đặt:** Mua bằng Xu Đèn kiếm được. Kiểm tra đủ mọi điều kiện trước rồi mới trừ tiền, nên số dư không bao giờ âm. Mỗi ô giữ một món (D-041).
- **Đơn hàng (`orders.json`, `OrderBoard`):** Hai đơn xác định: Đèn Mộc (25 Xu Đèn, 2 Uy Tín) và giấy dó với dây gai (15 Xu Đèn, 1 Uy Tín). Nhận đơn chỉ khi nhiệm vụ đang hỏi. Giao nguyên tử, một lần (D-042).
- **Q02 "Phiên Chợ Đầu Tiên":** Nhận hai đơn, giao hai đơn, mua Kệ Đèn, đặt vào một ô. Hoàn thành: cấp tiệm 2, +10 Uy Tín, cờ `mvp_complete` (D-043).
- **Nguồn nguyên liệu:** Thêm 2 tre, 1 giấy dó, 1 dây gai vào thế giới, vì Q00 và Q01 đã dùng hết nguyên liệu có sẵn. Thiếu chúng thì đơn Đèn Mộc không thể giao.
- **Hiển thị nâng cấp:** Thân tiệm và biển hiệu sáng theo cấp. Ô và món nội thất hiện trong cảnh. Đây là hình khối tạm (D-044).
- **Màn hình kết thúc:** Hiện một lần khi `mvp_complete` bật. Đóng panel đang mở, khoá gameplay trong lúc hiện, và có "Đi dạo tiếp". Lời teaser là bản nháp (D-044).
- **Hai lỗi phát hiện khi kiểm tra và đã sửa:** (1) màn kết thúc hiện chồng lên panel đang mở, nên giờ tự đóng panel. (2) Ánh sáng tiệm quá nhạt để thấy khác biệt, nên tăng độ sáng cấp 1 lên 0.25 và cấp 2 lên 0.55, đồng thời chiếu sáng cả biển hiệu.

### Module 08 — Lưu, khôi phục, cài đặt, tạm dừng, âm thanh
- **Lưu (`SavePort`, `LocalSaveAdapter`):** IndexedDB là kho chính, localStorage là dự phòng. Tài liệu có phiên bản, kiểm tra từng trường, và bảng migration (D-045).
- **Tự lưu và tải:** Lưu 800 ms sau thay đổi cuối, và ngay khi trang ẩn hoặc đóng. Tải xong mới hiện HUD (D-046).
- **Khôi phục an toàn:** Lưu hỏng thì giữ bản sao, bắt đầu lại, và báo người chơi bằng banner. Lưu không đọc được bằng việc khôi phục nửa vời thì cũng coi là hỏng (D-045).
- **Bắt đầu lại:** Có xác nhận. Trạng thái trống được lưu ngay (D-046).
- **Menu tạm dừng:** Escape hoặc nút Menu. Escape đóng panel trước. Tạm dừng khoá đầu vào. Có ngôn ngữ, giảm hiệu ứng, âm thanh, bắt đầu lại (D-047).
- **Đổi ngôn ngữ:** Vi và En, HUD đổi ngay, lưu giữa các lần tải (D-047).
- **Chuỗi hard-code đã chuyển:** Màn lỗi khởi động, nhãn canvas, và chữ màn tải nằm trong locale. Trong `src/ui` và `src/app` chỉ còn tên ngôn ngữ «Tiếng Việt» viết cứng ở menu (xem Vấn đề đã biết).
- **Âm thanh tổng hợp:** Tám hiệu ứng bằng Web Audio. Mở khoá sau cử chỉ người chơi. Tắt được trong menu (D-048).
- **Màn kết thúc được nhớ:** Cờ `end_card_seen` (D-045).

### Module 09 — Manifest tài sản, bộ nạp GLB, dev tools
- **Manifest (`docs/ASSET_MANIFEST.md`):** Hợp đồng với Blender. Cho mọi model MVP: kích thước, ngân sách tam giác (đề xuất), pivot và hướng, tên node, animation bắt buộc và tùy chọn, collider, và bảng trạng thái. Repo không có model production nào, và tài liệu nói rõ điều đó.
- **Bộ nạp (`engine/assets/AssetLoader.ts`):** Đọc `src/content/assets.json`. Mỗi asset có dự phòng hình khối. Tải lỗi, hết giờ, hoặc thiếu file đều giữ dự phòng, không dừng game (D-049).
- **Animation thiếu:** Clip được yêu cầu, không thì `idle`, không thì đứng yên (`resolveAnimation`, test đầy đủ).
- **Test GLB (`engine/assets/testGlb.ts`):** Khối glTF 2.0 nhị phân có clip `idle`, sinh bằng code. PlayCanvas nạp thành công trong Chrome (D-050).
- **Thay một asset:** Đổi một dòng trong `assets.json`. Đã kiểm tra: `validateAssets` từ chối nguồn ngoài `/assets/` và bộ sinh lạ.
- **Preset chất lượng:** Thấp, di động, cao, đổi mật độ điểm ảnh; mặc định tự động theo màn hình cảm ứng (D-051).
- **Công cụ đo:** F3 hiện FPS, lệnh vẽ, và số model (mọi bản). F4 mở bảng asset (chỉ dev) để tải và đặt thử (D-052).
- **Dev-only:** Asset `dev.*` không được tải trong bản phát hành.
- **Chưa làm:** Lightmap và bake. Đo số tam giác thật. Color grading (không cần ở MVP). NPC đã có model và animation idle (commit `f830d8b`), nhưng chưa đo lại trên máy thật.

### Module 10 — QA, smoke test, khả năng truy cập, báo cáo bundle
- **Báo cáo đầy đủ:** `docs/QA_REPORT.md`: bundle, tải về, 404, lỗi console, số lệnh vẽ, nhóm test, khả năng truy cập, thiết bị đã thử, và giới hạn. FPS được ghi là chưa đo (D-053).
- **Smoke test chương:** Q00 → Q01 → Q02, với lưu và tải lại giữa mỗi chặng (`smokeCampaign`).
- **Smoke test HUD (jsdom):** màn lỗi khởi động, tiền, nhiệm vụ đổi khi nhặt, hội thoại, kho đồ (D-055).
- **Migration lưu có kiểm tra:** `parseSaveDocumentWith` nhận bảng truyền vào, nên mỗi bước được kiểm tra trước khi cần (D-056).
- **Chữ lớn:** cài đặt phóng HUD 125% bằng CSS `zoom` (D-054).
- **Icon nội tuyến:** `index.html` có icon SVG dạng data URI, nên trình duyệt không xin `/favicon.ico` (trả về 404).
- **Bản production đã kiểm tra:** boot không lỗi console, không 404, không dev hook. Menu tạm dừng liệt kê đủ điều khiển, chữ lớn phóng HUD đúng.
- **Chưa làm:** đổi phím (phím nằm trong một tệp, chưa có giao diện), trình đọc màn hình, đo FPS thật, thiết bị Android, Firefox và Safari.

### Module 11 — Cổng analytics và nền tảng, riêng tư, phát hành
- **AnalyticsPort:** tên sự kiện đóng, bản cài sẵn không làm gì. Màn kết thúc phát sự kiện "hoàn thành chương" qua `game.analytics` (D-057).
- **PlatformPort:** mô tả thiết bị (cảm ứng đầu tiên, ngôn ngữ). `BrowserPlatform` đọc từ trình duyệt; lưu dùng cổng này để chọn chất lượng tự động (D-057).
- **Riêng tư:** `docs/PRIVACY.md` là bản nháp, ghi đúng những gì code làm và nói rõ chưa phải chính sách pháp lý (D-059).
- **Phát hành:** `docs/RELEASE_CHECKLIST.md` có các mục mã, bản production, nội dung, và thiết bị. Mục nào chưa làm thì để trống.
- **PWA:** chưa có manifest. `docs/PWA.md` ghi các mục cần có nếu thêm sau. Hướng ngang trên điện thoại vẫn do OrientationGate trong ứng dụng đảm nhận (D-060).

### Module 12 — Thẻ câu chuyện có nguồn
- **Thẻ (`src/content/story_cards.json`):** sáu thẻ. Ba sự kiện có thật (giấy dó, thời vụ thu vỏ dó, làng Bưởi), ba hư cấu (chợ đêm, Đèn Soi Linh và Bấc, teaser chương 2).
- **Quy tắc:** sự kiện có thật chỉ `verified` khi có nguồn https. Validator từ chối thẻ vi phạm. Thẻ trỏ tới khoá locale không có cũng bị loại (D-058).
- **Trạng thái thật:** mọi sự kiện có thật là `needs_review`. Các nguồn tìm được chỉ là tóm tắt, và không đồng ý về loài cây, thời vụ, mốc lịch sử. Không có gì được ghi là đã kiểm chứng.
- **Hướng dẫn:** `docs/STORY_CARDS.md` có bảng trạng thái, danh sách nguồn chưa đọc toàn văn, và cách chuyển sang `verified`.
- **Cập nhật 14/10/2026 (D-069):** đã đọc ba nguồn qua WebFetch. Hai thẻ giấy dó và làng Bưởi chuyển sang `verified`. Thẻ thu hoạch vẫn `needs_review`. File VNPT không đọc được.

### Sau Module 12 — chế tác 3D, thế giới, đèn (D-069 đến D-073)
- **Thẻ và nhật ký (D-069, D-070):** hai thẻ văn hoá đã `verified`; «Chuyện Đằng Sau» mở sau nhiệm vụ, tách sự thật và hư cấu; phím J mở nhật ký. Phần sự thật còn dưới 50 từ (G4 còn biên tập).
- **Chế tác 3D (D-071):** khung đèn và thanh tre rơi vào ổ; đường sáng quanh đèn khắc. Input vẫn ở panel HTML.
- **Thế giới (D-072):** mọi vật nhìn thấy có model, trừ mặt đất và mặt nước; mái mờ khi che nhân vật; vầng sáng dưới NPC.
- **Khung đèn hai ổ (D-073):** khớp công thức Đèn Mộc (hai tre). Lỗi này lộ ra khi chơi T1.

## Bằng chứng kiểm thử (đã chạy thật)

| Lệnh | Kết quả |
|---|---|
| `npm run typecheck` | Đạt |
| `npm test` | 50 file, 779 test, tất cả đạt (14/10; có smoke test HUD bằng jsdom) |
| `npm run build` | Đạt (14/10). `playcanvas-*.js` 2,082.79 kB (gzip 534.90 kB), `react-*.js` 218.77 kB (gzip 68.25 kB), `index-*.js` 183.31 kB (gzip 53.61 kB), `index-*.css` 16.65 kB (gzip 3.54 kB). Hook dev và công cụ dev không có trong bundle. Id `dev.test_crate` nằm trong bundle như dữ liệu, không được tải |

Test thuần (chạy trong Node), theo nhóm:
- **Module 01–03 và HUD:** `math`, `collision`, `movement`, `keyboardState`, `hubCollision`, `hubLayout`, `display`, `color`, `startupErrors`, `GameApp.startup`, `eventBus`, `translator`, `interactionSystem`, `dialogueSystem`, `contentValidation`, `interactPolicy`, `localeKeys`.
- **Module 04:**
  - `inventory`: xếp chồng, chất lượng, giữ chỗ nguyên tử, commit và release một lần, spend nguyên tử.
  - `crafting`: từ chối (công thức lạ, sai trạm, chưa mở, thiếu nguyên liệu, đang bận), tiêu nguyên liệu một lần, huỷ trả lại, không nhân đôi đầu ra, đầu ra thô không có chất lượng.
  - `questSystem`: kích hoạt, mục tiêu đếm nguồn riêng biệt, thưởng đúng một lần, khôi phục save không thưởng lại.
  - `gameSession`: Q00 chạy đầu đến cuối với nội dung thật (30 xu một lần), thiếu nguyên liệu không giữ chỗ, huỷ trả nguyên liệu, thông báo khi đặt thiếu đèn.
  - `gameplayContent`: nội dung thật không có lỗi, mọi vị trí tương tác nằm trong hub và không chồng vật cản, các lỗi tham chiếu bị loại đúng chỗ.
- **Module 05:**
  - `lanternPhase`: chuyển tiếp đủ 0.35 s, spiritAmount đi từ 0 đến 1 theo smoothstep, nhấn trong lúc chuyển tiếp xếp hàng đúng một lần, khôi phục save.
  - `glyphPuzzle`: từ chối chọn trùng, chọn lạ, chọn khi đã đủ hoặc đã giải. Sai thứ tự xoá mục nhập và tăng số lần thử. Gợi ý mở đúng ngưỡng.
  - `lanternSession`: mỗi khung hình trong chuyển tiếp đều phát `changed`, và ngừng khi ổn định.
  - `q01`: Q01 chạy đầu đến cuối với nội dung thật, mở công thức, đặt `bridge_glow` và `q01_complete` đúng lúc.
  - `interactionSystem`: `setEnabled` ẩn mục tiêu khỏi focus và hint.
- **Module 06:**
  - `assemblyGame`: lắp đúng ba ô, từ chối ô lạ và ô đã lắp, thả ra ngoài và NaN là trượt, sau khi xong không nhận thêm, chất lượng theo tâm và mép.
  - `engravingGame`: đúng thứ tự thì hoàn tất, sai không reset và tính một lần sai, chạm lại dấu đã sáng là sai, dấu lạ không tính sai, sau khi xong không nhận thêm.
  - `craftMinigame` (session): giữ chỗ khi bắt đầu, trả khi huỷ, tiêu một lần khi hoàn tất, chất lượng từ minigame, rời panel thì huỷ craft, khoá engraving tới khi giải puzzle, view không lộ thứ tự, confirm-only hoàn tất ngay.
  - `q01` và `gameSession` đổi sang chơi minigame thật qua `craftHelpers.ts`, không còn gọi trực tiếp.
- **Module 07:**
  - `shopDomain`: mua không đủ tiền thì từ chối và không đổi gì, cấp và cờ khoá đúng, ô một món, ô khoá theo cấp, giữ tồn kho khi đặt, đơn đi `open → accepted → delivered`, thiếu đồ thì không tiêu gì, giao một lần.
  - `shopContent`: nội dung thật không có lỗi. Giá 0, màu sai, hình lạ, đơn thiếu món, quầy thiếu, ô trùng đều bị loại có lý do.
  - `q02`: Q02 bắt đầu sau Q01, không nhận đơn trước khi nhiệm vụ hỏi, Kệ Đèn không bán trước Q01, mua và đặt đầy đủ đến khi xong, phần thưởng trả đúng một lần, từ chối cấp và ô đã có món.
  - `gameplayContent`: danh sách nhiệm vụ có Q02, và quầy cùng ô trưng bày không nằm trong vật cản.
- **Module 09:**
  - `assetFormats`: GLB của test có header, chunk, accessor, chỉ số, và clip đúng cấu trúc. Sinh cùng một kết quả mỗi lần. Clip thiếu rơi về `idle`, rồi về đứng yên.
  - `assetManifest`: manifest thật không có lỗi. Nguồn ngoài `/assets/` bị từ chối. Bộ sinh lạ bị từ chối. Mục hỏng không kéo theo mục khác. Preset chọn đúng theo thiết bị.
- **Module 08:**
  - `saveDocument`: bản lưu do game ghi đọc lại đúng. Không phải đối tượng, thiếu phiên bản, phiên bản tương lai, coins sai kiểu, chất lượng và trạng thái nhiệm vụ lạ đều bị từ chối. Trường lạ được bỏ qua. Cài đặt hỏng về mặc định, tiến trình giữ nguyên.
  - `saveRoundTrip`: tải lại giữ coins, cờ, nhiệm vụ đang chạy, kho, đèn, puzzle đã giải, số lần sai, đơn đã nhận, cờ kết thúc. Craft đang dở không được lưu, nhưng nguyên liệu thì còn. Tải hai lần không trả thưởng hai lần. Pickup đã xoá khỏi nội dung bị bỏ khi tải. Bắt đầu lại trả về trạng thái mở đầu và được lưu.
  - `localSaveAdapter`: không có kho nào thì ghi báo `false`. Dự phòng localStorage. Bản sao tách khoá khỏi bản lưu. IndexedDB không mở được thì dùng localStorage. Ghi đầy hoặc đọc bị chặn thì không ném lỗi.
  - `localeCoverage`: các khoá tạo lúc chạy (trạng thái đơn, chất lượng, hành động, tên ký hiệu, thông báo khởi động) có đủ trong cả hai ngôn ngữ.

### Kiểm tra trong trình duyệt (Q00 đầy đủ, bằng phím và chuột thật khi có thể)

| Bước | Kết quả |
|---|---|
| Mở game | Bảng nhiệm vụ Q00 với 6 mục tiêu. Thanh tiền 0 |
| Nói chuyện với Bà Nghiêm | Mục tiêu "Nói chuyện" được đánh dấu ✓ |
| Nhặt 2 tre (2 vật khác nhau), 1 giấy, 1 dây | Mỗi mục tiêu tăng đúng; thông báo "Nhận được Tre/Giấy dó/Dây gai" dịch đúng |
| Chế tạo ở bàn nghề (panel mở, nút "Lắp" bằng click) | Nguyên liệu biến mất, có Đèn Mộc, thông báo "Đã làm xong Đèn Mộc" |
| Đặt lên chân đèn trước tiệm | Thông báo "Hoàn thành: Đêm Mở Chợ", "+30 Xu Đèn", "Đã đặt Đèn Mộc"; thanh tiền 30; cờ `q00_complete`, `shop_lamp_lit` |
| Bảng nhiệm vụ | Không còn nhiệm vụ hiện tại (Q01 chưa có) |
| Console | Không có lỗi mới. Lỗi `npc_ghost` còn lại là bài kiểm tra có chủ đích từ Module 03 |

### Kiểm tra trong trình duyệt (Module 05: đèn, puzzle, sau khi khởi động lại dev server)

| Bước | Kết quả |
|---|---|
| Nhấn Q (keydown `KeyQ`) | Pha `real` → `to_spirit` → `spirit`. Lớp tint hiện, huy hiệu đổi thành "Đèn Soi Linh" |
| Mở bàn khắc (`interactStation`) | Panel "Bàn khắc": ba mục Vòng, Sóng, Lửa; "Đã chọn 0/3"; các nút Bỏ dấu cuối, Xoá hết, Khắc |
| Chọn Vòng → Sóng → Lửa, bấm Khắc (bằng click) | "Chưa đúng thứ tự. Thử lại từ đầu, không mất nguyên liệu." Gợi ý `puzzle.hint.1` hiện. Mục nhập xoá sạch, số lần thử = 1 |
| Chọn Sóng → Vòng → Lửa, bấm Khắc (bằng click) | "Đã khắc đúng! Đèn Vân Linh đã được mở." Cờ `recipe_spirit_lantern_known` = true. Mục nhập "Sóng → Vòng → Lửa" |
| Đóng panel | Panel về `null` |
| Console | Không có lỗi mới sau khi khởi động lại. Lỗi `LanternHud is not defined` còn trong buffer là của phiên HMR cũ |

Lỗi thao tác khi kiểm tra Module 05 (không phải lỗi game): chọn bằng toạ độ thay vì ref đã bấm nhầm vùng trống. Sau đó dùng ref và kết quả đúng.

### Kiểm tra trong trình duyệt (Module 09: bộ nạp GLB, F3, F4)

| Bước | Kết quả |
|---|---|
| Tải trang | Bộ nạp đọc manifest. Năm nội thất ở trạng thái `none` (không có model), dùng dự phòng. `dev.test_crate` ở trạng thái `loaded` |
| Clip của test crate | `idle`. Yêu cầu `wave` (không có) rơi về `idle`. Nội thất không có clip |
| F4 (dev) | Bảng "Assets (dev)" hiện đúng trạng thái và clip |
| Đặt test crate trước mặt người chơi | Khối glTF hiện trong cảnh, cạnh nhân vật, đúng màu và vị trí trên mặt đất. Số "Remove placed" tăng lên 1 |
| F3 | Hiện "FPS 3, Draw calls 162, Models 1/6". FPS 3 là giới hạn pane (D-032), không phải đo thật |
| Console | Không có lỗi trong bản hiện tại. Các lỗi `StatsOverlay is not defined` và `resolveQualityPreset is not defined` còn trong buffer là của phiên HMR cũ, trước khi khởi động lại |

Lỗi tìm ra khi kiểm tra: tên clip sau khi nạp là `dev.test_crate/animation/0`, không phải `idle`. Nên `resolveAnimation` không khớp, và "thiếu animation thì về idle" sẽ không bao giờ chạy. Đã sửa: lấy tên từ `AnimTrack.name`. Sau sửa, clip là `idle`.

Lỗi thứ hai: asset `dev.test_crate` được tải cả trong bản phát hành. Đã sửa: `preload(includeDev)` bỏ qua id `dev.` khi không ở chế độ dev.

### Kiểm tra trong trình duyệt (Module 08: lưu, khôi phục, tạm dừng, ngôn ngữ)

| Bước | Kết quả |
|---|---|
| Làm Q00, tải lại trang | Coins 30, Q01 đang chạy, shop_lamp đã đặt, cờ và thanh nhiệm vụ như trước khi tải lại |
| Hỏng bản lưu trong IndexedDB, tải lại | Banner "Không đọc được tiến trình cũ…" hiện. Coins 0, Q00 đang chạy. Bản sao hỏng ở khoá `progress-backup` |
| Esc, chọn English | Mở menu. HUD đổi ngay sang tiếng Anh, `lang="en"`. Gameplay bị khoá trong lúc menu mở |
| Esc lần nữa | Đóng menu, gameplay mở lại |
| Tải lại trang | Vẫn tiếng Anh: cài đặt được lưu |
| Nhặt một pickup, Esc, Bắt đầu lại, Có | Nguyên liệu về 0, Q00 đang chạy. Tải lại vẫn ở trạng thái trống |
| Lưu sau khi nhặt | Bản lưu IndexedDB có `pk_bamboo_2` và `"version":1` |
| Console | Không có lỗi trong bản build hiện tại. Lỗi `shopStock.snapshot` còn trong buffer là của trang cũ đang rời đi, và đã sửa |

Lỗi tìm ra khi viết: `flush` có thể ném lỗi đồng bộ trong hàm bất đồng bộ, thành lỗi không được bắt. Đã đưa vào try/catch, và coi là ghi thất bại. Lỗi `load` khi khôi phục nửa vời cũng đã được xử lý bằng cách coi là hỏng.

### Kiểm tra trong trình duyệt (Module 07: cửa hàng, đơn hàng, Q02, màn kết thúc)

Quầy được mở bằng `openPanel({kind:'shop'})`, đúng với việc tương tác quầy. Chưa đi bộ tới quầy trong trình duyệt (pane chạy 3 khung hình/giây, xem D-032).

| Bước | Kết quả |
|---|---|
| Mở quầy | Đơn "Khách cần một Đèn Mộc" và "Khách cần giấy dó và dây gai", mỗi đơn có nút Nhận đơn. Nội thất có giá và "Đã có 0" |
| Nhận cả hai đơn (click) | Cả hai sang "Đang nhận". Hai mục tiêu accept được đánh dấu |
| Chế Đèn Mộc thứ hai, giao đơn Đèn Mộc (click) | Xu Đèn 30 → 55, Uy Tín 10 → 12, Đèn Mộc bị tiêu |
| Giao đơn giấy dó và dây gai (click) | Xu Đèn 55 → 70, Uy Tín 13 |
| Mua Kệ Đèn (click) | 70 → 50 Xu Đèn. Kệ Đèn "Đã có 1" |
| Chọn Kệ Đèn, chạm "Ô trưng bày 1" (click) | Ô 1 hiện "Kệ Đèn". Q02 hoàn thành. Cấp tiệm 2. Ô 3 mở |
| Màn kết thúc | "Tiệm đã sáng", Xu Đèn 50, Uy Tín 23, teaser. Gameplay bị khoá. Panel đang mở tự đóng (`currentPanel` = null) |
| Đi dạo tiếp | Màn đóng, gameplay mở lại |
| So sánh đầu game (cấp 0) và cuối (cấp 2) | Đầu: tiệm tối, không có ô. Cuối: thân tiệm sáng hơn, ô và Kệ Đèn hiện. Khác biệt có thấy nhưng nhẹ (xem Chưa kiểm chứng) |
| Console | Không có lỗi mới sau khi khởi động lại dev server. Lỗi `hasGlowMaterial is not defined` còn trong buffer là của bản HMR trung gian, trước khi sửa |

### Kiểm tra trong trình duyệt (Module 06: minigame chế tạo, bằng click thật)

| Bước | Kết quả |
|---|---|
| Bắt đầu Đèn Mộc ở bàn nghề | Panel chuyển sang khung lắp: ba ô, một thanh tre, "Đã gắn 0/3", nút Huỷ. Tre còn 0 khả dụng (đã giữ chỗ) |
| Chạm thanh tre, chạm ô 1 | Ô 1 được gắn, "Đã gắn 1/3", không trượt |
| Kéo thanh tre vào ô 2 | Ô 2 được gắn bằng kéo thả |
| Thả thanh tre ra ngoài khung | Tính một trượt (`misses` = 1). Thanh tre vẫn ở khay, ô 1 và 2 vẫn gắn |
| Chạm thanh tre, chạm ô 3 | Craft hoàn tất: tre bị tiêu (0), có một Đèn Mộc Hoàn Mỹ, panel trở về danh sách công thức |
| Bắt đầu Đèn Vân Linh ở bàn khắc (sau khi giải puzzle) | Ring có ba dấu Vòng, Sóng, Lửa, "Đã khắc 0/3", không lộ thứ tự |
| Chạm Lửa trước | Không sáng, "Chưa đúng thứ tự…" hiện. Số lần sai = 1. Mực, giấy, đèn vẫn được giữ |
| Chạm Sóng → Vòng → Lửa | Hoàn tất. Đèn Vân Linh chất lượng Đẹp (một lần sai), nguyên liệu tiêu đúng một lần, thông báo "Đã làm xong Đèn Vân Linh (Đẹp)" |
| Bắt đầu lần nữa rồi bấm Huỷ | Cả ba nguyên liệu trở về khả dụng (1 mỗi loại), craft kết thúc, về danh sách |
| Console | Không có lỗi |

Lỗi thao tác khi kiểm tra (không phải lỗi game): toạ độ kéo dùng khung ảnh 800×542, không phải viewport 1348×914. Sau khi chỉnh, kéo thả chạy đúng.

Lưu ý quan trọng về môi trường kiểm thử: pane trình duyệt đang cho khung hình chỉ khoảng 3 lần/giây, kể cả iframe trống (D-032). Vì vậy các bước đi bộ được thực hiện với thời gian chờ dài hơn, và `maxDeltaTime` được tăng lên 0.5 s **chỉ trong trình duyệt** để rút ngắn. Logic gameplay không thay đổi.

## Chưa kiểm chứng (phải nói rõ)
- **FPS thực tế:** không đo được trong pane lúc này. Cần kiểm tra lại trên máy thật khi môi trường ổn định.
- **Minigame chế tạo:** input vẫn là HTML. Khung 3D chỉ đọc trạng thái (D-071). Nam châm là thanh rơi có giảm tốc, tiếng «tách» vẫn từ HTML. Kéo thả bằng cảm ứng thật chưa được thử trên thiết bị. Chỉ thử bằng chuột và click ref trong trình duyệt.
- **Model:** 83 GLB trong `public/assets`. Chưa đo số tam giác thật và chưa thử nạp trên Android.
- **Module 08 trong trình duyệt:** âm thanh chưa được nghe (trình duyệt tự động không phát được để kiểm). Chưa thử ở chế độ riêng tư, nơi IndexedDB có thể bị chặn. Chưa thử mở hai tab cùng lúc, nơi hai bản lưu có thể ghi đè nhau. Menu tạm dừng chưa thử trên màn hình điện thoại.
- **Module 07 trong trình duyệt:** chưa đi bộ tới quầy (mở bằng `openPanel`). Sự khác biệt đầu và cuối tiệm là có thật nhưng nhẹ, cần xem lại với mô hình thật (Module 09). Màn kết thúc không được lưu, nên tải lại thì hiện lại. Panel cửa hàng chưa thử trên màn hình điện thoại.
- **Module 05 trong trình duyệt:** chưa thấy bằng mắt ba ký hiệu 3D và bước chuyển sáng của chúng, chưa quét ký hiệu bằng tay, chưa đi hết Q01 trong trình duyệt (chỉ có test đơn vị với nội dung thật), chưa thấy cầu sáng và hạt, chưa thử nút Q trên cảm ứng.
- **Đi bộ bằng phím vật lý:** chưa làm. Lượt đi bộ ngày 14/10 dùng sự kiện phím giả lập và khung hình gọi tay (xem [QA_REPORT.md](QA_REPORT.md) mục 9).
- **Đọc bằng trình đọc màn hình, giữ joystick lâu, pinch zoom, tạm dừng khi ẩn tab, thiết bị thật:** như các module trước.

## Vấn đề đã biết
1. **Nội dung hội thoại và thông báo còn là bản nháp.** Hai thẻ văn hoá đã `verified`, thẻ thu hoạch còn `needs_review`, và phần sự thật chưa đủ 50–100 từ (G4).
2. **Đã xử lý (V3).** Bàn nghề và bàn khắc là model, không còn vạch sáng.
3. **Vị trí tương tác chưa kiểm tra có hệ thống là không chặn đường đi.** Các điểm đã kiểm tra không nằm trong vật cản (test), nhưng đường đi tối ưu chưa được xem xét.
4. **Lồng đèn soi vết** trong GDD được ánh xạ thành Đèn Vân Linh (D-026).
5. **`speed` là vận tốc dự định** (D-014). Không ảnh hưởng vị trí.
6. **Mất WebGL context** (GPU reset): chưa xử lý, chỉ có log lỗi.
7. **Bundle đã tách thành ba chunk:** engine 2.08 MB (535 kB gzip), React 219 kB, game 159 kB. Vẫn chưa tải lười engine. Xem `docs/QA_REPORT.md` mục 1 và D-065.
8. **Copy hard-code đã chuyển sang locale** ở Module 08. Chỉ còn tên "Tiếng Việt" và "English" trong menu là viết cứng, vì đó là tên ngôn ngữ.
9. **Đã xử lý (D-066).** Web Locks giữ một tab; tab thứ hai hiện thông báo và chờ. Trình duyệt không có Web Locks thì vẫn có thể ghi đè.
10. **Bộ sinh test GLB** nằm trong bundle phát hành (vài trăm byte mã), dù asset `dev.*` không được tải. Chấp nhận được ở MVP, nhưng Module 10 có thể tách ra nếu bundle cần gọn.
11. **Phím E có vẻ bị bỏ qua trong pane.** Đã điều tra 14/10: không có lỗi logic; pane chỉ chạy khung hình khi có thao tác. Đã thêm hạn 250 ms cho lần nhấn đang chờ (D-074), nên lần nhấn cũ không kích hoạt muộn. Chưa đo trên máy có khung hình liên tục.
12. **Đèn Vân Linh chưa có vật trong thế giới** (V5). Chỉ có trong bàn khắc và kho.

## Việc tiếp theo
- **Đã xong các module 00–12, và các mục G và V trong [COMPLETION.md](COMPLETION.md), trừ V5.** Phần còn lại cần thiết bị thật, người thật hoặc pháp lý: FPS thật, Android, iOS, Firefox, Safari, trình đọc màn hình thật, playtest, và chính sách riêng tư đã duyệt.
- **Trước khi gọi là "chơi thử được":** Làm các việc trong mục 8 của `docs/QA_REPORT.md`. Đo FPS thật trên desktop và Android, thử cảm ứng và xoay ngang trên điện thoại, thử Firefox và Safari. Cần thiết bị thật, nên không làm được trong môi trường này.
- **Song song:** đối chiếu 83 model với `docs/ASSET_MANIFEST.md` (kích thước, số tam giác, tên node).
- **Nợ kỹ thuật đã biết:** trình đọc màn hình chưa thử với phần mềm thật. Đã làm: tách chunk (D-065), khoá đa tab (D-066), rà soát focus (D-067), đổi phím (D-068).

## Checklist kiểm thử thủ công (Module 07, Q02)
- [ ] Hoàn thành Q01. Quầy tiệm (gần cửa tiệm) hiện Q02 "Phiên Chợ Đầu Tiên" trong bảng nhiệm vụ.
- [ ] Mở quầy, nhận cả hai đơn. Đơn chưa đủ đồ thì nút Giao đơn bị khoá.
- [ ] Làm Đèn Mộc thứ hai ở bàn nghề, giao đơn Đèn Mộc. Xu Đèn và Uy Tín tăng đúng. Đèn Mộc bị tiêu.
- [ ] Thu thập giấy dó và dây gai (đã có ở vị trí mới), giao đơn giấy dó và dây gai.
- [ ] Mua Kệ Đèn (20 Xu Đèn). Chọn Kệ Đèn, chạm Ô trưng bày 1. Màn kết thúc hiện. Đóng panel tự động.
- [ ] Trước khi hoàn thành Q01, Kệ Đèn không bán được (cần cờ `q01_complete`). Sau khi Q02 xong, tiệm lên cấp 2: Ô 3 mở và Đèn treo giấy bán được.
- [ ] Tiệm sáng hơn sau khi lên cấp. Ô và món nội thất đứng đúng chỗ.

## Checklist kiểm thử thủ công (Module 05, Q01)
- [ ] Sau khi xong Q00, nói chuyện với Cô Lam. Nhiệm vụ "Nét Mực Thất Lạc" bắt đầu.
- [ ] Nhấn Q: đèn chuyển sang Đèn Soi Linh, màn hình ánh ngọc nhẹ. Nhấn Q lần nữa để tắt.
- [ ] Ở pha Đèn thường, không có ký hiệu nào hiện và không có gợi ý tương tác cho chúng.
- [ ] Ở pha Đèn Soi Linh, đến gần cổng, cầu, bảng hiệu: hiện "Soi ..." và quét được. Thông báo "Đã soi ...".
- [ ] Bàn khắc (`station_engraving`, toạ độ x 6.5, z -12 trong `world.json`): sai thứ tự, thông báo sai và gợi ý mở dần sau lần thử đầu và lần thứ ba.
- [ ] Khắc đúng Sóng → Vòng → Lửa: thông báo, công thức Đèn Vân Linh mở. Chế tạo ở bàn khắc hoàn tất Q01: cầu sáng, nhiệm vụ kết thúc.
- [ ] Trên điện thoại: nút Đổi đèn và nút Tương tác không che nhau, không che bảng nhiệm vụ.

## Checklist kiểm thử thủ công (Q00)
- [ ] `npm run dev`, mở http://localhost:5173. Không có lỗi trong console.
- [ ] Bảng nhiệm vụ hiện Q00 với 6 mục tiêu ở góc trên trái.
- [ ] Nói chuyện với Bà Nghiêm: mục tiêu đầu được đánh dấu.
- [ ] Nhặt 2 tre, 1 giấy dó, 1 dây gai ở các vị trí khác nhau. Nhặt lại cùng vật không tăng số.
- [ ] Mở bàn nghề (phía tây bắc, gần xưởng Cô Lam), nhấn "Bắt đầu" khi đủ nguyên liệu. Gắn đủ ba ô (chạm hoặc kéo). Khi xong, nguyên liệu biến mất và có Đèn Mộc. Nhấn "Huỷ" giữa chừng thì nguyên liệu được trả lại.
- [ ] Đặt Đèn Mộc lên chân đèn trước tiệm (đông nam nhà tiệm). Thông báo hoàn thành và +30 Xu Đèn hiện một lần.
- [ ] Nhấn I để mở kho đồ. Escape đóng panel. Đóng panel đang chế tạo không làm mất nguyên liệu.
- [ ] Trên điện thoại: bảng nhiệm vụ và thanh tiền không che nút điều khiển.
