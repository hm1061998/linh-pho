# LINH PHỐ – CHỢ ĐÊM KỲ ẢO
## Game Design Document v1.0 — October 2026

> Thể loại: Cozy Adventure RPG · Exploration/Puzzle/Crafting/Shop Progression · 3D Web-first.  
> Định vị: Chơi vui trước, học văn hóa Việt Nam qua hành động và khám phá; không kiểm tra trắc nghiệm cưỡng ép.  
> Đội ngũ mục tiêu: 1 dev web có AI hỗ trợ + Blender/asset theo giấy phép.  
> Trạng thái: Tài liệu định hướng thiết kế, chưa phải game hoặc bằng chứng đã triển khai.

## A. Product vision

**Pitch:** Người chơi thừa kế một cửa tiệm cũ ở Linh Phố, khu chợ hư cấu chỉ rực sáng về đêm. Dùng Đèn Soi Linh để thấy dấu vết giữa lớp hiện thực và lớp linh giới, khám phá ký ức đồ vật, chế tạo món hàng, giúp cư dân và thắp sáng từng góc phố.

**Ba trụ cột:** (1) Khám phá có bí ẩn, (2) chế tạo bằng minigame có thao tác, (3) thế giới thay đổi trực quan sau mỗi thành tựu.

**Không thuộc phạm vi MVP:** open world, combat realtime, multiplayer, chat, gacha, battle pass, tạo NPC hội thoại bằng LLM realtime, mô phỏng kinh tế sâu, giao dịch vật phẩm giữa người chơi, hệ thống ngày thật gây FOMO.

**Người chơi mục tiêu:** Người thích cozy game, khám phá môi trường, giải đố 3D nhẹ, trang trí và văn hóa Việt Nam; bản địa hóa tiếng Việt/Anh, phù hợp người mới chơi.

**Điểm độc đáo:** Đèn Soi Linh mang hai trạng thái Amber (đồ vật bình thường) và Jade (dấu vết, điểm tương tác, ký tự). Sử dụng cùng geometry, thay nhóm đối tượng và VFX cục bộ. Chú ý: Đây là ý tưởng kết hợp gameplay chứ không khẳng định cơ chế chưa từng có trên thị trường.

## B. Gameplay design

### B1. Vòng chơi 8–15 phút

1. Vào cửa tiệm → xem 1–2 đơn hàng/NPC yêu cầu.
2. Đi trong chợ → quan sát đường đi, lấy tài nguyên, nghe manh mối.
3. Bật Ánh Linh → khám phá dấu vết, tương tác, giải câu đố; không auto-solve.
4. Chế tạo → minigame xếp bộ phận/khắc hoa văn, nhận chất lượng **Thường/Đẹp/Hoàn Mỹ** dựa trên độ chính xác nhưng không phạt người chơi quá nặng.
5. Giao hàng → nhận Xu Đèn + Uy Tín + đôi khi công thức/hiện vật.
6. Nâng cấp cửa tiệm → thay đổi vật thể 3D và ánh sáng thật trên bản đồ; mở câu chuyện kế tiếp.

**Vòng ngắn 3–5 phút:** hoàn thành 1 đơn hàng đã đủ vật liệu. **Vòng dài 25–35 phút:** khám phá một chuỗi 3 nhiệm vụ cốt truyện. Tiến trình lưu sau mốc quan trọng, thoát giữa hoạt động không mất nhiệm vụ.

### B2. Điều khiển

- Desktop: WASD/arrow di chuyển; rê chuột camera tùy chế độ; E tương tác; Q đổi chế độ đèn; I kho đồ; J nhật ký; Esc tạm dừng.
- Mobile web: virtual joystick vùng trái; nút tương tác, nút đổi đèn bên phải; camera xoay qua cử chỉ ngang khi không chạm UI; giao diện responsive. Không ưu tiên di chuyển bằng click-to-move trong MVP để giới hạn scope.
- Camera 3/4 từ trên cao, góc nghiêng ~40–50°, phạm vi zoom giới hạn, xoay 90° theo bước trong MVP nếu cần. Không xuyên nhà, có vật cản làm mờ mái (roof fade) ở vị trí quan trọng.
- Tốc độ chạy và xoay camera tuning sau playtest; tránh mô tả trị số như kết quả đã kiểm thử.

