import { describe, expect, it } from 'vitest';
import { GAME_CONTENT } from '../content';
import { GameSession } from '../domain/GameSession';
import { LANTERN_TRANSITION_S } from '../domain/lantern/LanternPhase';
import { engraveInSolvedOrder, fitFrame } from './craftHelpers';

const Q02 = 'q02_phien_cho_dau_tien';

/** Q00 and Q01 played through with the shipped content. Q02 is active afterwards, with 30 coins from Q00. */
function sessionAfterQ01(): GameSession {
  const session = new GameSession(GAME_CONTENT);
  session.start();
  session.dialogue.start('dlg_ba_nghiem');
  session.dialogue.close('dismissed');
  for (const pickup of ['pk_bamboo_1', 'pk_bamboo_2', 'pk_paper_1', 'pk_rope_1']) {
    session.collectPickup(pickup);
  }
  session.beginCraft('recipe_wooden_lantern', 'station_workbench');
  fitFrame(session);
  session.placeItem('shop_lamp');

  session.dialogue.start('dlg_co_lam');
  session.dialogue.close('dismissed');
  session.toggleLantern();
  session.updateLantern(LANTERN_TRANSITION_S + 0.05);
  for (const glyph of ['glyph_gate', 'glyph_bridge', 'glyph_signboard']) {
    session.scanGlyph(glyph);
  }
  session.interactStation('station_engraving');
  for (const glyph of ['glyph_bridge', 'glyph_gate', 'glyph_signboard']) {
    session.pickGlyph('puzzle_glyph_order', glyph);
  }
  session.submitPuzzle('puzzle_glyph_order');
  for (const pickup of ['pk_bamboo_3', 'pk_bamboo_4', 'pk_paper_2', 'pk_rope_2', 'pk_ink_1', 'pk_indigo_1']) {
    session.collectPickup(pickup);
  }
  session.beginCraft('recipe_wooden_lantern', 'station_workbench');
  fitFrame(session);
  session.beginCraft('recipe_spirit_lantern', 'station_engraving');
  engraveInSolvedOrder(session, 'station_engraving');
  return session;
}

