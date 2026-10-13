import type { Quality } from '../content/gameplayTypes';
import type { OrderState } from '../orders/OrderBoard';
import type { QuestState } from '../quests/QuestSystem';
import type { ShopState } from '../shop/Shop';

/**
 * Everything that makes up one playthrough, as a save stores it. Open panels, dialogues, and crafts in progress are
 * not saved. A craft in progress saves as its inputs, which are still in the inventory, so a reload never loses
 * materials.
 */
export interface SessionProgress {
  readonly coins: number;
  readonly reputation: number;
  readonly shopLevel: number;
  readonly flags: Readonly<Record<string, boolean>>;
  readonly inventory: readonly { readonly itemId: string; readonly quality: Quality | null; readonly count: number }[];
  readonly collectedPickups: readonly string[];
  readonly placed: readonly string[];
  readonly quests: Readonly<Record<string, QuestState>>;
  readonly lanternSpirit: boolean;
  readonly puzzles: Readonly<Record<string, { readonly solved: boolean; readonly attempts: number }>>;
  readonly shop: ShopState;
  readonly orders: OrderState;
}

/** A brand-new playthrough. Restoring it and then starting the quests gives the opening state. */
export const BLANK_PROGRESS: SessionProgress = {
  coins: 0,
  reputation: 0,
  shopLevel: 0,
  flags: {},
  inventory: [],
  collectedPickups: [],
  placed: [],
  quests: {},
  lanternSpirit: false,
  puzzles: {},
  shop: { stock: {}, sockets: {}, purchases: 0 },
  orders: { accepted: [], delivered: [] },
};
