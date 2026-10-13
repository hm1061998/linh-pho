import type { FurnitureDef, ShopSlotDef } from '../content/gameplayTypes';

/**
 * The shop's stock and its decoration sockets. Coins are not kept here: the session pays. A purchase is checked in
 * full first, and only then does the session take the coins and this class add the stock. So a purchase either
 * happens completely or not at all, and the balance never goes negative.
 *
 * A socket holds one piece of furniture. A socket is usable once the shop level reaches it, and a piece can be
 * bought once its level and its flag requirement are met.
 */

export type ShopRefusal =
  | 'unknown_furniture'
  | 'level_locked'
  | 'flag_locked'
  | 'insufficient_coins'
  | 'unknown_slot'
  | 'slot_locked'
  | 'slot_occupied'
  | 'no_stock';

export interface ShopSlotView {
  readonly id: string;
  readonly unlocked: boolean;
  readonly furnitureId: string | null;
}

export interface FurnitureView {
  readonly id: string;
  readonly nameKey: string;
  readonly price: number;
  readonly owned: number;
  /** Why it cannot be bought yet, or null when it can be bought with enough coins. */
  readonly lockedBy: 'level' | 'flag' | null;
}

export type FlagCheck = (flag: string) => boolean;

/** The shop's own state, as saved. Stock counts pieces not yet placed. Sockets map each slot to its piece or null. */
export interface ShopState {
  readonly stock: Readonly<Record<string, number>>;
  readonly sockets: Readonly<Record<string, string | null>>;
  readonly purchases: number;
}

export class Shop {
  private readonly furniture: ReadonlyMap<string, FurnitureDef>;
  private readonly slots: readonly ShopSlotDef[];
  private readonly slotById: ReadonlyMap<string, ShopSlotDef>;
  private readonly stock = new Map<string, number>();
  private readonly sockets = new Map<string, string | null>();
  private purchases = 0;

  constructor(furniture: readonly FurnitureDef[], slots: readonly ShopSlotDef[]) {
    this.furniture = new Map(furniture.map((piece) => [piece.id, piece]));
    this.slots = slots;
    this.slotById = new Map(slots.map((slot) => [slot.id, slot]));
    for (const slot of slots) {
      this.sockets.set(slot.id, null);
    }
  }

  /** The level and flag rules a piece must meet before it can be bought. Null means it is available. */
  lockFor(piece: FurnitureDef, level: number, flagSet: FlagCheck): 'level' | 'flag' | null {
    if (level < piece.minShopLevel) {
      return 'level';
    }
    if (piece.requiresFlag !== null && !flagSet(piece.requiresFlag)) {
      return 'flag';
    }
    return null;
  }

  /** Checks a purchase without changing anything. The caller takes the coins and then calls `commitPurchase`. */
  checkPurchase(
    furnitureId: string,
    level: number,
    flagSet: FlagCheck,
    coins: number,
  ): { readonly ok: true; readonly def: FurnitureDef } | { readonly ok: false; readonly reason: ShopRefusal } {
    const piece = this.furniture.get(furnitureId);
    if (!piece) {
      return { ok: false, reason: 'unknown_furniture' };
    }
    const lock = this.lockFor(piece, level, flagSet);
    if (lock === 'level') {
      return { ok: false, reason: 'level_locked' };
    }
    if (lock === 'flag') {
      return { ok: false, reason: 'flag_locked' };
    }
    if (coins < piece.price) {
      return { ok: false, reason: 'insufficient_coins' };
    }
    return { ok: true, def: piece };
  }

  /** Adds one piece to stock. Call only after `checkPurchase` passed. Returns the purchase id, used as a quest source. */
  commitPurchase(furnitureId: string): string {
    this.stock.set(furnitureId, (this.stock.get(furnitureId) ?? 0) + 1);
    this.purchases += 1;
    return `purchase-${this.purchases}`;
  }

  /** Checks a placement without changing anything. */
  checkPlacement(
    furnitureId: string,
    slotId: string,
    level: number,
  ): { readonly ok: true; readonly def: FurnitureDef } | { readonly ok: false; readonly reason: ShopRefusal } {
    const piece = this.furniture.get(furnitureId);
    if (!piece) {
      return { ok: false, reason: 'unknown_furniture' };
    }
    const slot = this.slotById.get(slotId);
    if (!slot) {
      return { ok: false, reason: 'unknown_slot' };
    }
    if (level < slot.minShopLevel) {
      return { ok: false, reason: 'slot_locked' };
    }
    if (this.sockets.get(slotId) !== null) {
      return { ok: false, reason: 'slot_occupied' };
    }
    if (this.owned(furnitureId) < 1) {
      return { ok: false, reason: 'no_stock' };
    }
    return { ok: true, def: piece };
  }

  /** Moves one piece from stock into a socket. Call only after `checkPlacement` passed. */
  commitPlacement(furnitureId: string, slotId: string): void {
    this.stock.set(furnitureId, (this.stock.get(furnitureId) ?? 0) - 1);
    this.sockets.set(slotId, furnitureId);
  }

  owned(furnitureId: string): number {
    return this.stock.get(furnitureId) ?? 0;
  }

  snapshot(): ShopState {
    return {
      stock: Object.fromEntries(this.stock),
      sockets: Object.fromEntries(this.sockets),
      purchases: this.purchases,
    };
  }

  /**
   * Replaces stock and sockets with a saved state. Unknown furniture and unknown sockets are dropped, and a socket the
   * save does not name is left empty. So an old save still loads after the content changes.
   */
  restore(state: ShopState): void {
    this.stock.clear();
    for (const [furnitureId, count] of Object.entries(state.stock)) {
      if (this.furniture.has(furnitureId) && Number.isInteger(count) && count > 0) {
        this.stock.set(furnitureId, count);
      }
    }
    for (const slot of this.slots) {
      const furnitureId = state.sockets[slot.id] ?? null;
      this.sockets.set(slot.id, furnitureId !== null && this.furniture.has(furnitureId) ? furnitureId : null);
    }
    this.purchases = Number.isInteger(state.purchases) && state.purchases > 0 ? state.purchases : 0;
  }

  views(level: number, flagSet: FlagCheck): { readonly slots: readonly ShopSlotView[]; readonly furniture: readonly FurnitureView[] } {
    return {
      slots: this.slots.map((slot) => ({
        id: slot.id,
        unlocked: level >= slot.minShopLevel,
        furnitureId: this.sockets.get(slot.id) ?? null,
      })),
      furniture: [...this.furniture.values()].map((piece) => ({
        id: piece.id,
        nameKey: piece.nameKey,
        price: piece.price,
        owned: this.owned(piece.id),
        lockedBy: this.lockFor(piece, level, flagSet),
      })),
    };
  }
}