### B3. Đèn Soi Linh: state machine

`REAL -> TRANSITION_TO_SPIRIT -> SPIRIT -> TRANSITION_TO_REAL -> REAL`.

- `Q`/tap: đổi trạng thái; animation 0.25–0.45s (mục tiêu), UI/HUD phản ánh chính xác; bấm trong transition thì khóa hoặc đưa vào queue 1 lần, không chồng tween.
- REAL: hiện vật liệu thô, cư dân và thiết bị. SPIRIT: hiện `phaseMask=spirit` và các hiệu ứng như vệt chân, phù văn, hạt sáng; một số đối tượng ở cả hai trạng thái.
- Không tạo 2 bản map; chỉ đổi visibility và emission/highlight của node được tag; collider vật cản chỉ đổi khi thiết kế puzzle yêu cầu và phải ngăn kẹt nhân vật.
- Puzzle đòi hành động khác nhau: tìm 3 ký hiệu theo logic, sắp khắc, kéo đèn đến nguồn sáng, xoay tấm phản chiếu. MVP chỉ cần dạng «quan sát 3 dấu vết rồi nhập thứ tự».
- Accessibility: điểm sáng có icon/hình dạng; màu chỉ là tín hiệu phụ. Có nút giảm particle.

### B4. Hệ vật phẩm và progression

**Currencies:** Xu Đèn (nhận qua gameplay, dùng mua vật liệu/trang trí); Uy Tín (XP cửa tiệm, KHÔNG mua); Mảnh Ký Ức (cốt truyện, KHÔNG mua). Không có premium currency trong MVP.

**MVP 8 item templates:** tre, giấy dó, mực, màu lam, dây gai, gỗ vụn, lồng đèn mộc, lồng đèn soi vết. Các ví dụ văn hóa cần được biên tập thực tế, không gán nguồn gốc bừa.

**Công thức đầu:** 2 tre + 1 giấy + 1 dây -> Đèn Mộc. Công thức phụ: 1 Đèn Mộc + 1 mực + 1 màu lam -> Đèn Vân Linh. Vật liệu tiêu hao có kiểm tra đủ số lượng theo transaction. Không dùng random làm người chơi mất tài nguyên hiếm.

**Mức phát triển cửa tiệm:**
- L0 Mái Cũ: nhận 1 đơn hàng.
- L1 Bàn Nghề: mở minigame chế tác.
- L2 Gian Sáng: mở khu trưng bày và thêm slot đặt vật phẩm.
- L3 Góc Ký Ức: mở chương 2 (sau MVP).

**Kỹ năng (post-MVP):** Nhìn Sâu (gợi ý vết khó), Tay Nghề (tăng khoảng chất lượng tốt), Thương Khách (giảm phí vật liệu), Phố Thân (thêm nhiệm vụ xã hội). MVP chỉ có Soi Linh từ đầu và nâng cấp một lần để phát hiện dấu vết ở xa hơn. Không đưa combat tree vào bản đầu.

### B5. Chế tạo 3D không phải chỉ progress bar

1. **Lắp Khung Đèn** (MVP): kéo/chọn từng thanh tre vào 2 ổ trên một đối tượng 3D (hai tre, đúng công thức Đèn Mộc; D-073); có hiệu ứng nam châm, tiếng «tách», xoay vật thể; hỗ trợ nút auto-align nhẹ trên mobile, nhưng vẫn tương tác.
2. **Vẽ Nét Sáng** (MVP): chạm các điểm khắc theo thứ tự đã khám phá; phản hồi bằng một đường sáng chạy vòng quanh đèn. Câu đố thứ tự là từ dấu vết khi khám phá, kết nối hai mechanic.
3. **Nhuộm Giấy** (post-MVP): phối màu/sắp họa tiết; dùng các mẫu được nghiên cứu riêng và có thông tin nguồn.

### B6. Tránh học thành «bài kiểm tra»

