import { describe, expect, it } from 'vitest';
import { GAME_CONTENT } from '../content';
import { GameSession } from '../domain/GameSession';
import { LANTERN_TRANSITION_S } from '../domain/lantern/LanternPhase';
import { engraveInSolvedOrder, fitFrame } from './craftHelpers';

/** Plays Q00 to its end with the shipped content, so Q01 is active for the tests below. */
function sessionAfterQ00(): GameSession {
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
  return session;
}

function enterSpirit(session: GameSession): void {
  session.toggleLantern();
  session.updateLantern(LANTERN_TRANSITION_S + 0.05);
}

describe('Q01 (Nét Mực Thất Lạc) with the shipped content', () => {
  it('becomes active when Q00 completes', () => {
    const session = sessionAfterQ00();
    expect(session.quests.statusOf('q00_dem_mo_cho')).toBe('completed');
    expect(session.snapshot().activeQuest?.id).toBe('q01_net_muc');
  });

  it('gives Cô Lam a hint about the order after Q00', () => {
    const session = sessionAfterQ00();
    session.dialogue.start('dlg_co_lam');
    expect(session.dialogue.view?.nodeId).toBe('q01');
    session.dialogue.close('dismissed');
  });

  it('refuses to scan a glyph outside spirit phase, and explains why', () => {
    const session = sessionAfterQ00();
    const notices: string[] = [];
    session.events.on('notice', (event) => notices.push(event.textKey));
    expect(session.scanGlyph('glyph_gate')).toEqual({ ok: false, reason: 'not_spirit' });
    expect(notices).toContain('error.not_spirit');
    expect(session.snapshot().activeQuest?.objectives.find((o) => o.id === 'scan_gate')?.done).toBe(false);
  });

  it('counts each glyph scanned in spirit phase, and not the same one twice', () => {
    const session = sessionAfterQ00();
    enterSpirit(session);
    session.scanGlyph('glyph_gate');
    session.scanGlyph('glyph_gate');
    session.scanGlyph('glyph_bridge');
    session.scanGlyph('glyph_signboard');
    const objectives = session.snapshot().activeQuest?.objectives ?? [];
    expect(objectives.filter((o) => o.id.startsWith('scan_')).every((o) => o.done)).toBe(true);
  });

  it('opens the puzzle at the unsolved engraving table, and unlocks the recipe on a right solve', () => {
    const session = sessionAfterQ00();
    session.interactStation('station_engraving');
    expect(session.currentPanel).toEqual({ kind: 'puzzle', stationId: 'station_engraving', puzzleId: 'puzzle_glyph_order' });

    session.pickGlyph('puzzle_glyph_order', 'glyph_gate');
    session.pickGlyph('puzzle_glyph_order', 'glyph_bridge');
    session.pickGlyph('puzzle_glyph_order', 'glyph_signboard');
    expect(session.submitPuzzle('puzzle_glyph_order')).toEqual({ ok: false, reason: 'wrong_order' });
    expect(session.flags.get('recipe_spirit_lantern_known')).toBe(false);

    session.pickGlyph('puzzle_glyph_order', 'glyph_bridge');
    session.pickGlyph('puzzle_glyph_order', 'glyph_gate');
    session.pickGlyph('puzzle_glyph_order', 'glyph_signboard');
    expect(session.submitPuzzle('puzzle_glyph_order')).toEqual({ ok: true });
    expect(session.flags.get('recipe_spirit_lantern_known')).toBe(true);
    expect(session.snapshot().activeQuest?.objectives.find((o) => o.id === 'solve_puzzle')?.done).toBe(true);
  });

  it('runs to completion: puzzle, craft of the Spirit Pattern Lantern, and the reward once', () => {
    const session = sessionAfterQ00();
    session.dialogue.start('dlg_co_lam');
    session.dialogue.close('dismissed');
    enterSpirit(session);
    for (const glyph of ['glyph_gate', 'glyph_bridge', 'glyph_signboard']) {
      session.scanGlyph(glyph);
    }
    session.interactStation('station_engraving');
    for (const glyph of ['glyph_bridge', 'glyph_gate', 'glyph_signboard']) {
      session.pickGlyph('puzzle_glyph_order', glyph);
    }
    session.submitPuzzle('puzzle_glyph_order');

    // Ingredients for a second wooden lantern, plus the ink and indigo for the Spirit Pattern Lantern.
    for (const pickup of ['pk_bamboo_3', 'pk_bamboo_4', 'pk_paper_2', 'pk_rope_2', 'pk_ink_1', 'pk_indigo_1']) {
      expect(session.collectPickup(pickup).ok).toBe(true);
    }
    session.beginCraft('recipe_wooden_lantern', 'station_workbench');
    fitFrame(session);
    expect(session.beginCraft('recipe_spirit_lantern', 'station_engraving').ok).toBe(true);
    // Lighting the marks in the solved order, with no mistakes, gives Perfect.
    engraveInSolvedOrder(session, 'station_engraving');

    expect(session.quests.statusOf('q01_net_muc')).toBe('completed');
    const snapshot = session.snapshot();
    expect(snapshot.reputation).toBe(10);
    expect(snapshot.coins).toBe(30);
    expect(snapshot.flags).toMatchObject({ q01_complete: true, bridge_glow: true });
    expect(session.inventory.available('spirit_lantern', 'perfect')).toBe(1);

    // Finishing again must not pay out again: the minigame is gone, so there is nothing left to complete.
    expect(session.engravingTap('glyph_bridge')).toEqual({ ok: false, reason: 'no_minigame' });
    expect(session.snapshot().reputation).toBe(10);
  });

  it('gives a hint after repeated wrong orders, and never takes materials for a wrong order', () => {
    const session = sessionAfterQ00();
    session.interactStation('station_engraving');
    for (let attempt = 0; attempt < 3; attempt++) {
      session.pickGlyph('puzzle_glyph_order', 'glyph_gate');
      session.pickGlyph('puzzle_glyph_order', 'glyph_bridge');
      session.pickGlyph('puzzle_glyph_order', 'glyph_signboard');
      session.submitPuzzle('puzzle_glyph_order');
    }
    const view = session.snapshot().puzzles.find((puzzle) => puzzle.id === 'puzzle_glyph_order');
    expect(view).toMatchObject({ attempts: 3, solved: false, hintKey: 'puzzle.hint.2' });
  });
});
