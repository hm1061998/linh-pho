import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import assetsJson from '../content/assets.json';
import { validateAssets } from '../domain/content/validateAssets';
import { HUB_PROPS } from '../engine/scene/hubLayout';

// Checks the shipped .glb files against docs/ASSET_MANIFEST.md. Reads each file's own JSON chunk, so it needs no Blender.
const PUBLIC_DIR = fileURLToPath(new URL('../../public', import.meta.url));

interface GltfAccessor {
  count: number;
  min?: number[];
  max?: number[];
}

interface GltfJson {
  nodes?: { name?: string }[];
  animations?: { name?: string }[];
  meshes: { primitives: { attributes: { POSITION: number }; indices?: number; material?: number }[] }[];
  accessors: GltfAccessor[];
  materials?: { name?: string }[];
}

type Pivot = 'floor' | 'centre' | 'hang';

interface ModelSpec {
  readonly id: string;
  /** The node name the file must use, from the naming rules in the art bible. */
  readonly node: string;
  /** Size in metres along glTF X, Y and Z. Null leaves that axis unchecked, where the manifest gives no size. */
  readonly size: readonly [number | null, number | null, number | null];
  /** Clips the file must contain, by name. */
  readonly animations?: readonly string[];
  /** Floor: feet on y = 0, centred on x and z. Centre: centred on all three axes. Hang: top of the cord at y = 0. */
  readonly pivot: Pivot;
  /** Per-model triangle budget. Hub pieces have none: the manifest sets one for the whole hub (60 000). */
  readonly triangleBudget?: number;
}

const FURNITURE: readonly ModelSpec[] = [
  { id: 'furniture.stool', node: 'PROP_Stool', size: [0.6, 0.45, 0.6], pivot: 'floor', triangleBudget: 800 },
  { id: 'furniture.lantern_shelf', node: 'PROP_LanternShelf', size: [1.6, 1.1, 0.5], pivot: 'floor', triangleBudget: 1500 },
  { id: 'furniture.bamboo_vase', node: 'PROP_BambooVase', size: [0.5, 0.9, 0.5], pivot: 'floor', triangleBudget: 800 },
  { id: 'furniture.paper_painting', node: 'PROP_PaperPainting', size: [1.0, 0.8, 0.08], pivot: 'floor', triangleBudget: 600 },
  { id: 'furniture.hanging_lamp', node: 'PROP_HangingLamp', size: [0.5, 0.545, 0.5], pivot: 'hang', triangleBudget: 2500 },
];

/**
 * Every `hub.<node>` entry in assets.json. Each must name a piece in hubLayout.ts, and its model must have that piece's
 * size and sit centred on the piece's position. Reading the list from assets.json means a new hub model is checked too.
 */
const HUB: readonly ModelSpec[] = assetsJson.assets.flatMap((entry) => {
  if (!entry.id.startsWith('hub.')) {
    return [];
  }
  const node = entry.id.slice('hub.'.length);
  const prop = HUB_PROPS.find((candidate) => candidate.id === node);
  if (!prop) {
    throw new Error(`hubLayout.ts has no prop named ${node}`);
  }
  return [{ id: entry.id, node, size: prop.size, pivot: 'centre' }];
});

const NPCS: readonly ModelSpec[] = [
  // Humans are 1.70 m tall, feet on the floor. Their width is not in the manifest, so it is not checked.
  { id: 'npc.npc_ba_nghiem', node: 'NPC_BaNghiem', size: [null, 1.7, null], pivot: 'floor', triangleBudget: 6000, animations: ['idle'] },
  { id: 'npc.npc_co_lam', node: 'NPC_CoLam', size: [null, 1.7, null], pivot: 'floor', triangleBudget: 6000, animations: ['idle'] },
  { id: 'npc.npc_ong_do', node: 'NPC_OngDo', size: [null, 1.7, null], pivot: 'floor', triangleBudget: 6000, animations: ['idle'] },
  { id: 'npc.npc_bac', node: 'NPC_Bac', size: [null, 0.5, null], pivot: 'centre', triangleBudget: 4500, animations: ['idle'] },
];

