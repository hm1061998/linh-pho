import { describe, expect, it } from 'vitest';
import { GAME_CONTENT } from '../content';
import { GameSession } from '../domain/GameSession';
import { LANTERN_TRANSITION_S } from '../domain/lantern/LanternPhase';
import { BLANK_PROGRESS, type SessionProgress } from '../domain/save/SessionProgress';
import { engraveInSolvedOrder, fitFrame } from './craftHelpers';

/** A fresh session, started the way the game starts it. */
function newSession(): GameSession {
  const session = new GameSession(GAME_CONTENT);
  session.start();
  return session;
}

/** Saves a session, and loads the save into a brand-new session, the way a reload does. */
function reload(session: GameSession): GameSession {
  const saved = JSON.parse(JSON.stringify(session.saveProgress())) as SessionProgress;
  const fresh = newSession();
  fresh.restoreProgress(saved);
  return fresh;
}

/** Q00 played to its end, so Q01 is the active quest. */
function sessionAfterQ00(): GameSession {
  const session = newSession();
  session.dialogue.start('dlg_ba_nghiem');
  session.dialogue.close('dismissed');
  for (const pickup of ['pk_bamboo_1', 'pk_bamboo_2', 'pk_paper_1', 'pk_rope_1']) {
    session.collectPickup(pickup);
  }
  session.beginCraft('recipe_wooden_lantern', 'station_workbench');
  fitFrame(session);
  session.placeItem('shop_lamp');
  return session;
}

describe('a reload gives back the same playthrough', () => {
  it('keeps coins, reputation, flags, the active quest, and what was placed', () => {
    const before = sessionAfterQ00();
    const after = reload(before);
    const snapshot = after.snapshot();
    expect(snapshot.coins).toBe(30);
    expect(snapshot.shopLevel).toBe(1);
    expect(snapshot.flags).toMatchObject({ q00_complete: true, shop_lamp_lit: true });
    expect(snapshot.activeQuest?.id).toBe('q01_net_muc');
    expect(snapshot.placed).toContain('shop_lamp');
  });

  it('keeps the inventory, and does not pay a reward a second time on load', () => {
    const before = sessionAfterQ00();
    const after = reload(before);
    expect(after.inventory.available('wooden_lantern')).toBe(0);
    // Loading twice from the same save must not add the 30 coins again.
    const again = reload(after);
    expect(again.snapshot().coins).toBe(30);
  });

  it('keeps a lantern that was on, so the spirit layer stays on after a reload', () => {
    const session = sessionAfterQ00();
    session.toggleLantern();
    session.updateLantern(LANTERN_TRANSITION_S + 0.05);
    expect(reload(session).snapshot().lantern.phase).toBe('spirit');
  });

  it('keeps a solved lantern puzzle, and the recipe it unlocked', () => {
    const session = sessionAfterQ00();
    session.interactStation('station_engraving');
    for (const glyph of ['glyph_bridge', 'glyph_gate', 'glyph_signboard']) {
      session.pickGlyph('puzzle_glyph_order', glyph);
    }
    session.submitPuzzle('puzzle_glyph_order');
    const after = reload(session);
    expect(after.flags.get('recipe_spirit_lantern_known')).toBe(true);
    expect(after.snapshot().puzzles.find((puzzle) => puzzle.id === 'puzzle_glyph_order')?.solved).toBe(true);
  });

  it('keeps the attempts of a wrong puzzle order, so the hint stays unlocked', () => {
    const session = sessionAfterQ00();
    session.interactStation('station_engraving');
    session.pickGlyph('puzzle_glyph_order', 'glyph_gate');
    session.pickGlyph('puzzle_glyph_order', 'glyph_bridge');
    session.pickGlyph('puzzle_glyph_order', 'glyph_signboard');
    session.submitPuzzle('puzzle_glyph_order');
    const view = reload(session).snapshot().puzzles.find((puzzle) => puzzle.id === 'puzzle_glyph_order');
    expect(view).toMatchObject({ attempts: 1, hintKey: 'puzzle.hint.1', solved: false });
  });

  it('keeps the orders that were accepted and delivered, and the end card once it has been closed', () => {
    const session = sessionAfterQ00();
    session.collectPickup('pk_bamboo_3');
    session.collectPickup('pk_bamboo_4');
    session.collectPickup('pk_paper_2');
    session.collectPickup('pk_rope_2');
    session.collectPickup('pk_bamboo_5');
    session.collectPickup('pk_bamboo_6');
    session.collectPickup('pk_paper_3');
    session.collectPickup('pk_rope_3');
    session.beginCraft('recipe_wooden_lantern', 'station_workbench');
    fitFrame(session);
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
    session.collectPickup('pk_ink_1');
    session.collectPickup('pk_indigo_1');
    session.beginCraft('recipe_wooden_lantern', 'station_workbench');
    fitFrame(session);
    session.beginCraft('recipe_spirit_lantern', 'station_engraving');
    engraveInSolvedOrder(session, 'station_engraving');
    session.acceptOrder('order_wood_lantern');
    session.markEndSeen();

    const after = reload(session);
    expect(after.saveProgress().orders.accepted).toEqual(['order_wood_lantern']);
    expect(after.flags.get('end_card_seen')).toBe(true);
  });

  it('does not keep a craft in progress, but keeps its materials in the inventory', () => {
    const session = sessionAfterQ00();
    session.collectPickup('pk_bamboo_3');
    session.collectPickup('pk_bamboo_4');
    session.collectPickup('pk_paper_2');
    session.collectPickup('pk_rope_2');
    session.beginCraft('recipe_wooden_lantern', 'station_workbench');
    expect(session.inventory.available('bamboo')).toBe(0);

    const after = reload(session);
    expect(after.activeCraft).toBeNull();
    expect(after.inventory.available('bamboo')).toBe(2);
    expect(after.inventory.available('paper')).toBe(1);
  });
});

describe('a save never gives back things that do not exist', () => {
  it('ignores a pickup or placement the content no longer has', () => {
    const saved: SessionProgress = { ...BLANK_PROGRESS, collectedPickups: ['pk_gone'], placed: ['nowhere'] };
    const session = newSession();
    session.restoreProgress(saved);
    expect(session.saveProgress().collectedPickups).toEqual([]);
    expect(session.saveProgress().placed).toEqual([]);
  });
});

describe('starting over', () => {
  it('returns to the opening state, with the first quest active and nothing kept', () => {
    const session = sessionAfterQ00();
    session.resetProgress();
    const snapshot = session.snapshot();
    expect(snapshot.coins).toBe(0);
    expect(snapshot.shopLevel).toBe(0);
    expect(snapshot.activeQuest?.id).toBe('q00_dem_mo_cho');
    expect(snapshot.placed).toEqual([]);
    expect(session.inventory.available('bamboo')).toBe(0);
  });

  it('saves the blank state, so a reload after starting over does not bring the old playthrough back', () => {
    const session = sessionAfterQ00();
    session.resetProgress();
    expect(reload(session).snapshot().coins).toBe(0);
  });
});

describe('the chapter-end card', () => {
  it('stays closed once it has been closed', () => {
    const session = newSession();
    session.markEndSeen();
    expect(session.flags.get('end_card_seen')).toBe(true);
    expect(reload(session).flags.get('end_card_seen')).toBe(true);
  });
});
