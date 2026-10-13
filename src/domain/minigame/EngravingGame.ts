import type { Quality } from '../content/gameplayTypes';
import { clampScore, qualityFromScore } from './quality';
import type { MiniGameStatus, MiniGameStep } from './types';

/**
 * Lights the marks of the engraving ring in the order the player found at the lantern puzzle. A wrong mark never
 * resets the sequence: the marks already lit stay lit, and the mistake only lowers the quality. Each mistake
 * costs a quarter of the score, so two mistakes still leave a Normal craft.
 */

const MISTAKE_PENALTY = 0.25;

export interface RingMarkView {
  readonly id: string;
  /** The step this mark was lit at, or null while it is still dark. */
  readonly step: number | null;
}

export class EngravingGame {
  readonly kind = 'engraving' as const;
  private readonly marks: readonly string[];
  private readonly order: readonly string[];
  private litCount = 0;
  private mistakeCount = 0;

  /** `marks` is the ring as shown. `order` is the sequence to light. Every ordered mark must be on the ring. */
  constructor(marks: readonly string[], order: readonly string[]) {
    this.marks = marks;
    this.order = order;
  }

  get status(): MiniGameStatus {
    return this.litCount === this.order.length ? 'complete' : 'playing';
  }

  get mistakes(): number {
    return this.mistakeCount;
  }

  ring(): readonly RingMarkView[] {
    return this.marks.map((id) => {
      const step = this.order.indexOf(id);
      return { id, step: step >= 0 && step < this.litCount ? step : null };
    });
  }

  tap(markId: string): MiniGameStep {
    if (this.status === 'complete') {
      return { ok: false, reason: 'finished' };
    }
    if (!this.marks.includes(markId)) {
      return { ok: false, reason: 'unknown_mark' };
    }
    if (markId !== this.order[this.litCount]) {
      this.mistakeCount += 1;
      return { ok: false, reason: 'wrong_mark' };
    }
    this.litCount += 1;
    return { ok: true, status: this.status };
  }

  get score(): number {
    return clampScore(1 - MISTAKE_PENALTY * this.mistakeCount);
  }

  get quality(): Quality | null {
    return this.status === 'complete' ? qualityFromScore(this.score) : null;
  }
}
