# LINH PHỐ — AI CODING PROMPT KIT v1.0

Sử dụng cùng với `LINH_PHO_GDD_v1.md`. Dán **PROMPT 00** vào AI Coding Agent (Codex, Claude Code, Cursor, v.v.), sau đó giao lần lượt **01–11**. Mỗi lần chỉ làm **một module** rồi chạy kiểm thử và commit. Không yêu cầu AI tạo một game hoàn chỉnh trong một lượt.

## PROMPT 00 — System context / rules of engagement

```text
You are lead TypeScript web game engineer for LINH PHO, a Vietnamese-inspired stylized 3D single-player cozy RPG. Read LINH_PHO_GDD_v1.md before coding. Our stack is PlayCanvas Engine standalone via NPM, Vite, TypeScript strict, React for HUD (not for per-frame 3D), data-driven JSON content, domain modules and typed adapters.

Hard constraints:
1. Web-first; desktop Chrome/Edge and mobile browser. WebGL2 baseline, optional WebGPU with fallback. Never assume WebGPU availability.
2. No Unity, no Babylon.js, no invented SDK packages, no external paid service without asking.
3. Keep all gameplay deterministic and local first; quest rewards atomic/idempotent. Offline single-player demo; no multiplayer/chat/payment/backend until requested.
4. Content-driven: item/quest/recipe/dialogue files must be separate from rendering; use stable IDs.
5. Keep input focus correct: movement disabled when dialogue, crafting or pause modal blocks gameplay.
6. All 3D assets must have graceful placeholder fallbacks (primitive meshes). Do not block gameplay for missing GLB.
7. Do not duplicate engine instances or animation loops on hot reload; dispose listeners/assets on teardown.
8. Every change: state exact files modified; explain design decisions, commands run, evidence of test results; never claim tests passed if not executed.
9. No monolithic app.ts. Implement behind typed ports and minimal interfaces. Keep current work running before adding new feature.
10. Use Vietnamese strings in locale files and reserve English counterparts. No hard-coded copy in domain/game systems.
11. Maintain /docs/PROGRESS.md with completed features, known issues and next task; /docs/DECISIONS.md with nontrivial architecture decisions.
12. Build visuals with real constraints: avoid excessive dynamic lights/shadows, use atlas-friendly materials, mobile quality preset.

Workflow for each requested module:
A. Inspect repo and existing contracts. B. Propose short plan (3-7 steps). C. Implement only named module. D. Add minimum tests. E. Run typecheck/test/build; report actual results. F. Give manual browser acceptance checklist. Do not change unrelated modules without describing why.
```

## PROMPT 01 — Bootstrap + rendering scene

```text
Implement only the working foundation. Create Vite + React + TS strict project with PlayCanvas Engine standalone installed through npm. Mount one canvas below a transparent React HUD root. Start and stop the PlayCanvas application correctly; handle resizing, device pixel ratio cap, visibility changes, WebGL2 fallback and graceful errors. Render a procedural 60m x 60m low-poly nighttime marketplace blockout using primitive meshes; add a directional/ambient lighting setup and visible placeholder house/stall/lantern. Keep all project code organized according to GDD repository layout. Provide scripts dev/build/typecheck/test. Make no quest/combat yet.
Acceptance: `npm run dev` works; one browser game canvas renders; resize doesn't stretch; no duplicate RAF listeners during HMR; fallback error if WebGL2 unavailable; `npm run build` passes.
```

## PROMPT 02 — Character controller, collision, camera, mobile input

```text
Implement PlayerController, CameraController and InputService. Keyboard WASD movement relative to 3/4 camera, smoothing + collision against simple static obstacles. Camera follows player with fixed tilt (~45 deg), bounded zoom, smooth follow, never crosses map bounds. Add controls for arrow keys/WASD, touch joystick, mobile interact button placeholder; pause game input while modal focused; support keyboard focus. Use placeholder capsule character (GLB loaded later); split input from movement logic to allow gamepad later.
Acceptance: can traverse 60x60 hub without crossing walls or clipping camera, keyboard and touch input work, no player drifting after losing focus, fixed time-step or dt clamping prevents huge teleport after tab switch.
```