- Sau nhiệm vụ có thẻ «Chuyện Đằng Sau» 50–100 từ (tự chọn đọc), tách **Sự thật văn hóa** và **Hư cấu trong thế giới Linh Phố**.
- Thông tin kiểm chứng qua nguồn đáng tin; người chơi vẫn hoàn thành puzzle không cần nhớ năm tháng/tên người.
- Bản địa hóa: các từ `tre`, `giấy dó`, `đèn`, `gốm` có diễn giải tiếng Anh ngắn, không chuyển thành bài giảng.

## C. Narrative và nội dung

### C1. Mở đầu

Người chơi nhận chìa khóa một cửa hàng bỏ trống. Một đêm, chiếc đèn của cửa tiệm soi ra những dấu chân không thuộc người sống. Bà Nghiêm, người giữ chợ, nói: «Linh Phố không biến mất. Nó chỉ quên cách được nhìn thấy». Bóng đèn nhỏ tên Bấc dẫn người chơi tới chiếc bảng hiệu còn dở dang. Mỗi lần sửa một món đồ, mảnh ký ức về khu chợ được trả về.

**Tông truyện:** kỳ ảo, ấm áp, bí ẩn dịu nhẹ, có hài hước; không khai thác niềm tin tín ngưỡng như sự thật khoa học. Sáng tác nhân vật linh vật riêng, tránh sao chép tạo hình tài sản trí tuệ.

### C2. NPC lõi

| ID | Tên / vai trò | Chức năng gameplay | Phong cách, hoạt ảnh |
|---|---|---|---|
| npc_ba_nghiem | Bà Nghiêm, người giữ chợ | onboarding, nhiệm vụ chính, unlock khu | áo dài cách điệu gam nâu, cầm chùm chìa khóa, điềm đạm |
| npc_bac | Bấc, linh đèn tinh nghịch | gợi ý puzzle, chỉ hướng, feedback | sinh vật ánh sáng nhỏ, bay lơ lửng, dễ dựng từ 3 meshes + particle |
| npc_co_lam | Cô Lam, thợ làm đèn | crafting, recipe, đặt hàng | trang phục vải mộc, tạp dề, động tác bàn tay |
| npc_ong_do | Ông Độ, người trông bến | khám phá, thu thập vật liệu, mini-quest | áo đơn giản, nón, cầm đèn và mái chèo |

**NPC mở rộng:** chủ quán trà, người làm gốm, nghệ nhân mộc, trẻ học việc, kẻ săn hiện vật (xung đột không bạo lực).

### C3. Ba nhiệm vụ MVP có thể triển khai

**Q00 — Đêm Mở Chợ (4–6 phút)**
- Trigger: load game lần đầu. Bà Nghiêm hướng dẫn di chuyển/gặp NPC.
- Objective: đến xưởng của Cô Lam -> nhặt 2 tre, 1 giấy, 1 dây từ vị trí rõ trên hub -> dùng bàn nghề lắp Đèn Mộc -> đặt vào chân đèn trước tiệm.
- Completion: khu vực cửa tiệm sáng thêm, mở HUD và nhiệm vụ Q01, trả 30 Xu Đèn.

**Q01 — Nét Mực Thất Lạc (6–8 phút)**
- Trigger: hoàn thành Q00, nói chuyện Cô Lam.
- Objective: dùng đèn Soi Linh thấy ba glyph tại cổng, cây cầu, bảng gỗ -> suy ra thứ tự từ đoạn hội thoại -> nhập đúng thứ tự ở bàn khắc -> chế tạo Đèn Vân Linh.
- Fail state: nhập sai chỉ reset puzzle, không trừ vật liệu; Bấc cho gợi ý theo cấp.
- Completion: mở công thức, tăng Uy Tín, kích hoạt vệt sáng trên cầu.

**Q02 — Phiên Chợ Đầu Tiên (5–7 phút)**
- Trigger: sau Q01. Nhận 2 đơn hàng từ NPC (ít nhất 1 món đã biết), giao đồ -> nhận Xu Đèn -> mua «Kệ Đèn» -> đặt kệ tự do trong ba vị trí snap được định sẵn.
- Completion: tiệm L1/L2 theo công thức cân bằng; kết thúc demo bằng một thay đổi rất rõ trong cảnh 3D và teaser chương 2.

