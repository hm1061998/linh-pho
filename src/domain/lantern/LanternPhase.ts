/**
 * Đèn Soi Linh: REAL → TO_SPIRIT → SPIRIT → TO_REAL → REAL. A toggle during a transition is queued, and only one
 * is kept. Tapping rapidly therefore never stacks tweens or leaves the state half-changed. Only SPIRIT is "seeing
 * the spirit layer". The transition is pure time: the engine feeds `update(dt)` and reads `spiritAmount` for visuals.
 */

export type LanternPhaseName = 'real' | 'to_spirit' | 'spirit' | 'to_real';

export interface LanternSnapshot {
  readonly phase: LanternPhaseName;
  /** 0 in REAL, 1 in SPIRIT, eased across a transition. Drives tint and glyph fade. */
  readonly spiritAmount: number;
}

/** Transition length in seconds. The GDD asks for 0.25–0.45 s. */
export const LANTERN_TRANSITION_S = 0.35;

export class LanternPhase {
  private phase: LanternPhaseName = 'real';
  private elapsed = 0;
  private queued = false;
  private readonly duration: number;

  constructor(duration: number = LANTERN_TRANSITION_S) {
    this.duration = duration;
  }

  get isSpirit(): boolean {
    return this.phase === 'spirit';
  }

  get isTransitioning(): boolean {
    return this.phase === 'to_spirit' || this.phase === 'to_real';
  }

  /** A toggle request. During a transition it is queued (once). Returns false when the request was dropped. */
  toggle(): boolean {
    if (this.isTransitioning) {
      if (this.queued) {
        return false;
      }
      this.queued = true;
      return true;
    }
    this.start(this.phase === 'real' ? 'to_spirit' : 'to_real');
    return true;
  }

  /** Advances the transition. When it ends, a queued toggle starts the next one. */
  update(dt: number): void {
    if (!this.isTransitioning) {
      return;
    }
    this.elapsed += Math.max(0, dt);
    if (this.elapsed < this.duration) {
      return;
    }
    this.phase = this.phase === 'to_spirit' ? 'spirit' : 'real';
    this.elapsed = 0;
    if (this.queued) {
      this.queued = false;
      this.start(this.phase === 'real' ? 'to_spirit' : 'to_real');
    }
  }

  get snapshot(): LanternSnapshot {
    return { phase: this.phase, spiritAmount: this.spiritAmount() };
  }

  /** Plain copy for the save. Only the settled phase is saved, so a reload never restarts a transition. */
  settledIsSpirit(): boolean {
    return this.phase === 'spirit' || this.phase === 'to_spirit';
  }

  /** Restores a settled phase from a save. Any transition in progress is dropped. */
  restore(isSpirit: boolean): void {
    this.phase = isSpirit ? 'spirit' : 'real';
    this.elapsed = 0;
    this.queued = false;
  }

  private start(next: 'to_spirit' | 'to_real'): void {
    this.phase = next;
    this.elapsed = 0;
  }

  private spiritAmount(): number {
    if (this.phase === 'spirit') {
      return 1;
    }
    if (this.phase === 'real') {
      return 0;
    }
    const t = Math.min(1, this.elapsed / this.duration);
    const eased = t * t * (3 - 2 * t);
    return this.phase === 'to_spirit' ? eased : 1 - eased;
  }
}