/** The craft stage (GDD B5). Sizes come from assets_src/build_assets.py; the engine places the parts with craftLayout.ts. */
const CRAFT: readonly ModelSpec[] = [
  { id: 'craft.lantern_frame', node: 'CRAFT_LanternFrame', size: [0.36, 0.56, 0.36], pivot: 'floor', triangleBudget: 1500 },
  { id: 'craft.bamboo_rib', node: 'CRAFT_BambooRib', size: [0.034, 0.38, 0.036], pivot: 'floor', triangleBudget: 300 },
  { id: 'craft.engraving_lantern', node: 'CRAFT_EngravingLantern', size: [0.36, 0.5, 0.36], pivot: 'floor', triangleBudget: 2500 },
];

/** The six materials the player collects (GDD B4). Each lies on the ground, centred on its own origin. */
const PICKUPS: readonly ModelSpec[] = [
  { id: 'pickup.bamboo', node: 'PICKUP_Bamboo', size: [0.1, 0.3, 0.1], pivot: 'floor', triangleBudget: 300 },
  { id: 'pickup.paper', node: 'PICKUP_Paper', size: [0.164, 0.26, 0.164], pivot: 'floor', triangleBudget: 300 },
  { id: 'pickup.rope', node: 'PICKUP_Rope', size: [0.22, 0.17, 0.22], pivot: 'floor', triangleBudget: 300 },
  { id: 'pickup.ink', node: 'PICKUP_Ink', size: [0.14, 0.255, 0.14], pivot: 'floor', triangleBudget: 300 },
  { id: 'pickup.indigo', node: 'PICKUP_Indigo', size: [0.21, 0.21, 0.21], pivot: 'floor', triangleBudget: 300 },
  { id: 'pickup.wood_scrap', node: 'PICKUP_WoodScrap', size: [0.2, 0.15, 0.2], pivot: 'floor', triangleBudget: 300 },
];

/**
 * Stations, the shop lamp's pedestal and lantern, the three glyph tablets, and the shop fittings (GDD B3, B5, C3). Each
 * stands on the floor, centred on its pivot. Sizes come from assets_src/build_assets.py.
 */
const WORLD: readonly ModelSpec[] = [
  { id: 'station.workbench', node: 'STATION_Workbench', size: [1.2, 1.03, 0.8], pivot: 'floor', triangleBudget: 300 },
  { id: 'station.engraving', node: 'STATION_Engraving', size: [0.9, 0.8, 0.6], pivot: 'floor', triangleBudget: 300 },
  { id: 'placement.pedestal', node: 'PLACEMENT_Pedestal', size: [0.8, 1.0, 0.8], pivot: 'floor', triangleBudget: 100 },
  { id: 'item.wooden_lantern', node: 'ITEM_WoodenLantern', size: [null, 0.5, null], pivot: 'floor', triangleBudget: 2500 },
  { id: 'glyph.gate', node: 'GLYPH_Gate', size: [0.7, 1.0, 0.152], pivot: 'floor', triangleBudget: 200 },
  { id: 'glyph.bridge', node: 'GLYPH_Bridge', size: [0.7, 1.0, 0.152], pivot: 'floor', triangleBudget: 300 },
  { id: 'glyph.signboard', node: 'GLYPH_Signboard', size: [0.7, 1.0, 0.152], pivot: 'floor', triangleBudget: 200 },
  { id: 'shop.counter', node: 'SHOP_Counter', size: [1.2, 0.9, 0.6], pivot: 'floor', triangleBudget: 100 },
  { id: 'shop.plinth', node: 'SHOP_Plinth', size: [1.1, 0.05, 1.1], pivot: 'floor', triangleBudget: 200 },
];

/** The playable character: 1.70 m tall, feet on the floor, with its idle and walk loops (GDD E2). */
const PLAYER: readonly ModelSpec[] = [
  { id: 'player.hero', node: 'PLAYER_Hero', size: [null, 1.7, null], pivot: 'floor', triangleBudget: 8000, animations: ['idle', 'walk', 'run'] },
];

const MODELS: readonly ModelSpec[] = [...FURNITURE, ...HUB, ...NPCS, ...CRAFT, ...PICKUPS, ...WORLD, ...PLAYER];

function readGlbJson(path: string): GltfJson {
  const bytes = readFileSync(path);
  expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
  expect(bytes.readUInt32LE(4)).toBe(2);
  expect(bytes.toString('ascii', 16, 20)).toBe('JSON');
  const jsonLength = bytes.readUInt32LE(12);
  return JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength)) as GltfJson;
}