**Đơn hàng tái chơi:** dùng danh sách 6 order authored từ 8 vật phẩm, đổi theo chu kỳ tiến trình trong game; không procedural text vô hạn ở MVP.

## D. Bản đồ và world-building

**Kích thước hub MVP giả định:** 60 × 60 mét, một scene duy nhất, không open world. Khu sông và góc hẻm là diorama có collider đơn giản; hạn chế object tương tác bằng tag.

```text
                        BẮC
          +--------------------------------+
          |  [B] Ngõ Giấy (future)         |
          |          |                     |
          | [C] Xưởng Lam ---- [D] Cổng Cũ |
          |    |           \               |
          |    |    [A] QUẢNG TRƯỜNG      |
          |    |       (Bà Nghiêm)         |
          | [E] Tiệm người chơi -- [F] Cầu |
          |                 |              |
          |              [G] Bến Sương     |
          +--------------------------------+
                        NAM
```

A Quảng trường: onboarding, giao NPC, điểm đẹp đầu tiên. B Ngõ Giấy: cổng vùng mở rộng. C Xưởng Lam: bàn chế tác. D Cổng Cũ: puzzle glyph 1. E Cửa Tiệm: upgrade/decoration. F Cầu: puzzle glyph 2, FX ánh sáng phản chiếu. G Bến Sương: NPC Ông Độ và vật liệu, giới hạn gameplay MVP.

**Các khu mở rộng sau MVP:**
- Ngõ Giấy: in tranh/giấy dó, puzzle nét khắc.
- Vườn Tre: thu thập và nhạc cụ; minigame vật lý nhẹ.
- Bến Sương: thuyền, lời nhắn thất lạc, vệt ký ức trên nước.
- Phố Mộc: ghép khóa, sản phẩm gỗ, unlock trang trí cửa tiệm.
- Gác Ký Ức: nội dung cốt truyện theo chương.

**Quy tắc mở rộng:** mỗi khu mới phải mang ít nhất một mechanic mới hoặc biến thể có ý nghĩa, 3 NPC tối đa, 4–6 quest có chất lượng; không thêm map chỉ để tăng diện tích.

## E. Art Bible 3D

### E1. Art direction

**Stylized diorama, hand-painted PBR tối giản:** geometry đơn giản, silhouette rõ, vật liệu gỗ/tường/gạch dễ nhận biết, chi tiết lớn thay cho hàng nghìn vật thể nhỏ. Lấy cảm hứng từ mái ngói, nhà gỗ, đèn tre, vật liệu nghề Việt; thế giới là hư cấu, không gộp kiến trúc vùng miền như một tái hiện lịch sử chuẩn.

**Bảng màu gợi ý** (tinh chỉnh theo color script): Night Navy `#18283B`, Deep Indigo `#283458`, Lantern Gold `#F2B759`, Warm Terracotta `#BC744E`, Jade Glow `#65D4BD`, Parchment `#E7D4AD`, Wood Brown `#76513A`. Khi chuyển chế độ đèn không thay đổi toàn bộ lighting/post-process tốn kém; dùng tint, emission, local FX.

**3 landmark luôn thấy:** đèn lớn ở quảng trường; cây cầu gỗ nhỏ với phản chiếu; bảng hiệu cửa tiệm có thể nâng cấp.

### E2. Asset budget ước tính kỹ thuật (không phải giới hạn engine)

| Loại | Số lượng MVP | Gợi ý mesh | Texture |
|---|---:|---:|---|
| Nhân vật player | 1 | 3k–8k triangles | 1 atlas 1024² |
| NPC dạng người | 3 | 2k–6k triangles/NPC | có thể chia sẻ atlas 1024² |
| Bấc linh đèn | 1 | 100–500 triangles | màu vertex/unlit |
| Nhà modular | 4–6 | 2k–8k triangles/building | atlas 2048² chung |
| Props | 25–35 mẫu | 50–1500 triangles/prop | atlas 1024–2048² |
| Đèn craftable | 2 mẫu | 300–1500 triangles | atlas props |
| FX | 4–6 | billboards/particles nhẹ | atlas sprite ≤1024² |

