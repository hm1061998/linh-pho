# LINH PHỐ — Blender Art Bible + Production Prompts v1.0

> Mục tiêu: ra asset 3D **dựng thật được**, tối ưu cho PlayCanvas WebGL2; KHÔNG lấy tranh AI 2D làm mục tiêu đòi hỏi render realtime khó khả thi. Phần mềm: Blender, có thể dùng Python scripting cho modular scenes, rig/animation thủ công với hỗ trợ AI.

## 1. Visual target

- Stylized 3D diorama, tỷ lệ đồ vật hơi cách điệu; shape language: mái cong vừa, thân nhà gọn, cạnh bo ít bevel, vật liệu mờ, gỗ sáng, điểm nhấn đèn phát quang và sắc ngọc.
- Màu: Night Navy `#18283B`, Deep Indigo `#283458`, Lantern Gold `#F2B759`, Terracotta `#BC744E`, Jade `#65D4BD`, Paper `#E7D4AD`, Wood Brown `#76513A`. Không đồng nhất tất cả mái kiểu cổ; dùng cảm hứng từ vật liệu Việt, không gán khu phố là mô phỏng chính xác Hội An/Hà Nội.
- 3 tầng hình: foreground shop frame / midground đường và NPC / distant simple rooftops. Không phủ neon, không bloom quá mạnh. Quy tắc: gameplay objects ưu tiên tương phản hơn decorative props.

## 2. Working conventions

- Đơn vị trong Blender: 1 Blender unit = 1 mét, nhân vật player cao 1.7–1.8m; nhà 1 tầng cao 3–4m, gian hàng 2.5–3.5m; đèn cầm tay 0.3–0.45m.
- Pivot: căn giữa mặt sàn của object tĩnh, ở dưới chân nhân vật; cánh cửa xoay pivot ở mép bản lề; đối tượng cầm tay đặt trong một socket transform khi import.
- Naming asset: `ENV_Wall_A`, `ENV_Roof_B`, `PROP_Lantern_Craft_A`, `NPC_CoLam`, `FX_SpiritTrail_A`, `COL_*`. Texture/mat: `MAT_WoodWarm_A`, `TEX_EnvAtlas_01`.
- Exports: `.blend` source và `.glb` runtime; apply transforms; triangles budget check; no unsupported Blender procedural shader without baking. PBR: base color / roughness / metallic / normal / emissive.
- Physics: box/capsule colliders tạo trong PlayCanvas hoặc exported proxy objects, không mặc định toàn mesh là collider.
- Shader: opaque ưu tiên; phần kính giấy dùng alpha clip/dither tiết chế; tránh alpha-blended hàng lớp; không quá nhiều shadow casting point lights.
- Test GLB in browser viewer on desktop and Android before batch modelling. Nếu vật liệu hoặc orientation sai, sửa pipeline đầu tiên.

## 3. Modular asset inventory

| Asset | Số loại | Kích thước gợi ý | Ngân sách triangles/model |
|---|---:|---|---:|
| Nền gạch 2×2m, nền đất | 2 | 2×2m | 2–100 |
| Tường nhà, cột, cửa, cửa sổ | 8 | grid 1/2/4m | 50–500 |
| Mái ngói 2 mẫu | 2 | 4m wide segment | 300–1000 |
| Nhà hoàn thiện ghép kit | 4 | 5×7m footprint | 2k–8k |
| Gian hàng nhỏ | 3 | 2.5×3m | 800–3k |
| Cầu gỗ | 1 | 6×2m | 600–2500 |
| Quầy xưởng và kệ | 4 | 1–2m | 300–1500 |
| Đèn tre treo | 3 | 0.35m | 150–700 |
| Chậu cây, cỏ, đá | 8 | 0.2–1.5m | 100–900 |
| Player | 1 | 1.75m tall | 3k–8k |
| NPC human | 3 | 1.55–1.8m | 2k–6k |
| Bấc companion | 1 | 0.35m | 100–500 |
| Craft lantern items | 2 | 0.35–0.45m | 300–1500 |

Lưu ý: mesh budget là mục tiêu thử nghiệm; file size/draw call/texture có thể quan trọng hơn số triangles. Lặp kit cần instance và atlas phù hợp.

## 4. Lighting recipe thực tế

- Global ambience indigo + warm key directional từ góc trên trái để đọc hình khối, giảm nhu cầu điểm sáng realtime.
- Đèn lồng = emissive mesh + glow sprite/card + *chỉ một số* actual local lights ở landmark; baked lighting/ambient occlusion cho các công trình tĩnh.
- Trong chế độ Ánh Linh, dùng color grading nhẹ + bật sprite đường chỉ dẫn + outline/emissive các props được tag; không đổi cả environment bằng volumetric fog nặng.
- Particles: vài chục sprite có vòng đời ngắn và animation UV, tránh hàng nghìn glowing particles; low preset giảm 50–80% particle.
- Tương tác có 4 lớp feedback: anticipation 0.1s, action 0.2–0.5s, impact SFX+VFX 0.1s, settle; thời gian chỉ để tuning, không phải yêu cầu animation frame-by-frame bắt buộc.

## 5. Rig / animation

- Player: `Idle` (nhịp thở/shift), `Walk` (2 chân rõ), `Interact` (vươn tay), `Craft` (sửa vật), `Celebrate` (thành công), `Look` (xoay đầu nếu rig hỗ trợ). 5 clip đầu là đủ; không cần 8 hướng sprite vì là 3D.
- NPC: reuse armature nếu proportions phù hợp; `Idle`, `Talk`, `GiveItem` với đạo cụ tách mesh; không cần mocap chất lượng cao.
- Bấc: hover sin curve, squash & stretch mesh và trail particle, animate bằng engine; không cần skeleton.
- Sau mỗi hành động quan trọng có reaction của đèn/cửa tiệm, nhưng không khóa người chơi trong cinematic dài.

