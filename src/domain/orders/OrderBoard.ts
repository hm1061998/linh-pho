import type { ItemAmount, OrderDef } from '../content/gameplayTypes';
import type { Inventory } from '../inventory/Inventory';

/**
 * Customer orders. An order goes open, then accepted, then delivered, and only once. Delivery spends the required
 * items in one atomic step: if any item is short, nothing is spent and the order stays accepted.
 *
 * Whether an order may be accepted right now is decided by the session, because it depends on the active quest.
 * This class only tracks each order's own state.
 */

export type OrderStatus = 'open' | 'accepted' | 'delivered';

export type OrderRefusal = 'unknown_order' | 'not_accepted' | 'already_delivered' | 'missing_items';

export interface OrderView {
  readonly id: string;
  readonly nameKey: string;
  readonly requires: readonly ItemAmount[];
  readonly rewards: { readonly coins: number; readonly reputation: number };
  readonly status: OrderStatus;
  /** True when the inventory holds everything the order needs right now. */
  readonly ready: boolean;
}

export class OrderBoard {
  private readonly orders: ReadonlyMap<string, OrderDef>;
  private readonly acceptedIds = new Set<string>();
  private readonly deliveredIds = new Set<string>();

  constructor(orders: readonly OrderDef[]) {
    this.orders = new Map(orders.map((order) => [order.id, order]));
  }

  def(orderId: string): OrderDef | undefined {
    return this.orders.get(orderId);
  }

  status(orderId: string): OrderStatus | null {
    if (!this.orders.has(orderId)) {
      return null;
    }
    if (this.deliveredIds.has(orderId)) {
      return 'delivered';
    }
    return this.acceptedIds.has(orderId) ? 'accepted' : 'open';
  }

  /** Marks an open order as accepted. Returns false when the order is unknown or already accepted. */
  accept(orderId: string): boolean {
    if (this.status(orderId) !== 'open') {
      return false;
    }
    this.acceptedIds.add(orderId);
    return true;
  }

  /**
   * Spends the required items and marks the order delivered. The spend is atomic, so a short inventory changes
   * nothing. Once delivered, the order cannot be delivered again.
   */
  deliver(orderId: string, inventory: Inventory): { readonly ok: true; readonly def: OrderDef } | { readonly ok: false; readonly reason: OrderRefusal } {
    const def = this.orders.get(orderId);
    if (!def) {
      return { ok: false, reason: 'unknown_order' };
    }
    const status = this.status(orderId);
    if (status === 'delivered') {
      return { ok: false, reason: 'already_delivered' };
    }
    if (status !== 'accepted') {
      return { ok: false, reason: 'not_accepted' };
    }
    if (!inventory.spend(def.requires)) {
      return { ok: false, reason: 'missing_items' };
    }
    this.deliveredIds.add(orderId);
    return { ok: true, def };
  }

  views(inventory: Inventory): OrderView[] {
    return [...this.orders.values()].map((def) => ({
      id: def.id,
      nameKey: def.nameKey,
      requires: def.requires,
      rewards: def.rewards,
      status: this.status(def.id) ?? 'open',
      ready: def.requires.every((amount) => inventory.available(amount.itemId, amount.quality) >= amount.count),
    }));
  }
}