## PROMPT 03 — Interaction and dialogue

```text
Build an InteractionSystem with stable interaction IDs, range checking and one active target. Show unobtrusive contextual E/touch hint when a player is within 2m (configurable) of a target. Define JSON dialogue nodes with localized text, speaker ID, optional choices, conditions, and effects; implement DialogueSystem and React DialoguePanel. Make 4 placeholder NPC: npc_ba_nghiem, npc_co_lam, npc_ong_do, npc_bac. Interaction events should be typed and independent from HUD component implementation.
Acceptance: E/touch opens the correct NPC dialogue; closes with Escape/tap; movement blocked while dialogue open; interaction not triggered outside range; missing ID/content yields safe error without crashing.
```

## PROMPT 04 — Inventory, recipes, QuestSystem + Q00

```text
Implement inventory (stacking, capacity limit optional), item definitions/recipes in JSON, schema validation and QuestSystem with declarative objectives and event-based progress. Implement Q00 from GDD fully: interact -> collect 2 bamboo, 1 paper, 1 rope -> craft lantern (temporary single confirm button until minigame module) -> place at store. Grant exactly 30 coins and unlock Q01. Prohibit duplicate rewards; persist quest completion through a SavePort stub until Module 08.
Acceptance: collect once only per spawn, inventory never negative; cannot craft without ingredients; complete Q00 only in correct order; reward isn't granted on second event; provide Vitest tests for these rules.
```

## PROMPT 05 — Lantern Phase + Q01 puzzle

```text
Implement LanternPhaseSystem with real/spirit states, transition lock, and tagging mesh entities as real|spirit|both. Toggle on Q/touch, use an inexpensive screen tint/emissive animation and 1 sprite-style particle effect. In spirit state, reveal 3 clues placed at Gate, Bridge and a signboard; build a 3-symbol-order puzzle driven by content JSON. Solving triggers Q01 and unlocks recipe for Spirit Pattern Lantern. Prevent changing active colliders around player into solid meshes trapping them.
Acceptance: 20 rapid toggles never break state; clues only appear in spirit; puzzle wrong order can retry, no resource penalty; Q01 completes once, phase survives save restore when saved; supports reduced VFX setting.
```

## PROMPT 06 — Two crafting mini-games

```text
Replace crafting confirmation stub with reusable minigames:
- `assembly`: place 3 bamboo parts into highlighted snap sockets on a rotating 3D lamp frame, using pointer/touch interaction; strong snap feedback.
- `engraving`: activate sequence of 3 glowing marks in order learned from Lantern puzzle.
Keep minigame state separate from inventory transactions: inputs reserved but consumed exactly once only on success; fail/cancel returns to previous state with no duplicate result; completion gives quality Normal/Good/Perfect based on action accuracy/time with generous thresholds. Use placeholder geometry and UI if needed.
Acceptance: both work mouse and touch; cancellation doesn't lose resources; repeated clicks after completion can't duplicate items; typecheck/build/tests.
```

## PROMPT 07 — Shop decorations, upgrade + Q02

```text
Implement shop layout with three fixed decoration sockets, five furniture definitions, purchase with earned coins only, upgrades that modify 3D visible scene elements. Add 2 deterministic customer orders and Q02: take, craft/deliver, earn coins, buy and place Lantern Shelf. Mark MVP end with completion screen and chapter teaser. All order and furniture data in JSON. Ensure placement, payments and rewards are atomic; no paid currency or actual payment integration.
Acceptance: correct coin deduction, no negative balances, one decoration per slot; Q02 is replay-safe; before/after store looks visibly different; restart keeps state once SavePort connected.
```

## PROMPT 08 — Save, localization, sound, UX and recoverability

```text
Implement versioned SaveV1 matching GDD through SavePort and LocalSaveAdapter. IndexedDB primary storage; localStorage fallback for a small JSON save. Autosave after quest steps, crafts and decor changes; don't serialize PlayCanvas runtime objects. Add vi/en locale files, audio settings and simple accessible HUD panels (quest tracker, lantern state, currency, inventory, pause). Missing asset and invalid save handle gracefully; offer restart progress with explicit confirmation. Include migration/validation tests and recovery after refresh mid-Q01.
Acceptance: refresh mid-quest resumes; toggled language persists; no React/game input conflict; corrupted save triggers a recovery flow, not a blank game.
```