## 6. Prompts thực thi dành cho AI coding với Blender Python

### BLENDER-P01 — Modular house kit

```text
You are a Blender technical artist who produces actual editable meshes and a reusable Python script, NOT an image. Create a modular stylized Vietnamese-inspired fictional night-market building kit: 2m wall pieces, 1m corner columns, 2 roof sections, doorway, shutter window, display shelf, blank signboard and warm clay/wood materials. One Blender unit = one meter, origin on ground, snap to 1m grid. Use bevels sparingly and broad readable silhouette, no texture-dependent tiny details. Keep <= 10k tris for an assembled two-story building and <= 2k triangles per modular piece where practical. Use simple Principled BSDF or unlit/emissive materials compatible with glTF export. Save source .blend and export each component as .glb; output an asset manifest with dimensions, triangle counts, material slots and preview render. If Blender isn't available, generate script only and clearly say it wasn't executed.
```

### BLENDER-P02 — Main street scene composition

```text
Using approved modular pieces from the repository, write a Blender Python scene-building script for one 60m x 60m stylized nighttime market blockout with: central square, four stalls, small bridge, riverside boundary, craft workshop, player's shop, gate and NPC interaction anchors. Keep navigable main roads >= 2m wide, no extreme camera occlusion at 45-degree gameplay angle. Use instancing/reuse rather than unique expensive models. Set initial preview camera orthographic 3/4 and three light groups (ambient, key, warm lantern emissive). Export static environment and collider proxies separately as GLB. Provide triangle statistics and ensure each named anchor position is captured in a JSON manifest for game code.
```

### BLENDER-P03 — Crafted bamboo lantern model

```text
Model ONE handcrafted fantasy bamboo lantern that could plausibly be assembled from simple parts in Blender: 0.42m tall, octagonal or hexagonal frame, simplified bamboo ribs, top/bottom ring, translucent-looking paper panels using web-compatible materials, internal emissive bulb, hanging loop. Produce two cosmetic variants sharing mesh topology (natural amber, jade spirit glow), with separate snap/socket markers for 3D assembly minigame (`socket_frame_1`, `socket_frame_2`, `socket_paper`). Avoid unnecessary subsurf and glass refraction; use 300–1500 triangles target and <=2 materials if possible. Export .blend, .glb, provide named parts, screenshots and mesh count. Do not rely on Blender-only procedural nodes that disappear in GLB.
```

### BLENDER-P04 — Player and NPC stylized character

```text
Create a simple friendly stylized full-body character suitable for a cozy Vietnamese-inspired 3D fantasy game, with rounded silhouette and expressive face, wearing original neutral traditional-fabric-inspired clothes but NOT claiming accurate historical reconstruction. Height 1.75m, body proportions stylized ~4.5–5 heads, <=8k triangles, shared skeleton plan, no layered physics cloth. A-pose for rigging, clean topology around shoulder/elbow/knee, 1024x1024 texture atlas target, PBR compatible. Specify rig hierarchy and animations Idle/Walk/Interact/Craft. Export `.blend` and `.glb` with correct orientation for PlayCanvas. If rigging/animation not implementable with available tools, deliver validated model plus explicit TODOs, no fabricated claim.
```

### BLENDER-P05 — NPC Bấc + FX

```text
Create Bấc, an ORIGINAL cute floating lantern-wick spirit companion, built from 3–5 simple meshes: rounded paper-like body, short wick tuft, expressive eyes, glowing amber core and tiny teal highlight. At 0.35m high, <=500 triangles, no transparent nesting, no skeletal rig. Output .blend and .glb with named core/eyes/wick meshes, pivot at center, plus procedural hover/squash-and-stretch algorithm description in TypeScript or pseudocode to animate in PlayCanvas. Do not copy any recognizable mascot design or religious iconography.
```

### BLENDER-P06 — Asset QA / batch export

```text
Inspect every `.blend` in the asset folder and produce a batch export + QA report: report each mesh dimensions, applied scale, tris, texture size, object origins, material count and animation names; detect non-manifold geometry if present, missing texture paths, unsupported shader nodes and inconsistent naming. Export `.glb` to `/public/assets/models/` and write a JSON manifest with asset ID/path, expected bounds and required animations. Do not overwrite source `.blend` files. Run validation with Blender in headless mode if available; otherwise provide the exact command and mark results unverified.
```

## 7. What makes a beautiful result in the real runtime?

Không yêu cầu AI dựng 200 props ngay. Làm **một góc chợ đạt chất lượng showcase** với 1 nhà, 1 gian, 1 cầu, 1 NPC, 10 đèn; test gameplay camera và FPS. Sau khi góc này tốt, nhân bộ modular kit ra hub. Đặt yêu cầu xem ảnh **chụp từ web runtime**, không chấp nhận render Cycles ngoài game thay thế bằng chứng về hiệu năng.

## 8. Bản quyền & sử dụng thương mại

Không sao chép trực tiếp scene/character từ ảnh trên internet. Dùng ảnh chỉ làm mood reference; kiểm tra riêng license model/texture/animation/music và quyền dùng thương mại/phái sinh/tái phân phối trong game. Giữ file ghi nguồn, license, URL, ngày tải của mỗi asset bên thứ ba.
