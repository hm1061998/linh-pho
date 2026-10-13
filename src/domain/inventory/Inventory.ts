import type { ItemAmount, ItemDef, Quality } from '../content/gameplayTypes';

/**
 * Item stacks with reservations. A reservation holds ingredients for a craft in progress: they cannot be
 * spent elsewhere, and they are removed exactly once, when the craft commits. Cancelling returns them.
 * Every operation is atomic: a failed `reserve` changes nothing.
 */

export interface StackView {
  readonly itemId: string;
  readonly quality: Quality | null;
  /** Units in the stack, including units reserved for a craft in progress. */
  readonly count: number;
  readonly reserved: number;
}

export interface Reservation {
  readonly id: string;
  readonly amounts: readonly ItemAmount[];
}

interface Stack {
  readonly itemId: string;
  readonly quality: Quality | null;
  count: number;
  reserved: number;
}

export class Inventory {
  private readonly items: ReadonlyMap<string, ItemDef>;
  private readonly stacks = new Map<string, Stack>();
  private readonly reservations = new Map<string, { readonly picks: ReadonlyArray<{ key: string; count: number }> }>();
  private nextReservation = 1;
  private nextStackId = 1;

  constructor(items: readonly ItemDef[]) {
    this.items = new Map(items.map((item) => [item.id, item]));
  }

  /** Whether an item carries a quality. Unknown items return false. */
  isQualifiable(itemId: string): boolean {
    return this.items.get(itemId)?.qualifiable ?? false;
  }

  /** Units not reserved, summed over stacks. Pass a quality to count only that quality. */
  available(itemId: string, quality?: Quality): number {
    let total = 0;
    for (const stack of this.stacks.values()) {
      if (stack.itemId === itemId && (quality === undefined || stack.quality === quality)) {
        total += stack.count - stack.reserved;
      }
    }
    return total;
  }

  /**
   * Adds units. Qualifiable items keep a quality per stack. Returns false for an unknown item, a
   * non-positive count, or a quality given for an item that cannot have one.
   */
  add(itemId: string, count: number, quality: Quality | null = null): boolean {
    const item = this.items.get(itemId);
    if (!item || !Number.isInteger(count) || count < 1) {
      return false;
    }
    if (item.qualifiable !== (quality !== null)) {
      return false;
    }
    let remaining = count;
    // Fill existing stacks up to the limit first, in insertion order.
    for (const stack of this.stacks.values()) {
      if (remaining === 0) {
        break;
      }
      if (stack.itemId === itemId && stack.quality === quality && stack.count < item.stackLimit) {
        const room = item.stackLimit - stack.count;
        const moved = Math.min(room, remaining);
        stack.count += moved;
        remaining -= moved;
      }
    }
    while (remaining > 0) {
      const moved = Math.min(item.stackLimit, remaining);
      this.stacks.set(this.stackKey(itemId, quality), {
        itemId,
        quality,
        count: moved,
        reserved: 0,
      });
      remaining -= moved;
    }
    return true;
  }

  /**
   * Reserves every amount, or none. Returns the reservation, or null when any amount is short.
   * A requirement without a quality takes any quality.
   */
  reserve(amounts: readonly ItemAmount[]): Reservation | null {
    const picks: Array<{ key: string; count: number }> = [];
    const taken = new Map<string, number>();
    for (const amount of amounts) {
      let needed = amount.count;
      for (const [key, stack] of this.stacks) {
        if (needed === 0) {
          break;
        }
        if (stack.itemId !== amount.itemId) {
          continue;
        }
        if (amount.quality !== undefined && stack.quality !== amount.quality) {
          continue;
        }
        const free = stack.count - stack.reserved - (taken.get(key) ?? 0);
        const pick = Math.min(free, needed);
        if (pick > 0) {
          picks.push({ key, count: pick });
          taken.set(key, (taken.get(key) ?? 0) + pick);
          needed -= pick;
        }
      }
      if (needed > 0) {
        return null;
      }
    }

    for (const pick of picks) {
      const stack = this.stacks.get(pick.key);
      if (stack) {
        stack.reserved += pick.count;
      }
    }
    const id = `res-${this.nextReservation++}`;
    this.reservations.set(id, { picks });
    return { id, amounts };
  }

  /** Removes the reserved units for good. Call once, when the craft succeeds. */
  commit(reservationId: string): boolean {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      return false;
    }
    for (const pick of reservation.picks) {
      const stack = this.stacks.get(pick.key);
      if (stack) {
        stack.count -= pick.count;
        stack.reserved -= pick.count;
      }
    }
    this.reservations.delete(reservationId);
    this.dropEmptyStacks();
    return true;
  }

  /** Returns reserved units to the free pool. Used when a craft is cancelled. */
  release(reservationId: string): boolean {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      return false;
    }
    for (const pick of reservation.picks) {
      const stack = this.stacks.get(pick.key);
      if (stack) {
        stack.reserved -= pick.count;
      }
    }
    this.reservations.delete(reservationId);
    return true;
  }

  /** Spends units immediately (for example a delivered order). Atomic: fails if any amount is short. */
  spend(amounts: readonly ItemAmount[]): boolean {
    const reservation = this.reserve(amounts);
    if (!reservation) {
      return false;
    }
    return this.commit(reservation.id);
  }

  /** Every stack, sorted by item then quality, so the view and the save are stable. */
  stackViews(): StackView[] {
    return [...this.stacks.values()]
      .filter((stack) => stack.count > 0)
      .map((stack) => ({ itemId: stack.itemId, quality: stack.quality, count: stack.count, reserved: stack.reserved }))
      .sort((a, b) => a.itemId.localeCompare(b.itemId) || (a.quality ?? '').localeCompare(b.quality ?? ''));
  }

  private stackKey(itemId: string, quality: Quality | null): string {
    return `${itemId}|${quality ?? ''}|${this.nextStackId++}`;
  }

  private dropEmptyStacks(): void {
    for (const [key, stack] of this.stacks) {
      if (stack.count === 0 && stack.reserved === 0) {
        this.stacks.delete(key);
      }
    }
  }
}