## PROMPT 09 — Blender asset handoff + visuals

```text
Do not generate arbitrary image placeholders and pretend they are production models. Create a strict ASSET_MANIFEST.md and Blender asset brief describing every GLB needed for the MVP: dimensions, mesh budgets, material atlas, pivot/orientation, names, skeleton animations and collider geometry. Implement runtime asset loader with GLB and primitive fallback. Swap assets one at a time and provide an in-browser asset inspection/dev scene. Implement lightmap-compatible stylized lighting, emission for lanterns, safe color grading and low/mobile quality presets. Avoid platform-specific shaders unless fallback exists.
Acceptance: removing any optional GLB won't crash game; at least one production-format test GLB imports successfully; missing animation falls back to idle; stats overlay shows fps/draw calls where available.
```

## PROMPT 10 — Performance, QA, smoke tests, accessibility

```text
Profile actual game on desktop Chromium and at least one real midrange Android phone if available; otherwise explicitly mark untested. Optimize visible objects, meshes, texture memory, quality settings, asset loading. Target <=20MB initial download for mobile-portal ambitions, with lazy-loaded later assets, 30fps mobile and 60fps desktop as test goals. Add smoke tests for launch, dialogue UI, inventory, quest progress; unit tests for event handlers, item transactions, quest idempotency and save migration. Add keyboard remap if easy, text scaling and reduced VFX option.
Acceptance: export build and provide actual bundle report; no missing assets/404s; screenshots or measured outcomes; list devices tested and limitations. Never fabricate performance measurements.
```

## PROMPT 11 — Deployment + analytics + platform adapters

```text
Build production deploy for own static website with hashed assets, cache strategy, SPA fallback and optional PWA installability. Implement AnalyticsPort and local no-op adapter; events: session_start, tutorial_move, first_npc_talk, lantern_toggle, q00_complete, q01_complete, q02_complete, session_end; no PII. Create PlatformPort for own website vs future CrazyGames adapter. Do NOT wire live ads or payment yet, but document exact future integration points and permission-dependent UX. Produce release checklist and evidence from a real staging URL only if deploy access is available.
Acceptance: own-domain build runs without game portal SDK; analytics doesn't block gameplay; privacy policy placeholder is clearly marked as needing review; portal behavior gated behind adapter.
```

## PROMPT 12 — Scriptwriter / Vietnamese culture research and localization

```text
Act as a cultural researcher + game narrative editor. Draft quest dialogues and optional Story Behind cards for bamboo craft, paper traditions and lantern making with two explicitly separate sections: verified real-world info (with verifiable primary/credible citations to collect manually) and fictional magical lore. Respect regional and historical differences; avoid claims about origins, rituals or symbolism without sources. Keep NPC voices distinct and lines brief (1–2 sentences per node). Output content JSON conforming to existing dialogue and quest schemas, plus a checklist of facts that still need verification. Do not invent citations.
Acceptance: every cultural card has `status: verified|needs_review`; no unverified claim rendered as fact; localization keys don't break build; no educational quiz gating progression.
```

## Suggested first 3 coding turns

1. Paste **PROMPT 00**, then **PROMPT 01**. Insist on run results and screenshot of actual browser canvas, not generated concept art.
2. After accepting and committing it, run **PROMPT 02** and test controller/camera on desktop and mobile.
3. Only then run **PROMPT 03**. Do not spend more than 1–2 working days polishing models before the playable loop Q00 is coded.

## AI review prompt after every module

```text
Review only the diff of the latest module. Check TypeScript type safety, component lifecycle, input handling, event unsubscription, runtime leaks, stable IDs, save safety, and performance risks. Give concrete reproducible bugs by severity, then fix only confirmed issues. Run typecheck, tests and build, report command outputs. Do not rewrite unrelated files. Update docs/PROGRESS.md.
```
