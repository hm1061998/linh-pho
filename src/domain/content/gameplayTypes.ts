/**
 * Content schema for items, recipes, quests, and world interactables (pickups, stations, placements).
 * Like the NPC and dialogue types, every text field is a locale key.
 */

export type Quality = 'normal' | 'good' | 'perfect';

export interface ItemDef {
  readonly id: string;
  readonly nameKey: string;
  /** Maximum units in one stack. Stacks of the same item and quality split past this. */
  readonly stackLimit: number;
  /** Crafted items carry a quality (normal, good, perfect). Raw materials do not. */
  readonly qualifiable: boolean;
}

export interface ItemAmount {
  readonly itemId: string;
  readonly count: number;
  /** Only for qualifiable items. Omitted means any quality. */
  readonly quality?: Quality;
}

export type MiniGameKind = 'confirm' | 'assembly' | 'engraving';

export interface RecipeDef {
  readonly id: string;
  readonly nameKey: string;
  readonly inputs: readonly ItemAmount[];
  readonly output: ItemAmount;
  readonly stationId: string;
  readonly miniGame: MiniGameKind;
  /** A flag that must be set before the recipe is known. `null` means known from the start. */
  readonly unlockFlag: string | null;
}

export type ObjectiveType =
  | 'talk'
  | 'collect'
  | 'craft'
  | 'place'
  | 'scan'
  | 'puzzle'
  | 'accept'
  | 'deliver'
  | 'buy';

export interface ObjectiveDef {
  /** Unique within its quest. */
  readonly id: string;
  readonly type: ObjectiveType;
  readonly targetId: string;
  readonly count: number;
  readonly textKey: string;
}

export interface QuestDef {
  readonly id: string;
  readonly titleKey: string;
  /** Starts as soon as its prerequisites are complete, without any trigger. */
  readonly autoStart: boolean;
  readonly prerequisites: readonly string[];
  readonly objectives: readonly ObjectiveDef[];
  readonly rewards: { readonly coins: number; readonly reputation: number };
  readonly unlocks: { readonly flags: readonly string[]; readonly shopLevel: number | null };
}

export interface PickupDef {
  /** One spawn. It can be collected once, and a quest counts it once. */
  readonly id: string;
  readonly itemId: string;
  readonly position: { readonly x: number; readonly z: number };
}

export interface StationDef {
  readonly id: string;
  readonly kind: 'workbench' | 'engraving';
  readonly labelKey: string;
  readonly position: { readonly x: number; readonly z: number };
}

export interface PlacementDef {
  readonly id: string;
  readonly labelKey: string;
  readonly position: { readonly x: number; readonly z: number };
  /** The only item this spot accepts, one unit at a time. */
  readonly acceptsItemId: string;
}

/** A mark on the world that only shows in spirit phase (Đèn Soi Linh). Scanning it counts toward a quest. */
export interface GlyphDef {
  readonly id: string;
  readonly symbolKey: string;
  readonly labelKey: string;
  readonly position: { readonly x: number; readonly z: number };
}

export interface PuzzleHint {
  /** Shown once the player has failed this many times. */
  readonly afterAttempts: number;
  readonly textKey: string;
}

/** An ordering puzzle. `solution` is a permutation of `glyphs`. Wrong attempts reset input with no penalty. */
export interface PuzzleDef {
  readonly id: string;
  readonly stationId: string;
  readonly glyphs: readonly string[];
  readonly solution: readonly string[];
  /** Set when the puzzle is solved, so the recipe that depends on it becomes known. */
  readonly unlockFlag: string;
  readonly hints: readonly PuzzleHint[];
}

export interface GameplayContent {
  readonly items: readonly ItemDef[];
  readonly recipes: readonly RecipeDef[];
  readonly quests: readonly QuestDef[];
  readonly pickups: readonly PickupDef[];
  readonly stations: readonly StationDef[];
  readonly placements: readonly PlacementDef[];
  readonly glyphs: readonly GlyphDef[];
  readonly puzzles: readonly PuzzleDef[];
}

// ---------- shop and orders (Module 07) ----------

export type FurnitureShape = 'box' | 'cylinder' | 'sphere';

/** Placeholder geometry until the real models arrive. `size` is width, height, depth in metres. */
export interface FurnitureVisual {
  readonly shape: FurnitureShape;
  /** Hex colour, `#rrggbb`. */
  readonly color: string;
  readonly size: readonly [number, number, number];
}

export interface FurnitureDef {
  readonly id: string;
  readonly nameKey: string;
  /** Lantern Coins. Paid from earned coins only. */
  readonly price: number;
  /** The shop level that must be reached before this can be bought. */
  readonly minShopLevel: number;
  /** A flag that must be set before this can be bought. `null` means no requirement. */
  readonly requiresFlag: string | null;
  readonly visual: FurnitureVisual;
}

/** A fixed decoration socket. One piece of furniture per socket. */
export interface ShopSlotDef {
  readonly id: string;
  readonly labelKey: string;
  readonly position: { readonly x: number; readonly z: number };
  readonly minShopLevel: number;
}

export interface ShopCounterDef {
  readonly id: string;
  readonly labelKey: string;
  readonly position: { readonly x: number; readonly z: number };
}

export interface OrderDef {
  readonly id: string;
  readonly nameKey: string;
  readonly requires: readonly ItemAmount[];
  readonly rewards: { readonly coins: number; readonly reputation: number };
}

export interface ShopContent {
  /** Null when the counter entry is invalid. The shop then has no entrance, and the rest of the game still runs. */
  readonly counter: ShopCounterDef | null;
  readonly slots: readonly ShopSlotDef[];
  readonly furniture: readonly FurnitureDef[];
  readonly orders: readonly OrderDef[];
}
