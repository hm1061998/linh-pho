/**
 * Placeholder blockout for the 60×60 m hub (GDD §D, Art Bible §1).
 *
 * This is level-design data, not gameplay content, so it lives in code rather than in
 * `content/*.json`. Only primitive shapes are used; GLB assets replace them in Module 09.
 *
 * Coordinates: meters. Origin at hub center. +X = east, +Z = south, -Z = north.
 * Position is the object center. Size is full extent (diameter for cylinder/sphere).
 */

export const HUB_SIZE_M = 60;
export const HUB_HALF_SIZE_M = HUB_SIZE_M / 2;

export type Vec3 = readonly [number, number, number];
export type BlockoutShape = 'box' | 'cylinder' | 'sphere';

export interface BlockoutProp {
  /** Stable ID using GDD naming: ENV_* (environment), PROP_* (props and lights). */
  readonly id: string;
  readonly shape: BlockoutShape;
  readonly position: Vec3;
  readonly size: Vec3;
  /** Base color as `#RRGGBB`. */
  readonly color: string;
  /** Optional glow color for lanterns and signs, as `#RRGGBB`. */
  readonly emissive?: string;
  readonly emissiveIntensity?: number;
  /** Blocks the player. Its XZ footprint becomes a collider (see hubCollision.ts). */
  readonly solid?: boolean;
  /** The player stands on top of this prop. Its top face sets the walking height. */
  readonly walkable?: boolean;
}

// Palette from the Art Bible §1. Night Navy/Indigo for ground and sky, warm tones for buildings.
const GROUND = '#2A3A55';
const STONE = '#9A8260';
const STONE_DARK = '#6B5C47';
const WATER = '#2F6F73';
const WOOD = '#76513A';
const WOOD_DARK = '#4A3324';
const WOOD_WARM = '#8A6442';
const PARCHMENT = '#E7D4AD';
const TERRACOTTA = '#BC744E';
const FOLIAGE = '#3E6B4F';
const LANTERN_GOLD = '#F2B759';

function box(id: string, position: Vec3, size: Vec3, color: string): BlockoutProp {
  return { id, shape: 'box', position, size, color };
}

function sphere(
  id: string,
  position: Vec3,
  diameter: Vec3,
  color: string,
  emissive?: string,
  emissiveIntensity?: number,
): BlockoutProp {
  return { id, shape: 'sphere', position, size: diameter, color, emissive, emissiveIntensity };
}

function cylinder(id: string, position: Vec3, size: Vec3, color: string): BlockoutProp {
  return { id, shape: 'cylinder', position, size, color };
}

function solid(prop: BlockoutProp): BlockoutProp {
  return { ...prop, solid: true };
}

function walkable(prop: BlockoutProp): BlockoutProp {
  return { ...prop, walkable: true };
}

/** Stall on the plaza edge: table, canopy, two posts and a glowing lantern. */
function stall(index: number, x: number, z: number): BlockoutProp[] {
  const prefix = `PROP_Stall_${index}`;
  return [
    solid(box(`${prefix}_Table`, [x, 0.45, z], [2.4, 0.9, 1.2], WOOD)),
    box(`${prefix}_Canopy`, [x, 2.5, z], [2.8, 0.12, 1.8], TERRACOTTA),
    solid(box(`${prefix}_PostWest`, [x - 1.2, 1.25, z - 0.7], [0.12, 2.5, 0.12], WOOD_DARK)),
    solid(box(`${prefix}_PostEast`, [x + 1.2, 1.25, z - 0.7], [0.12, 2.5, 0.12], WOOD_DARK)),
    sphere(`${prefix}_Lantern`, [x, 2.0, z], [0.45, 0.45, 0.45], LANTERN_GOLD, LANTERN_GOLD, 1.6),
  ];
}

/** Corner street lamp: thin pole with a glowing head. */
function cornerLamp(compass: string, x: number, z: number): BlockoutProp[] {
  return [
    solid(cylinder(`PROP_Lamp_Corner_${compass}_Pole`, [x, 1.4, z], [0.18, 2.8, 0.18], WOOD_DARK)),
    sphere(
      `PROP_Lamp_Corner_${compass}_Head`,
      [x, 2.95, z],
      [0.36, 0.36, 0.36],
      LANTERN_GOLD,
      LANTERN_GOLD,
      1.4,
    ),
  ];
}

