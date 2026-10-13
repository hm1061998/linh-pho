import { describe, expect, it } from 'vitest';
import { GAME_CONTENT } from '../content';
import { GameSession, type SessionEvent } from '../domain/GameSession';
import { fitFrame } from './craftHelpers';

function newSession(): { session: GameSession; notices: string[] } {
  const session = new GameSession(GAME_CONTENT);
  const notices: string[] = [];
  session.events.on('notice', (event: Extract<SessionEvent, { type: 'notice' }>) => notices.push(event.textKey));
  session.start();
  return { session, notices };
}

describe('Q00 (Đêm Mở Chợ) with the shipped content', () => {
  it('starts active and shows the first objective', () => {
    const { session } = newSession();
    expect(session.snapshot().activeQuest?.id).toBe('q00_dem_mo_cho');
  });

  it('runs end to end and pays 30 coins exactly once', () => {
    const { session } = newSession();

    // Talk to Bà Nghiêm. Opening her dialogue counts the talk objective.
    expect(session.dialogue.start('dlg_ba_nghiem')).toEqual({ ok: true });
    session.dialogue.close('dismissed');

    // Gather from distinct pickups. Taking the same pickup twice does nothing.
    expect(session.collectPickup('pk_bamboo_1').ok).toBe(true);
    expect(session.collectPickup('pk_bamboo_1')).toEqual({ ok: false, reason: 'pickup_taken' });
    expect(session.collectPickup('pk_bamboo_2').ok).toBe(true);
    expect(session.collectPickup('pk_paper_1').ok).toBe(true);
    expect(session.collectPickup('pk_rope_1').ok).toBe(true);
    expect(session.snapshot().activeQuest?.objectives.every((objective) => objective.done)).toBe(false);

    // Craft at the workbench. Fitting the frame finishes the craft and moves the inputs into the output.
    expect(session.beginCraft('recipe_wooden_lantern', 'station_workbench').ok).toBe(true);
    fitFrame(session);
    expect(session.activeCraft).toBeNull();
    expect(session.assemblyPlace('socket_a', 0)).toEqual({ ok: false, reason: 'no_minigame' });

    // Place the lantern on the shop lamp. This completes the quest.
    expect(session.placeItem('shop_lamp').ok).toBe(true);

    const snapshot = session.snapshot();
    expect(session.quests.statusOf('q00_dem_mo_cho')).toBe('completed');
    expect(snapshot.coins).toBe(30);
    expect(snapshot.shopLevel).toBe(1);
    expect(snapshot.flags).toMatchObject({ q00_complete: true, shop_lamp_lit: true });
    expect(snapshot.inventory).toEqual([]);

    // Repeating the finished steps does not pay again.
    expect(session.placeItem('shop_lamp')).toEqual({ ok: false, reason: 'placement_filled' });
    expect(session.snapshot().coins).toBe(30);
  });

  it('refuses to craft before the pickups are collected, and reserves nothing', () => {
    const { session } = newSession();
    expect(session.beginCraft('recipe_wooden_lantern', 'station_workbench')).toEqual({
      ok: false,
      reason: 'missing_inputs',
    });
    expect(session.activeCraft).toBeNull();
  });

  it('returns materials when a craft is cancelled mid-way', () => {
    const { session } = newSession();
    session.collectPickup('pk_bamboo_1');
    session.collectPickup('pk_bamboo_2');
    session.collectPickup('pk_paper_1');
    session.collectPickup('pk_rope_1');
    session.beginCraft('recipe_wooden_lantern', 'station_workbench');
    session.cancelCraft();
    const bamboo = session.snapshot().inventory.find((stack) => stack.itemId === 'bamboo');
    expect(bamboo).toMatchObject({ count: 2, reserved: 0 });
    expect(session.quests.statusOf('q00_dem_mo_cho')).toBe('active');
  });

  it('gives a notice when placing without the lantern, and places nothing', () => {
    const { session, notices } = newSession();
    expect(session.placeItem('shop_lamp')).toEqual({ ok: false, reason: 'item_missing' });
    expect(notices).toContain('notice.place_missing');
    expect(session.snapshot().placed).toEqual([]);
  });

  it('reports unknown pickups and placements without throwing', () => {
    const { session } = newSession();
    expect(session.collectPickup('pk_nope')).toEqual({ ok: false, reason: 'pickup_unknown' });
    expect(session.placeItem('nowhere')).toEqual({ ok: false, reason: 'placement_unknown' });
  });
});