describe('Q02 (Phiên Chợ Đầu Tiên) with the shipped content', () => {
  it('starts when Q01 completes, with its six objectives', () => {
    const session = sessionAfterQ01();
    expect(session.quests.statusOf('q01_net_muc')).toBe('completed');
    expect(session.quests.statusOf(Q02)).toBe('active');
    expect(session.snapshot().activeQuest?.objectives).toHaveLength(6);
  });

  it('does not take orders before the quest asks for them', () => {
    const session = new GameSession(GAME_CONTENT);
    session.start();
    expect(session.acceptOrder('order_wood_lantern')).toEqual({ ok: false, reason: 'not_available' });
  });

  it('does not sell the shelf before Q01 is complete, even with enough coins', () => {
    // After Q00 the shop is level 1 and has 30 coins. The shelf still waits for the Q01 flag.
    const session = new GameSession(GAME_CONTENT);
    session.start();
    session.dialogue.start('dlg_ba_nghiem');
    session.dialogue.close('dismissed');
    for (const pickup of ['pk_bamboo_1', 'pk_bamboo_2', 'pk_paper_1', 'pk_rope_1']) {
      session.collectPickup(pickup);
    }
    session.beginCraft('recipe_wooden_lantern', 'station_workbench');
    fitFrame(session);
    session.placeItem('shop_lamp');
    expect(session.snapshot().shopLevel).toBe(1);
    expect(session.snapshot().coins).toBe(30);
    expect(session.buyFurniture('lantern_shelf')).toEqual({ ok: false, reason: 'flag_locked' });
  });

  it('refuses a purchase the coins cannot cover, and never goes negative', () => {
    const session = sessionAfterQ01();
    expect(session.buyFurniture('lantern_shelf').ok).toBe(true);
    // 30 coins minus 20 leaves 10. A second shelf costs 20, so it is refused and the balance stays put.
    expect(session.buyFurniture('lantern_shelf')).toEqual({ ok: false, reason: 'insufficient_coins' });
    expect(session.snapshot().coins).toBe(10);
  });

  it('refuses a delivery before the order is accepted, and spends nothing', () => {
    const session = sessionAfterQ01();
    session.collectPickup('pk_bamboo_5');
    session.collectPickup('pk_bamboo_6');
    session.collectPickup('pk_paper_3');
    session.collectPickup('pk_rope_3');
    session.beginCraft('recipe_wooden_lantern', 'station_workbench');
    fitFrame(session);
    expect(session.deliverOrder('order_wood_lantern')).toEqual({ ok: false, reason: 'not_accepted' });
    expect(session.inventory.available('wooden_lantern')).toBe(1);
  });

  it('runs to the end: two orders, a shelf bought and placed, the shop grows, and the reward pays once', () => {
    const session = sessionAfterQ01();

    // Order one needs a Wooden Lantern. Gather the parts for a third one and craft it.
    for (const pickup of ['pk_bamboo_5', 'pk_bamboo_6', 'pk_paper_3', 'pk_rope_3']) {
      session.collectPickup(pickup);
    }
    session.beginCraft('recipe_wooden_lantern', 'station_workbench');
    fitFrame(session);

    expect(session.acceptOrder('order_wood_lantern').ok).toBe(true);
    expect(session.acceptOrder('order_paper_rope').ok).toBe(true);
    // Accepting twice is refused: the order is already in hand.
    expect(session.acceptOrder('order_wood_lantern')).toEqual({ ok: false, reason: 'not_available' });

    expect(session.deliverOrder('order_wood_lantern').ok).toBe(true);
    expect(session.snapshot().coins).toBe(30 + 25);
    expect(session.snapshot().reputation).toBe(10 + 2);

    // Order two needs paper and rope. They are still out in the market.
    session.collectPickup('pk_paper_4');
    session.collectPickup('pk_rope_4');
    expect(session.deliverOrder('order_paper_rope').ok).toBe(true);
    expect(session.snapshot().coins).toBe(30 + 25 + 15);

    // The shelf is bought with earned coins, then placed in the first socket. That completes Q02.
    expect(session.buyFurniture('lantern_shelf').ok).toBe(true);
    expect(session.snapshot().coins).toBe(30 + 25 + 15 - 20);
    expect(session.placeFurniture('lantern_shelf', 'shop_slot_1').ok).toBe(true);

    expect(session.quests.statusOf(Q02)).toBe('completed');
    const snapshot = session.snapshot();
    expect(snapshot.shopLevel).toBe(2);
    expect(snapshot.flags).toMatchObject({ q02_complete: true, mvp_complete: true });
    expect(snapshot.reputation).toBe(10 + 2 + 1 + 10);
    expect(snapshot.shopSlots.find((slot) => slot.id === 'shop_slot_1')?.furnitureId).toBe('lantern_shelf');
    expect(snapshot.shopSlots.find((slot) => slot.id === 'shop_slot_3')?.unlocked).toBe(true);
  });

  it('pays each order once, even when the player repeats the delivery', () => {
    const session = sessionAfterQ01();
    for (const pickup of ['pk_bamboo_5', 'pk_bamboo_6', 'pk_paper_3', 'pk_rope_3']) {
      session.collectPickup(pickup);
    }
    session.beginCraft('recipe_wooden_lantern', 'station_workbench');
    fitFrame(session);
    session.acceptOrder('order_wood_lantern');
    session.deliverOrder('order_wood_lantern');
    const coinsAfterOne = session.snapshot().coins;

    expect(session.deliverOrder('order_wood_lantern')).toEqual({ ok: false, reason: 'already_delivered' });
    expect(session.snapshot().coins).toBe(coinsAfterOne);
  });

  it('refuses to place a piece into a socket the shop level has not reached', () => {
    const session = sessionAfterQ01();
    session.buyFurniture('lantern_shelf');
    expect(session.placeFurniture('lantern_shelf', 'shop_slot_3')).toEqual({ ok: false, reason: 'slot_locked' });
  });

  it('refuses a second piece in a socket that already holds one', () => {
    const session = sessionAfterQ01();
    session.buyFurniture('lantern_shelf');
    session.placeFurniture('lantern_shelf', 'shop_slot_2');
    session.buyFurniture('lantern_shelf');
    expect(session.placeFurniture('lantern_shelf', 'shop_slot_2')).toEqual({ ok: false, reason: 'slot_occupied' });
  });

  it('gives a notice when a purchase is refused, so the player knows why', () => {
    const session = sessionAfterQ01();
    const notices: string[] = [];
    session.events.on('notice', (event) => notices.push(event.textKey));
    session.buyFurniture('lantern_shelf');
    session.buyFurniture('lantern_shelf');
    expect(notices).toContain('error.insufficient_coins');
  });
});