Chỉ tiêu đo thực tế: 60fps desktop trung cấp / ≥30fps điện thoại tầm trung có hỗ trợ phù hợp; giảm draw calls, texture memory, shadow casters; đặt quality preset low/high. Mục tiêu ban đầu ≤20MB tải trước khi vào gameplay nếu hướng CrazyGames mobile homepage; không tải hết world expansions trước. Giới hạn nền tảng có thể thay đổi, cần kiểm tra lúc phát hành.

### E3. Blender → Web

1. Blender 1 unit = 1m. Model hướng mặt về quy ước duy nhất; xuất glTF 2.0 `.glb`, kiểm tra trục chuyển Z-up/engine Y-up khi import.
2. Naming: `ENV_House_A`, `PROP_Lantern_01`, `CHAR_NPC_Lam`, `COL_...`, animation `Idle`, `Walk`, `Interact`, `Craft`.
3. Origin ở chân/tâm tương tác; áp dụng transforms; mesh collider đơn giản riêng, không dùng triangle collider cho mọi vật.
4. Vật liệu PBR tương thích glTF (Base Color, Metallic/Roughness, Normal, Emissive); shader node phức tạp không đảm bảo export.
5. Export/test từng `.glb` bằng viewer trước tích hợp; cân nhắc nén mesh/texture **sau** khi kiểm thử import và tương thích trên máy thật.
6. Ánh sáng tĩnh baked/precomputed, hiệu ứng realtime tối thiểu; đèn trang trí có emissive + rất ít đèn thật; tránh nhiều shadow-casting point lights.
7. Modular kit cần có: nền gạch 2x2, bờ sông 2 đoạn, tường 2 loại, mái 2 loại, cột, cửa, biển hiệu trống, giàn đèn, xe hàng, cầu 1, bụi cây 3, chậu 2.

**Quy chuẩn visual acceptance:** đọc được khu vực di chuyển ở camera 3/4, không bị cháy sáng glow, NPC nổi bật hơn background, màu UI contrast tốt, animation có anticipation/reaction, không dựa vào nhiều polygons.

## F. UX/UI

**HUD desktop:** top-left danh sách 1 nhiệm vụ + progress; top-right Xu Đèn, Uy Tín và nút cài đặt; bottom-left phím thao tác nhỏ chỉ khi cần; bottom-center inventory quick slots; bottom-right đèn hiện trạng thái, interact affordance ở gần NPC. Dialogue card ở đáy màn hình, giữ 3D scene phía sau.

**HUD mobile:** virtual joystick trái dưới, nút Đèn + Tương tác phải dưới, nhiệm vụ góc trái trên có thể thu gọn; nút inventory ở mép trên; tap targets tối thiểu ~44CSS px (gợi ý), safe-area, chữ Việt không quá nhỏ.

**Các màn hình:** loading ≤ 1 nút để vào chơi; title nhỏ; HUD; dialogue; inventory/crafting; journal/cultural-card; shop placement; pause/settings; optional accessibility menu. Tutorial qua hành động, không slideshow dài.

**Âm thanh/feel:** ambience tiếng nước, tiếng rao mơ hồ, côn trùng đêm; SFX tre gõ nhẹ, giấy, tiếng chuông khi mở dấu vết; music loop 50–90s tiết tấu nhẹ. Không lấy nhạc dân gian thu âm có bản quyền mà không có phép.

## G. Kỹ thuật web-first

### G1. Stack chốt

