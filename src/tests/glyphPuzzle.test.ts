import { describe, expect, it } from 'vitest';
import type { PuzzleDef } from '../domain/content/gameplayTypes';
import { GlyphPuzzle } from '../domain/puzzle/GlyphPuzzle';

const DEF: PuzzleDef = {
  id: 'p1',
  stationId: 'st_engrave',
  glyphs: ['gate', 'bridge', 'sign'],
  solution: ['bridge', 'gate', 'sign'],
  unlockFlag: 'unlocked',
  hints: [
    { afterAttempts: 1, textKey: 'hint.1' },
    { afterAttempts: 3, textKey: 'hint.2' },
  ],
};

function enter(puzzle: GlyphPuzzle, glyphs: string[]): void {
  for (const glyph of glyphs) {
    puzzle.pick(glyph);
  }
}

describe('GlyphPuzzle solving', () => {
  it('solves with the right order and stays solved', () => {
    const puzzle = new GlyphPuzzle(DEF);
    enter(puzzle, ['bridge', 'gate', 'sign']);
    expect(puzzle.submit()).toEqual({ ok: true });
    expect(puzzle.isSolved).toBe(true);
    expect(puzzle.submit()).toEqual({ ok: false, reason: 'solved' });
    expect(puzzle.pick('gate')).toEqual({ ok: false, reason: 'solved' });
  });

  it('clears the entry on a wrong order, counts one attempt, and does not penalize', () => {
    const puzzle = new GlyphPuzzle(DEF);
    enter(puzzle, ['gate', 'bridge', 'sign']);
    expect(puzzle.submit()).toEqual({ ok: false, reason: 'wrong_order' });
    expect(puzzle.view()).toMatchObject({ entered: [], attempts: 1, solved: false });
  });

  it('refuses to submit an incomplete entry', () => {
    const puzzle = new GlyphPuzzle(DEF);
    enter(puzzle, ['bridge']);
    expect(puzzle.submit()).toEqual({ ok: false, reason: 'incomplete' });
    expect(puzzle.view().entered).toEqual(['bridge']);
  });

  it('rejects unknown and repeated glyphs, and a full entry', () => {
    const puzzle = new GlyphPuzzle(DEF);
    expect(puzzle.pick('ghost')).toEqual({ ok: false, reason: 'unknown_glyph' });
    expect(puzzle.pick('bridge')).toEqual({ ok: true });
    expect(puzzle.pick('bridge')).toEqual({ ok: false, reason: 'duplicate' });
    enter(puzzle, ['gate', 'sign']);
    expect(puzzle.pick('bridge')).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('undoes the last pick and clears the entry', () => {
    const puzzle = new GlyphPuzzle(DEF);
    enter(puzzle, ['bridge', 'gate']);
    puzzle.undo();
    expect(puzzle.view().entered).toEqual(['bridge']);
    puzzle.clear();
    expect(puzzle.view().entered).toEqual([]);
  });
});

describe('GlyphPuzzle hints', () => {
  it('reveals hints by attempt count, showing the latest unlocked one', () => {
    const puzzle = new GlyphPuzzle(DEF);
    expect(puzzle.view().hintKey).toBeNull();
    for (let attempt = 1; attempt <= 3; attempt++) {
      enter(puzzle, ['gate', 'bridge', 'sign']);
      puzzle.submit();
      expect(puzzle.view().attempts).toBe(attempt);
    }
    expect(puzzle.view().hintKey).toBe('hint.2');
  });

  it('shows the first hint after one failure', () => {
    const puzzle = new GlyphPuzzle(DEF);
    enter(puzzle, ['gate', 'bridge', 'sign']);
    puzzle.submit();
    expect(puzzle.view().hintKey).toBe('hint.1');
  });
});

describe('GlyphPuzzle restore', () => {
  it('restores solved state and attempts, but never the entry', () => {
    const puzzle = new GlyphPuzzle(DEF);
    enter(puzzle, ['gate', 'bridge', 'sign']);
    puzzle.submit();
    const restored = new GlyphPuzzle(DEF);
    restored.restore({ solved: false, attempts: 2 });
    expect(restored.view()).toMatchObject({ attempts: 2, entered: [], solved: false, hintKey: 'hint.1' });
    restored.restore({ solved: true, attempts: 0 });
    expect(restored.isSolved).toBe(true);
  });
});
