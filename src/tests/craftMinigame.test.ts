import { describe, expect, it } from 'vitest';
import { GAME_CONTENT } from '../content';
import { GameSession, type SessionContent } from '../domain/GameSession';
import { engraveInSolvedOrder, fitFrame } from './craftHelpers';

/** A session with the four Q00 pickups collected: enough bamboo, paper and rope for the Wooden Lantern. */
function sessionWithWoodenInputs(content: SessionContent = GAME_CONTENT): GameSession {
  const session = new GameSession(content);
  session.start();
  for (const pickup of ['pk_bamboo_1', 'pk_bamboo_2', 'pk_paper_1', 'pk_rope_1']) {
    session.collectPickup(pickup);
  }
  return session;
}

describe('crafting minigames through the session', () => {
  it('reserves the inputs when the minigame opens, and returns them when it is cancelled', () => {
    const session = sessionWithWoodenInputs();
    session.interactStation('station_workbench');
    expect(session.beginCraft('recipe_wooden_lantern', 'station_workbench').ok).toBe(true);
    expect(session.inventory.available('bamboo')).toBe(0);

    session.cancelCraft();
    expect(session.inventory.available('bamboo')).toBe(2);
    expect(session.snapshot().miniGame).toBeNull();
    // The craft panel stays open, back at the recipe list.
    expect(session.currentPanel).toEqual({ kind: 'craft', stationId: 'station_workbench' });
  });

  it('spends the inputs once and adds the output once, then refuses further fits', () => {
    const session = sessionWithWoodenInputs();
    session.beginCraft('recipe_wooden_lantern', 'station_workbench');
    fitFrame(session, 0);

    expect(session.activeCraft).toBeNull();
    expect(session.inventory.available('bamboo')).toBe(0);
    expect(session.inventory.available('wooden_lantern', 'perfect')).toBe(1);

    // The minigame is gone with its craft, so repeated clicks cannot add a second lantern.
    expect(session.assemblyPlace('socket_a', 0)).toEqual({ ok: false, reason: 'no_minigame' });
    expect(session.inventory.available('wooden_lantern', 'perfect')).toBe(1);
  });

  it('takes the quality from the minigame: centred fits give Perfect, and edge fits give Normal', () => {
    const centred = sessionWithWoodenInputs();
    centred.beginCraft('recipe_wooden_lantern', 'station_workbench');
    fitFrame(centred, 0);
    expect(centred.inventory.available('wooden_lantern', 'perfect')).toBe(1);

    const edged = sessionWithWoodenInputs();
    edged.beginCraft('recipe_wooden_lantern', 'station_workbench');
    fitFrame(edged, 1);
    expect(edged.inventory.available('wooden_lantern', 'normal')).toBe(1);
  });

  it('ends the craft and returns the inputs when the player leaves the craft panel', () => {
    const session = sessionWithWoodenInputs();
    session.interactStation('station_workbench');
    session.beginCraft('recipe_wooden_lantern', 'station_workbench');
    session.openPanel({ kind: 'inventory' });

    expect(session.activeCraft).toBeNull();
    expect(session.inventory.available('bamboo')).toBe(2);
    expect(session.snapshot().miniGame).toBeNull();
  });

  it('shows the assembly sockets as the player fits them', () => {
    const session = sessionWithWoodenInputs();
    session.beginCraft('recipe_wooden_lantern', 'station_workbench');
    session.assemblyPlace('socket_a', 0.2);
    const view = session.snapshot().miniGame;
    expect(view?.kind).toBe('assembly');
    if (view?.kind !== 'assembly') {
      throw new Error('expected an assembly view');
    }
    expect(view.sockets.map((socket) => [socket.id, socket.filled])).toEqual([
      ['socket_a', true],
      ['socket_b', false],
    ]);
  });

  it('keeps the engraving locked until the lantern puzzle is solved', () => {
    const session = sessionWithWoodenInputs();
    expect(session.beginCraft('recipe_spirit_lantern', 'station_engraving')).toEqual({ ok: false, reason: 'locked' });
    expect(session.activeCraft).toBeNull();
  });

  it('does not show the engraving order in the view, only the ring and what is lit', () => {
    const session = sessionWithWoodenInputs();
    session.inventory.add('wooden_lantern', 1, 'normal');
    session.inventory.add('ink', 1);
    session.inventory.add('indigo', 1);
    solveLanternPuzzle(session);
    session.beginCraft('recipe_spirit_lantern', 'station_engraving');

    const view = session.snapshot().miniGame;
    expect(view?.kind).toBe('engraving');
    expect(Object.keys(view ?? {})).toEqual(['kind', 'status', 'marks', 'mistakes']);
    if (view?.kind !== 'engraving') {
      throw new Error('expected an engraving view');
    }
    expect(view.marks.map((mark) => mark.id)).toEqual(['glyph_gate', 'glyph_bridge', 'glyph_signboard']);
    expect(view.marks.every((mark) => mark.step === null)).toBe(true);
  });

  it('engraves a Spirit Pattern Lantern: a wrong mark keeps the inputs reserved, and the solved order finishes', () => {
    const session = sessionWithWoodenInputs();
    session.beginCraft('recipe_wooden_lantern', 'station_workbench');
    fitFrame(session);
    session.collectPickup('pk_ink_1');
    session.collectPickup('pk_indigo_1');
    solveLanternPuzzle(session);

    expect(session.beginCraft('recipe_spirit_lantern', 'station_engraving').ok).toBe(true);
    expect(session.inventory.available('wooden_lantern')).toBe(0);
    expect(session.engravingTap('glyph_signboard')).toEqual({ ok: false, reason: 'wrong_mark' });
    expect(session.inventory.available('wooden_lantern')).toBe(0);
    expect(session.activeCraft).not.toBeNull();

    engraveInSolvedOrder(session, 'station_engraving');
    expect(session.activeCraft).toBeNull();
    expect(session.inventory.available('wooden_lantern')).toBe(0);
    expect(session.inventory.available('ink')).toBe(0);
    // One mistake gives Good.
    expect(session.inventory.available('spirit_lantern', 'good')).toBe(1);
  });

  it('completes a confirm-only recipe at once, with Normal quality', () => {
    const recipes = GAME_CONTENT.recipes.map((recipe) =>
      recipe.id === 'recipe_wooden_lantern' ? { ...recipe, miniGame: 'confirm' as const } : recipe,
    );
    const session = sessionWithWoodenInputs({ ...GAME_CONTENT, recipes });
    expect(session.beginCraft('recipe_wooden_lantern', 'station_workbench').ok).toBe(true);
    expect(session.activeCraft).toBeNull();
    expect(session.inventory.available('wooden_lantern', 'normal')).toBe(1);
  });
});

/** Opens the engraving table, and submits the right order. Done through the same calls the panel makes. */
function solveLanternPuzzle(session: GameSession): void {
  session.interactStation('station_engraving');
  for (const glyph of ['glyph_bridge', 'glyph_gate', 'glyph_signboard']) {
    session.pickGlyph('puzzle_glyph_order', glyph);
  }
  session.submitPuzzle('puzzle_glyph_order');
}