- Engine: **PlayCanvas Engine standalone** thông qua NPM, với TypeScript, không lệ thuộc PlayCanvas Editor. Dùng WebGL2 làm baseline; bật thử WebGPU khi phù hợp; có fallback.
- UI: **React + TypeScript + Vite**, Zustand (UI/session state) hoặc store nhỏ tương đương. Đừng để React render 3D game objects mỗi frame.
- Gameplay: các system TypeScript tách riêng + event bus typed + static `data/*.json`. Không cần ECS tự viết phức tạp.
- Save: `SavePort` gồm `LocalSaveAdapter` qua IndexedDB, fallback localStorage cho save nhỏ; version & migration. Sau này `CrazyGamesSaveAdapter`/`CloudSaveAdapter` theo nền tảng, không trộn API nền tảng vào gameplay.
- Hosting: static hosting + CDN assets (Cloudflare Pages/Vercel hoặc tương đương); API chỉ khi thật sự cần; tránh server-authoritative MMO trong MVP.
- Analytics: privacy-aware event counts / game session; prompt consent khi dùng dịch vụ cần consent, không đưa thông tin cá nhân vào event.
- Testing: Vitest unit cho domain, Playwright smoke for game loading + HUD; kiểm tra thủ công desktop/mobile GPU.

### G2. Sơ đồ phụ thuộc

```text
Browser
├── React HUD / Menus / Accessibility
│    ↕ Typed event facade (commands + domain events)
├── Game application (game loop + orchestration)
│    ├── Player / Camera / Interaction
│    ├── Lantern Phase / Puzzle
│    ├── Dialogue / Quest / Inventory / Crafting
│    ├── Shop / Progression / Unlocks
│    ├── Audio / VFX / Localization
│    └── SavePort / AnalyticsPort / PlatformPort
└── PlayCanvas rendering scene + GLB assets
      ↕ asset manifest + scene anchors (IDs)
```

**Điểm cực kỳ quan trọng:** content JSON là source of truth cho NPC/dialogue/quest/item/recipe. `QuestSystem` không hard-code câu thoại/scene entity. Các module không import React vào domain. Không để store đổi trực tiếp vị trí 3D mỗi frame.

### G3. Repo layout

```text
linh-pho/
├── public/
│   └── assets/{models,textures,audio,icons}/
├── src/
│   ├── app/{bootstrap.ts,GameApp.ts,services.ts}
│   ├── engine/{scene,assets,camera,player,interaction,phase,fx}/
│   ├── domain/{inventory,quest,crafting,shop,progression}/
│   ├── content/{items.json,recipes.json,npcs.json,quests.json,dialogues.json,locales/}
│   ├── ports/{SavePort.ts,PlatformPort.ts,AnalyticsPort.ts}/
│   ├── adapters/{LocalSaveAdapter.ts,WebPlatformAdapter.ts}/
│   ├── ui/{hud,dialogue,inventory,crafting,journal,settings}/
│   ├── shared/{types,events,schemas,utils}/
│   └── tests/
├── docs/{GDD.md,ART_BIBLE.md,CONTENT_SCHEMA.md,DECISIONS.md,PROGRESS.md}
└── package.json
```

### G4. Content contracts tối thiểu

```ts
export type Phase = 'real' | 'spirit';
export type ItemId = string;
export type QuestId = string;

export interface ItemDefinition {
  id: ItemId; nameKey: string; icon: string; stackLimit: number;
  tags: string[]; sellValue: number;
}
export interface RecipeDefinition {
  id: string; inputs: Array<{itemId: ItemId; quantity: number}>;
  output: {itemId: ItemId; quantity: number}; stationId: string;
  miniGameId: 'assembly' | 'engraving';
}
export interface QuestDefinition {
  id: QuestId; prerequisiteQuestIds: QuestId[];
  objectives: Array<{id: string; type: 'talk'|'collect'|'craft'|'phase_scan'|'deliver'|'place'; targetId: string; count: number}>;
  rewards: {coins: number; reputation: number; items?: Array<{itemId: ItemId; quantity: number}>};
}
export interface SaveV1 {
  schemaVersion: 1; updatedAt: string;
  playerPosition: [number, number, number]; phase: Phase;
  inventory: Record<ItemId, number>;
  questStates: Record<QuestId, {status:'locked'|'active'|'completed'; objectiveProgress:Record<string, number>}>;
  shopLevel: number; decorations: Array<{instanceId:string; itemId:string; slotId:string}>;
  coins: number; reputation: number; flags: Record<string, boolean>;
}
```

**Validation:** assert schema runtime (Zod or hand-written) on load; migrations, unknown IDs handled gracefully, in-progress crafting with atomic commit after success. Quest steps deterministic/idempotent: triggering event twice does not award twice.

