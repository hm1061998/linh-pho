import type { PuzzleDef } from '../content/gameplayTypes';

/**
 * Order puzzle at the engraving table. The player picks each glyph once and submits. A wrong order clears the
 * entry and counts an attempt, with no penalty and no lost materials. Hints appear by attempt count, so the
 * player is never stuck. Once solved, it stays solved.
 */

export interface PuzzleView {
  readonly id: string;
  readonly entered: readonly string[];
  readonly required: number;
  readonly attempts: number;
  readonly solved: boolean;
  /** Locale key of the hint shown right now, or null. The latest unlocked hint wins. */
  readonly hintKey: string | null;
}

export type PuzzleResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'solved' | 'incomplete' | 'wrong_order' | 'unknown_glyph' | 'duplicate' | 'full' };

export class GlyphPuzzle {
  private readonly def: PuzzleDef;
  private entered: string[] = [];
  private attemptCount = 0;
  private solvedNow = false;

  constructor(def: PuzzleDef) {
    this.def = def;
  }

  get id(): string {
    return this.def.id;
  }

  get stationId(): string {
    return this.def.stationId;
  }

  get unlockFlag(): string {
    return this.def.unlockFlag;
  }

  get isSolved(): boolean {
    return this.solvedNow;
  }

  /** Appends a glyph to the entry. Each glyph can be picked once per attempt. */
  pick(glyphId: string): PuzzleResult {
    if (this.solvedNow) {
      return { ok: false, reason: 'solved' };
    }
    if (!this.def.glyphs.includes(glyphId)) {
      return { ok: false, reason: 'unknown_glyph' };
    }
    if (this.entered.includes(glyphId)) {
      return { ok: false, reason: 'duplicate' };
    }
    if (this.entered.length >= this.def.solution.length) {
      return { ok: false, reason: 'full' };
    }
    this.entered.push(glyphId);
    return { ok: true };
  }

  /** Removes the last pick. Used by the "undo" control. */
  undo(): void {
    if (!this.solvedNow) {
      this.entered.pop();
    }
  }

  clear(): void {
    if (!this.solvedNow) {
      this.entered = [];
    }
  }

  /** Checks the entry. Right order solves it. A wrong order clears the entry and counts one attempt. */
  submit(): PuzzleResult {
    if (this.solvedNow) {
      return { ok: false, reason: 'solved' };
    }
    if (this.entered.length !== this.def.solution.length) {
      return { ok: false, reason: 'incomplete' };
    }
    const correct = this.entered.every((glyphId, index) => glyphId === this.def.solution[index]);
    if (correct) {
      this.solvedNow = true;
      return { ok: true };
    }
    this.attemptCount += 1;
    this.entered = [];
    return { ok: false, reason: 'wrong_order' };
  }

  view(): PuzzleView {
    const unlocked = this.def.hints
      .filter((hint) => hint.afterAttempts <= this.attemptCount)
      .sort((a, b) => a.afterAttempts - b.afterAttempts);
    return {
      id: this.def.id,
      entered: [...this.entered],
      required: this.def.solution.length,
      attempts: this.attemptCount,
      solved: this.solvedNow,
      hintKey: unlocked.at(-1)?.textKey ?? null,
    };
  }

  /** Restores from a save. The solution never comes from the save, only the solved flag and the attempt count. */
  restore(state: { readonly solved: boolean; readonly attempts: number }): void {
    this.solvedNow = state.solved;
    this.attemptCount = Math.max(0, Math.floor(state.attempts));
    this.entered = [];
  }
}
