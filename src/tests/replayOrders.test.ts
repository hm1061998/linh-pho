import { describe, expect, it } from 'vitest';
import { GAME_CONTENT } from '../content';
import { GameSession } from '../domain/GameSession';

/** A session after the first chapter, with the replay orders open. Nothing is in the inventory yet. */
function afterFirstChapter(): GameSession {
  const session = new GameSession(GAME_CONTENT);
  session.start();
  session.flags.set('mvp_complete', true);
  return session;
}

/** Items each authored order asks for, in the order the board offers them. */
const NEEDS: readonly (readonly [string, readonly [string, number][]])[] = [
  ['order_wood_lantern', [['wooden_lantern', 1]]],
  ['order_paper_rope', [['paper', 1], ['rope', 1]]],
  ['order_ink_wood', [['ink', 1], ['wood_scrap', 1]]],
  ['order_indigo_bamboo', [['indigo', 1], ['bamboo', 2]]],
  ['order_rope_wood', [['rope', 2], ['wood_scrap', 1]]],
  ['order_spirit_lantern', [['spirit_lantern', 1]]],
];

describe('replay orders after the first chapter', () => {
  it('offers no replay order before the first chapter is complete', () => {
    const session = new GameSession(GAME_CONTENT);
    session.start();
    expect(session.acceptOrder('order_wood_lantern')).toEqual({ ok: false, reason: 'not_available' });
    expect(session.snapshot().orders.every((order) => !order.open)).toBe(true);
  });

  it('offers the authored orders one at a time, in the order they are written', () => {
    const session = afterFirstChapter();
    expect(session.snapshot().orders.filter((order) => order.open).map((order) => order.id)).toEqual(['order_wood_lantern']);
    expect(session.acceptOrder('order_paper_rope')).toEqual({ ok: false, reason: 'not_available' });
    expect(session.acceptOrder('order_wood_lantern').ok).toBe(true);
    // Accepting the first does not open the second: the first has to be delivered.
    expect(session.acceptOrder('order_paper_rope')).toEqual({ ok: false, reason: 'not_available' });
  });

  it('opens the next order when the current one is delivered, and pays its rewards', () => {
    const session = afterFirstChapter();
    session.inventory.add('wooden_lantern', 1, 'normal');
    const coinsBefore = session.currentCoins;
    session.acceptOrder('order_wood_lantern');
    expect(session.deliverOrder('order_wood_lantern').ok).toBe(true);
    expect(session.currentCoins).toBe(coinsBefore + 25);

    session.inventory.add('paper', 1);
    session.inventory.add('rope', 1);
    expect(session.acceptOrder('order_paper_rope').ok).toBe(true);
    expect(session.deliverOrder('order_paper_rope').ok).toBe(true);
    // The third order is now the next one, and the fourth still waits for it.
    expect(session.acceptOrder('order_indigo_bamboo')).toEqual({ ok: false, reason: 'not_available' });
    expect(session.acceptOrder('order_ink_wood').ok).toBe(true);
  });

  it('delivers all six orders in turn, and then offers nothing', () => {
    const session = afterFirstChapter();
    for (const [, items] of NEEDS) {
      for (const [itemId, count] of items) {
        session.inventory.add(itemId, count, itemId === 'wooden_lantern' || itemId === 'spirit_lantern' ? 'normal' : null);
      }
    }
    for (const [orderId] of NEEDS) {
      expect(session.acceptOrder(orderId).ok, orderId).toBe(true);
      expect(session.deliverOrder(orderId).ok, orderId).toBe(true);
    }
    expect(session.snapshot().orders.every((order) => order.status === 'delivered')).toBe(true);
    expect(session.snapshot().orders.some((order) => order.open)).toBe(false);
  });
});