### G5. Kiểm thử/pipeline

- Start app: load base scene, spawn player; console không lỗi; desktop WASD / mobile joystick; scene remains responsive if an asset fails.
- Camera: no clipping, no jump, no input bleed through modal.
- Lantern: switching phases is deterministic; colliders don't trap player; id tags resolve.
- Quest: 3 quest runs and reloaded mid-quest; can't duplicate rewards.
- Crafting: invalid resource inputs rejected; successful craft charges once and grants once.
- Save: version migration test; no lose progress after refresh in same browser.
- Publishing: gzip/brotli static builds, hashed assets, load metrics, accessibility settings and mobile controls.

## H. MVP 8–12 weeks: planning, scope, exit gates

| Giai đoạn | Deliverable | Chốt chuyển giai đoạn |
|---|---|---|
| W1 | Vite + PlayCanvas + React, game loop, asset placeholders | chạy `npm run dev`; deploy preview |
| W2 | 60×60 hub blockout + controller + camera + NPC anchors | đi vòng map, không kẹt/clip |
| W3 | Tương tác E/tap, hội thoại data-driven, nhiệm vụ Q00 | complete Q00 1 lần |
| W4 | Inventory + recipe + crafting lắp khung | craft từ vật liệu thật |
| W5 | Đèn Soi Linh và puzzle ba dấu vết | hoàn thành Q01 ổn định |
| W6 | Shop state + decoration + quest Q02 | 3 quest end-to-end |
| W7 | Assets 3D đầu tiên, skeleton animation, VFX lighting | nhìn tốt từ camera mặc định |
| W8 | Âm thanh, tutorial, UX/HUD desktop, bản tiếng Anh tối thiểu | build chơi thử ~15–20 phút |
| W9 | Mobile controls, quality presets, optimization | >=30fps mobile thử nghiệm |
| W10 | Save/migration, QA regression, error recovery | reload giữ tiến trình |
| W11 | Playtest 10–20 người, analytics + sửa điểm nghẽn | onboarding và nhiệm vụ rõ |
| W12 | Landing, trailer ngắn, publish thử ở web riêng | người ngoài chơi không cần hướng dẫn |

**Thực tế tiến độ:** 8–12 tuần là giả định làm gần toàn thời gian, thành thạo web và sử dụng nhiều asset tạm; nếu chỉ làm buổi tối/cuối tuần nên dự trù 4–6 tháng hoặc cắt 1 minigame, 1 quest.

### MVP scope lock

- 1 hub 60×60; 1 playable character; 3 human NPC + 1 sprite Bấc; 3 quest có thoại; 2 minigame; 8 items; 2 recipes; 1 lantern two-state mechanic; 5 shop decorations (sử dụng 3 vị trí snap ban đầu); local save; desktop+mobile web.
- Không làm full cosmetics store/remote backend trong MVP.

### Release metrics (giả thuyết cần xác thực)

- 80% new users có thể di chuyển/tương tác trong 1 phút đầu;
- ≥60% người chơi mới kết thúc Q00; ≥30% hoàn thành chuỗi Q00–Q02;
- trung vị một phiên chơi tối thiểu 8 phút; crash-free sessions mục tiêu ≥99%; tỷ lệ quay lại ngày sau đo để hiểu hành vi, không chốt thành cam kết.
- Thu thập feedback: 1–5 «game có hấp dẫn?», «quá khó/dễ?», «mắt có bị mỏi?», «có muốn chơi tiếp không?». Mỗi mục tiêu sẽ điều chỉnh sau playtest.

## I. Monetization & phát hành

**Stage 0 (MVP):** miễn phí, không quảng cáo, 1 câu chuyện hoàn chỉnh có teaser. Mục tiêu đo trải nghiệm, tỷ lệ hoàn thành, phản hồi.

**Stage 1 (own domain):** bản demo miễn phí và gói chương trả phí hoặc cosmetic không tăng sức mạnh. Ví dụ thử định giá chương nội dung 39k–79k VND; thử nghiệm A/B trên nhóm chấp thuận, chưa phải giá thị trường đã xác minh.

