import { describe, expect, it } from 'vitest';
import { EngravingGame } from '../domain/minigame/EngravingGame';

const RING = ['glyph_gate', 'glyph_bridge', 'glyph_signboard'];
const ORDER = ['glyph_bridge', 'glyph_gate', 'glyph_signboard'];

describe('EngravingGame', () => {
  it('lights the marks in the solved order, and completes on the last one', () => {
    const game = new EngravingGame(RING, ORDER);
    expect(game.tap('glyph_bridge')).toEqual({ ok: true, status: 'playing' });
    expect(game.tap('glyph_gate')).toEqual({ ok: true, status: 'playing' });
    expect(game.tap('glyph_signboard')).toEqual({ ok: true, status: 'complete' });
    expect(game.status).toBe('complete');
  });

  it('counts a wrong mark as a mistake, and keeps the marks already lit', () => {
    const game = new EngravingGame(RING, ORDER);
    game.tap('glyph_bridge');
    expect(game.tap('glyph_signboard')).toEqual({ ok: false, reason: 'wrong_mark' });
    expect(game.mistakes).toBe(1);
    expect(game.ring().find((mark) => mark.id === 'glyph_bridge')?.step).toBe(0);
    // The sequence continues where it was. A wrong tap never resets it.
    expect(game.tap('glyph_gate')).toEqual({ ok: true, status: 'playing' });
  });

  it('counts tapping an already lit mark again as a mistake', () => {
    const game = new EngravingGame(RING, ORDER);
    game.tap('glyph_bridge');
    expect(game.tap('glyph_bridge')).toEqual({ ok: false, reason: 'wrong_mark' });
    expect(game.mistakes).toBe(1);
  });

  it('rejects a mark that is not on the ring, without counting a mistake', () => {
    const game = new EngravingGame(RING, ORDER);
    expect(game.tap('glyph_nowhere')).toEqual({ ok: false, reason: 'unknown_mark' });
    expect(game.mistakes).toBe(0);
  });

  it('refuses every tap once complete, so repeated taps cannot change the result', () => {
    const game = new EngravingGame(RING, ORDER);
    ORDER.forEach((mark) => game.tap(mark));
    expect(game.tap('glyph_gate')).toEqual({ ok: false, reason: 'finished' });
    expect(game.mistakes).toBe(0);
  });

  it('gives Perfect with no mistakes, Good with one, and Normal with two', () => {
    const clean = new EngravingGame(RING, ORDER);
    ORDER.forEach((mark) => clean.tap(mark));
    expect(clean.quality).toBe('perfect');

    const once = new EngravingGame(RING, ORDER);
    once.tap('glyph_gate');
    ORDER.forEach((mark) => once.tap(mark));
    expect(once.quality).toBe('good');

    const twice = new EngravingGame(RING, ORDER);
    twice.tap('glyph_gate');
    twice.tap('glyph_signboard');
    ORDER.forEach((mark) => twice.tap(mark));
    expect(twice.quality).toBe('normal');
  });

  it('shows the ring in display order, with steps only for lit marks', () => {
    const game = new EngravingGame(RING, ORDER);
    game.tap('glyph_bridge');
    expect(game.ring()).toEqual([
      { id: 'glyph_gate', step: null },
      { id: 'glyph_bridge', step: 0 },
      { id: 'glyph_signboard', step: null },
    ]);
  });

  it('has no quality until it is complete', () => {
    const game = new EngravingGame(RING, ORDER);
    game.tap('glyph_bridge');
    expect(game.quality).toBeNull();
  });
});