/** Min and max corner of every position accessor in the file, per axis. */
function boundsOf(json: GltfJson): { min: number[]; max: number[] } {
  const accessors = json.meshes.flatMap((mesh) => mesh.primitives.map((prim) => json.accessors[prim.attributes.POSITION]));
  const mins = accessors.map((accessor) => accessor?.min ?? []);
  const maxs = accessors.map((accessor) => accessor?.max ?? []);
  // The callback takes exactly two numbers, so reduce does not pass its index and array to Math.min or Math.max.
  const axis = (values: number[][], pick: (a: number, b: number) => number) =>
    [0, 1, 2].map((i) => values.map((v) => v[i] ?? NaN).reduce((a, b) => pick(a, b)));
  return { min: axis(mins, Math.min), max: axis(maxs, Math.max) };
}

function trianglesOf(json: GltfJson): number {
  return json.meshes
    .flatMap((mesh) => mesh.primitives)
    .reduce((sum, prim) => sum + (prim.indices === undefined ? 0 : (json.accessors[prim.indices]?.count ?? 0) / 3), 0);
}

function urlFor(id: string): string | null {
  const entry = validateAssets(assetsJson).entries.find((candidate) => candidate.id === id);
  return entry?.source && entry.source.kind === 'url' ? entry.source.url : null;
}

const urlSources = validateAssets(assetsJson).entries.flatMap((entry) =>
  entry.source && entry.source.kind === 'url' ? [{ id: entry.id, url: entry.source.url }] : [],
);

describe('shipped model files', () => {
  it('has a file in public/ for every url source in assets.json', () => {
    expect(urlSources.length).toBeGreaterThan(0);
    for (const { id, url } of urlSources) {
      expect(existsSync(join(PUBLIC_DIR, url)), `${id} -> ${url}`).toBe(true);
    }
  });
});

describe.each(MODELS)('model $id (manifest)', (spec) => {
  const url = urlFor(spec.id);
  const path = url ? join(PUBLIC_DIR, url) : '';
  const load = (): GltfJson => readGlbJson(path);

  it('is listed in assets.json with a file that exists', () => {
    expect(url).not.toBeNull();
    expect(existsSync(path)).toBe(true);
  });

  it('has the size the manifest gives, in the glTF Y-up frame', () => {
    const { min, max } = boundsOf(load());
    spec.size.forEach((metres, i) => {
      if (metres !== null) {
        expect((max[i] ?? NaN) - (min[i] ?? NaN)).toBeCloseTo(metres, 2);
      }
    });
  });

  if (spec.animations !== undefined) {
    const clips = spec.animations;
    it('contains the clips it must play', () => {
      const names = (load().animations ?? []).map((animation) => animation.name);
      for (const clip of clips) {
        expect(names).toContain(clip);
      }
    });
  }

  it('has its pivot where the manifest puts it', () => {
    const { min, max } = boundsOf(load());
    const centreX = ((min[0] ?? NaN) + (max[0] ?? NaN)) / 2;
    const centreZ = ((min[2] ?? NaN) + (max[2] ?? NaN)) / 2;
    if (spec.pivot === 'floor') {
      expect(min[1] ?? NaN).toBeCloseTo(0, 3);
      expect(centreX).toBeCloseTo(0, 3);
      expect(centreZ).toBeCloseTo(0, 3);
    } else if (spec.pivot === 'centre') {
      expect(centreX).toBeCloseTo(0, 3);
      expect((min[1] ?? NaN) + (max[1] ?? NaN)).toBeCloseTo(0, 3);
      expect(centreZ).toBeCloseTo(0, 3);
    } else {
      expect(max[1] ?? NaN).toBeCloseTo(0, 3);
      expect(centreX).toBeCloseTo(0, 3);
      expect(centreZ).toBeCloseTo(0, 3);
    }
  });

  if (spec.triangleBudget !== undefined) {
    const budget = spec.triangleBudget;
    it('stays within its triangle budget', () => {
      const triangles = trianglesOf(load());
      expect(triangles).toBeGreaterThan(0);
      expect(triangles).toBeLessThanOrEqual(budget);
    });
  }

  it('uses the node name and MAT_* material names from the art bible', () => {
    const json = load();
    expect(json.nodes?.map((node) => node.name)).toContain(spec.node);
    const materials = json.materials?.map((material) => material.name ?? '') ?? [];
    expect(materials.length).toBeGreaterThan(0);
    for (const name of materials) {
      expect(name).toMatch(/^MAT_/);
    }
  });
});
