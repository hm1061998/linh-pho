import { describe, expect, it } from 'vitest';
import { GAME_CONTENT } from '../content';
import { GameSession } from '../domain/GameSession';
import { LANTERN_TRANSITION_S } from '../domain/lantern/LanternPhase';
import { DEFAULT_SETTINGS, parseSaveDocument, serializeSaveDocument } from '../domain/save/SaveDocument';
import { engraveInSolvedOrder, fitFrame } from './craftHelpers';

/**
 * End-to-end smoke test for the whole first chapter, with a save and a reload at every chapter boundary. It uses the
 * same calls the game makes, and it fails if any chapter loses progress, pays twice, or leaves the quest chain stuck.
 */

function newGame(): GameSession {
  const session = new GameSession(GAME_CONTENT);
  session.start();
  return session;
}

/** Writes the save text the way the autosave does, then reads it back into a fresh session, as a reload does. */
function reloadThroughSave(session: GameSession): GameSession {
  const text = serializeSaveDocument(session.saveProgress(), DEFAULT_SETTINGS, new Date(0));
  const parsed = parseSaveDocument(JSON.parse(text));
  if (!parsed.ok) {
    throw new Error(`save did not reload: ${parsed.reason}`);
  }
  const fresh = newGame();
  fresh.restoreProgress(parsed.document.progress);
  return fresh;
}

function playQ00(session: GameSession): void {
  session.dialogue.start('dlg_ba_nghiem');
  session.dialogue.close('dismissed');
  for (const pickup of ['pk_bamboo_1', 'pk_bamboo_2', 'pk_paper_1', 'pk_rope_1']) {
    session.collectPickup(pickup);
  }
  session.beginCraft('recipe_wooden_lantern', 'station_workbench');
  fitFrame(session);
  session.placeItem('shop_lamp');
}

function playQ01(session: GameSession): void {
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
}

function playQ02(session: GameSession): void {
  for (const pickup of ['pk_bamboo_5', 'pk_bamboo_6', 'pk_paper_3', 'pk_rope_3']) {
    session.collectPickup(pickup);
  }
  session.beginCraft('recipe_wooden_lantern', 'station_workbench');
  fitFrame(session);
  session.acceptOrder('order_wood_lantern');
  session.acceptOrder('order_paper_rope');
  session.deliverOrder('order_wood_lantern');
  session.collectPickup('pk_paper_4');
  session.collectPickup('pk_rope_4');
  session.deliverOrder('order_paper_rope');
  session.buyFurniture('lantern_shelf');
  session.placeFurniture('lantern_shelf', 'shop_slot_1');
}

describe('smoke: the first chapter, with a save and a reload between every quest', () => {
  it('plays Q00, reloads, plays Q01, reloads, plays Q02, reloads, and keeps every reward exactly once', () => {
    let session = newGame();

    playQ00(session);
    session = reloadThroughSave(session);
    expect(session.quests.statusOf('q00_dem_mo_cho')).toBe('completed');
    expect(session.snapshot().coins).toBe(30);
    expect(session.snapshot().activeQuest?.id).toBe('q01_net_muc');

    playQ01(session);
    session = reloadThroughSave(session);
    expect(session.quests.statusOf('q01_net_muc')).toBe('completed');
    expect(session.snapshot().reputation).toBe(10);
    expect(session.flags.get('bridge_glow')).toBe(true);
    expect(session.snapshot().activeQuest?.id).toBe('q02_phien_cho_dau_tien');

    playQ02(session);
    session = reloadThroughSave(session);
    const end = session.snapshot();
    expect(session.quests.statusOf('q02_phien_cho_dau_tien')).toBe('completed');
    expect(end.coins).toBe(30 + 25 + 15 - 20);
    expect(end.reputation).toBe(10 + 2 + 1 + 10);
    expect(end.shopLevel).toBe(2);
    expect(end.flags).toMatchObject({ q02_complete: true, mvp_complete: true });
    expect(session.snapshot().activeQuest).toBeNull();
  });

  it('keeps the chapter-end card closed after a reload once it has been closed', () => {
    let session = newGame();
    playQ00(session);
    session = reloadThroughSave(session);
    playQ01(session);
    session = reloadThroughSave(session);
    playQ02(session);
    session.markEndSeen();
    session = reloadThroughSave(session);
    expect(session.flags.get('end_card_seen')).toBe(true);
  });

  it('a second reload at the same point changes nothing: no coins, reputation, or items appear from nowhere', () => {
    let session = newGame();
    playQ00(session);
    session = reloadThroughSave(session);
    session = reloadThroughSave(session);
    session = reloadThroughSave(session);
    expect(session.snapshot().coins).toBe(30);
    expect(session.snapshot().reputation).toBe(0);
    expect(session.inventory.available('wooden_lantern')).toBe(0);
  });
});