**Stage 2 (CrazyGames):** phát hành phiên bản đã tối ưu, thiết kế monetization theo SDK và chính sách nền tảng; Basic Launch không quảng cáo/không chia sẻ doanh thu, chỉ Full Launch đủ điều kiện; in-game purchases chỉ cho game được mời/chấp thuận. Ở phiên bản portal, tránh đặt login/payment ngoài nền tảng. Ad thưởng chỉ ở điểm dừng tự nhiên sau nhiệm vụ, không thay đổi chất lượng trải nghiệm cơ bản.

**Stage 3:** mobile PWA trước, cân nhắc native wrapper hoặc build native nếu đã có bằng chứng người chơi; không mặc định PlayCanvas web -> native ứng dụng game tương đương miễn phí.

**Chi phí và rủi ro:** thời gian mỹ thuật, nhạc/SFX có license, hosting CDN, QA trên nhiều điện thoại, dịch thuật, phân phối và legal/compliance thường tốn hơn phần dựng CRUD/code. Chỉ mua asset khi xác nhận điều khoản thương mại và cho phép phân phối trong sản phẩm đóng gói.

**Pháp lý Việt Nam:** Cơ chế phân loại/điều kiện phát hành game trên mạng tại Việt Nam tuân theo Nghị định 147/2024/NĐ-CP và hướng dẫn hiện hành; game web không tự động miễn nghĩa vụ. Phân loại G1/G2/G3/G4 phụ thuộc hệ tương tác thực tế và mô hình dịch vụ; xin tư vấn pháp lý trước khi thương mại hóa, đặc biệt nếu dùng tài khoản/server/giao dịch. Thiết kế lịch sử-văn hóa có rà soát nguồn, quyền hình ảnh/âm nhạc và thương hiệu riêng.

## J. Phạm vi mở rộng 12 tháng theo nhu cầu thực tế

- **Season 1 – Đêm Khai Phố:** 1 hub, Q00–Q02 (vertical slice), sau đó 8 quest, 2 mini-games mới.
- **Season 2 – Ngõ Giấy:** 1 khu nhỏ, mini-game in/vẽ họa tiết và 2 NPC; mở khu trưng bày.
- **Season 3 – Bến Sương:** puzzle phản chiếu mặt nước, nhiệm vụ giao nhận bằng thuyền trên tuyến ngắn (không mô phỏng vật lý nước phức tạp).
- **Season 4 – Phố Mộc:** modular crafting mới, đồ trang trí trả phí/earned; phải kiểm tra nhu cầu người chơi trước khi triển khai.

**Thứ tự ưu tiên khi thiếu thời gian:** cảm giác điều khiển > mạch Q00–Q02 > camera/đèn > save > art polish ở 1 hub > responsive > audio > content expansion > thanh toán.

## K. Link tài liệu kỹ thuật và kiểm chứng quy định (kiểm tra tháng 10/2026)

- PlayCanvas standalone: https://developer.playcanvas.com/user-manual/engine/standalone/
- PlayCanvas browser support: https://developer.playcanvas.com/user-manual/engine/supported-browsers/
- Blender glTF 2.0: https://docs.blender.org/manual/en/5.3/addons/scene_gltf2.html
- CrazyGames technical: https://docs.crazygames.com/requirements/technical/
- CrazyGames launch/monetization: https://docs.crazygames.com/requirements/intro/
- CrazyGames advertisement: https://docs.crazygames.com/requirements/ads/
- Portal quản lý game VN (tóm tắt pháp lý): https://game.gov.vn/tin-tuc/current-regulations-on-online-video-games-government-decree-1472024nd-cp-on-the-management-provision-and-use-of-internet-services-and-cyber-information-decree-147-38n3

---
**Quyết định cuối v1.0:** Làm game single-player web-first bằng PlayCanvas Engine standalone + React + TypeScript. Bắt đầu từ hub blockout 3D không asset đẹp; hoàn thành gameplay Q00 trước khi tốn thời gian dựng cảnh. Art final chỉ sau khi loop chơi thử đáng giữ lại.