export const HUB_PROPS: readonly BlockoutProp[] = [
  // Ground and plaza are walkable. The river is split around the bridge, so the bridge is the only crossing.
  box('ENV_Ground', [0, -0.2, 0], [HUB_SIZE_M, 0.4, HUB_SIZE_M], GROUND),
  walkable(box('ENV_Plaza', [0, 0.04, 0], [12, 0.08, 12], STONE)),
  solid(box('ENV_River_West', [-11.55, 0.03, 23], [36.9, 0.06, 6], WATER)),
  solid(box('ENV_River_East', [19.55, 0.03, 23], [20.9, 0.06, 6], WATER)),
  // The river's north bank, in two pieces either side of the bridge. It is only a visual edge: the water is what blocks.
  box('ENV_River_Bank_West', [-11.55, 0.06, 19.75], [36.9, 0.12, 0.5], STONE),
  box('ENV_River_Bank_East', [19.55, 0.06, 19.75], [20.9, 0.12, 0.5], STONE),

  // F — Cầu: wooden bridge over the river (landmark #2). Deck is walkable; rails block the sides.
  walkable(box('ENV_Bridge_Deck', [8, 0.25, 23], [2.2, 0.25, 8.4], WOOD)),
  solid(box('ENV_Bridge_RailWest', [6.95, 0.65, 23], [0.15, 0.6, 8.4], WOOD_DARK)),
  solid(box('ENV_Bridge_RailEast', [9.05, 0.65, 23], [0.15, 0.6, 8.4], WOOD_DARK)),

  // E — Cửa Tiệm người chơi: house with a blank signboard (landmark #3).
  solid(box('ENV_House_Shop_Body', [-17, 2, 10], [8, 4, 6], PARCHMENT)),
  box('ENV_House_Shop_Roof', [-17, 4.4, 10], [9.2, 0.8, 7.2], TERRACOTTA),
  box('ENV_House_Shop_Door', [-17, 1.2, 13.06], [1.4, 2.4, 0.12], WOOD_DARK),
  box('PROP_Signboard_Shop', [-17, 3.25, 13.1], [4, 0.9, 0.15], PARCHMENT),

  // C — Xưởng Lam: workshop house with a workbench and a hanging lantern.
  solid(box('ENV_House_Workshop_Body', [-17, 1.75, -15], [7, 3.5, 6], WOOD_WARM)),
  box('ENV_House_Workshop_Roof', [-17, 3.85, -15], [8.2, 0.7, 6.8], TERRACOTTA),
  solid(box('PROP_Workbench_Workshop', [-12.6, 0.5, -15], [1.6, 1.0, 1.0], WOOD)),
  sphere('PROP_Lantern_Workshop', [-12.6, 1.45, -15], [0.5, 0.5, 0.5], LANTERN_GOLD, LANTERN_GOLD, 1.5),

  // D — Cổng Cũ: old gate with a lantern under the beam.
  solid(box('ENV_Gate_Pillar_West', [12.5, 2.25, -22], [0.8, 4.5, 0.8], WOOD_DARK)),
  solid(box('ENV_Gate_Pillar_East', [17.5, 2.25, -22], [0.8, 4.5, 0.8], WOOD_DARK)),
  box('ENV_Gate_Beam', [15, 4.6, -22], [6.6, 0.6, 1.0], TERRACOTTA),
  sphere('PROP_Lantern_Gate', [15, 3.85, -22], [0.7, 0.7, 0.7], LANTERN_GOLD, LANTERN_GOLD, 1.5),

  // A — Quảng trường: four stalls flanking the plaza.
  ...stall(1, 9, -4),
  ...stall(2, -9, -4),
  ...stall(3, 13, 4),
  ...stall(4, -9, 4),
  // The lane from the bridge to the plaza: two stalls on either side lead the eye to the central lantern.
  ...stall(5, 3, 14),
  ...stall(6, 13, 14),

  // Big central lantern on the plaza (landmark #1).
  solid(box('PROP_Lamp_Plaza_Base', [0, 0.25, 0], [1.6, 0.5, 1.6], STONE_DARK)),
  solid(cylinder('PROP_Lamp_Plaza_Pole', [0, 2.6, 0], [0.35, 4.2, 0.35], WOOD_DARK)),
  sphere('PROP_Lamp_Plaza_Head', [0, 5.0, 0], [1.6, 1.6, 1.6], LANTERN_GOLD, LANTERN_GOLD, 2.2),

  // Corner street lamps framing the plaza.
  ...cornerLamp('NE', 6.5, -6.5),
  ...cornerLamp('NW', -6.5, -6.5),
  ...cornerLamp('SE', 6.5, 6.5),
  ...cornerLamp('SW', -6.5, 6.5),

  // Bushes to break up the empty ground. Bushes block movement.
  solid(sphere('ENV_Bush_East', [21, 0.8, 11], [2.4, 1.6, 2.4], FOLIAGE)),
  solid(sphere('ENV_Bush_West', [-23, 0.7, -6], [2.0, 1.4, 2.0], FOLIAGE)),
  solid(sphere('ENV_Bush_North', [3, 0.6, -20], [1.8, 1.2, 1.8], FOLIAGE)),

  // Street dressing: a hand cart on the bridge lane, and a pot by the shop door and one by the counter.
  solid(box('PROP_Cart', [13, 0.4, 9], [2.0, 0.8, 1.2], WOOD_WARM)),
  solid(cylinder('PROP_Pot_1', [-19.5, 0.3, 13.8], [0.6, 0.6, 0.6], TERRACOTTA)),
  solid(cylinder('PROP_Pot_2', [-11.2, 0.3, 14.6], [0.6, 0.6, 0.6], TERRACOTTA)),

  // Stage 3 dressing: small props grouped by what they belong to (stall, house, lane, square). None sits on an
  // anchor, a pickup or the plaza. Solid ones are heavy things a customer would not walk through.
  // By the east stall: a crate and a basket.
  solid(box('PROP_Crate_1', [11.0, 0.3, -2.2], [0.8, 0.6, 0.6], WOOD_WARM)),
  box('PROP_Basket_1', [7.0, 0.2, -2.0], [0.56, 0.4, 0.56], STONE),
  // By the west stall: a crate and a clay jar.
  solid(box('PROP_Crate_2', [-11.0, 0.3, -2.2], [0.8, 0.6, 0.6], WOOD_WARM)),
  box('PROP_Jar_1', [-7.0, 0.275, -1.2], [0.5, 0.55, 0.5], TERRACOTTA),
  // By the shop house: a basket by the west wall, a jar by the east wall, and a sack near the counter.
  box('PROP_Basket_2', [-23.0, 0.2, 11.0], [0.56, 0.4, 0.56], STONE),
  box('PROP_Jar_2', [-11.0, 0.275, 9.5], [0.5, 0.55, 0.5], TERRACOTTA),
  box('PROP_Sack_1', [-9.0, 0.225, 16.5], [0.5, 0.45, 0.4], STONE),
  // Benches on the lane and by the east stall.
  solid(box('PROP_Bench_1', [-3.0, 0.225, 9.0], [1.6, 0.45, 0.5], WOOD_WARM)),
  solid(box('PROP_Bench_2', [17.0, 0.225, 14.0], [1.6, 0.45, 0.5], WOOD_WARM)),
  // Barrels by the gate and by the workshop.
  solid(box('PROP_Barrel_1', [10.5, 0.4, -20.6], [0.6, 0.8, 0.6], WOOD_WARM)),
  solid(box('PROP_Barrel_2', [-22.0, 0.4, -16.0], [0.6, 0.8, 0.6], WOOD_WARM)),
  // Banners on poles: one on the north-west corner of the square, one west of the lane.
  box('PROP_Banner_1', [-4.0, 1.1, -8.0], [0.5, 2.2, 0.06], TERRACOTTA),
  box('PROP_Banner_2', [-14.5, 1.1, 2.0], [0.5, 2.2, 0.06], TERRACOTTA),
  // A scroll rack behind the workshop, and a bundle of bamboo by the east bush.
  solid(box('PROP_Rack_1', [-16.0, 0.8, -22.6], [1.2, 1.6, 0.4], WOOD_WARM)),
  box('PROP_Bundle_1', [18.5, 0.08, 1.0], [0.56, 0.16, 0.18], STONE),
  // Second wave: each stall gets three props beside it, on the side away from the lane and the plaza.
  box('PROP_Jar_3', [11.4, 0.275, -5.6], [0.5, 0.55, 0.5], TERRACOTTA),
  box('PROP_Basket_3', [-7.2, 0.2, -7.2], [0.56, 0.4, 0.56], STONE),
  solid(box('PROP_Crate_3', [15.2, 0.3, 3.0], [0.8, 0.6, 0.6], WOOD_WARM)),
  box('PROP_Basket_4', [15.0, 0.2, 5.6], [0.56, 0.4, 0.56], STONE),
  box('PROP_Jar_4', [15.6, 0.275, 1.2], [0.5, 0.55, 0.5], TERRACOTTA),
  solid(box('PROP_Crate_4', [-11.0, 0.3, 5.5], [0.8, 0.6, 0.6], WOOD_WARM)),
  box('PROP_Jar_5', [-7.0, 0.275, 6.2], [0.5, 0.55, 0.5], TERRACOTTA),
  box('PROP_Basket_5', [-11.2, 0.2, 2.2], [0.56, 0.4, 0.56], STONE),
  box('PROP_Basket_6', [2.0, 0.2, 16.6], [0.56, 0.4, 0.56], STONE),
  solid(box('PROP_Crate_5', [4.0, 0.3, 16.0], [0.8, 0.6, 0.6], WOOD_WARM)),
  box('PROP_Jar_6', [5.2, 0.275, 13.6], [0.5, 0.55, 0.5], TERRACOTTA),
  box('PROP_Basket_7', [15.0, 0.2, 13.0], [0.56, 0.4, 0.56], STONE),
  solid(box('PROP_Crate_6', [15.4, 0.3, 15.6], [0.8, 0.6, 0.6], WOOD_WARM)),
  box('PROP_Jar_7', [15.6, 0.275, 11.8], [0.5, 0.55, 0.5], TERRACOTTA),
];
