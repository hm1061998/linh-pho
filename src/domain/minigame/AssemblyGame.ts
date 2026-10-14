import type { Quality } from '../content/gameplayTypes';
import { clampScore, qualityFromScore } from './quality';
import type { MiniGameStatus, MiniGameStep } from './types';

/**
 * Two bamboo parts go into two snap sockets on the lamp frame, one per part the recipe takes (GDD B5.1, recipe
 * «2 tre + 1 giấy + 1 dây»). A drop has an offset: its distance from the socket centre in snap radii, where 0 is dead
 * centre and 1 is the edge. A drop past the edge is a miss. A miss costs a little and never undoes a fitted part, and
 * a fitted part never comes out.
 */

/**
 * The two sockets of the lamp frame. Their count matches the bamboo in `recipe_wooden_lantern`: a test checks that they
 * stay equal. Part of the minigame design, not of the content.
 */
export const ASSEMBLY_SOCKET_IDS: readonly string[] = ['socket_a', 'socket_b'];

/** Largest offset that still fits. Anything further is a miss. */
export const ASSEMBLY_SNAP_RADII = 1;

/** Score lost per miss. Small on purpose: misses nudge the quality, they never decide it. */
const MISS_PENALTY = 0.05;

export interface SocketView {
  readonly id: string;
  readonly filled: boolean;
}

export class AssemblyGame {
  readonly kind = 'assembly' as const;
  private readonly fitted = new Map<string, boolean>();
  private readonly accuracies: number[] = [];
  private missCount = 0;

  constructor(socketIds: readonly string[]) {
    for (const id of socketIds) {
      this.fitted.set(id, false);
    }
  }

  get status(): MiniGameStatus {
    return this.accuracies.length === this.fitted.size ? 'complete' : 'playing';
  }

  get misses(): number {
    return this.missCount;
  }

  sockets(): readonly SocketView[] {
    return [...this.fitted].map(([id, filled]) => ({ id, filled }));
  }

  /**
   * Fits one part. `offset` is the drop distance in snap radii, or Infinity when the drop had no socket in reach.
   * A fit scores accuracy in [0.5, 1]: an edge fit still counts half, so the minigame stays generous.
   */
  place(socketId: string, offset: number): MiniGameStep {
    if (this.status === 'complete') {
      return { ok: false, reason: 'finished' };
    }
    if (!this.fitted.has(socketId)) {
      return { ok: false, reason: 'unknown_socket' };
    }
    if (this.fitted.get(socketId)) {
      return { ok: false, reason: 'already_filled' };
    }
    // The negated comparison also rejects NaN.
    if (!(offset >= 0 && offset <= ASSEMBLY_SNAP_RADII)) {
      this.missCount += 1;
      return { ok: false, reason: 'miss' };
    }
    this.fitted.set(socketId, true);
    this.accuracies.push(1 - 0.5 * offset);
    return { ok: true, status: this.status };
  }

  /** 0..1. Only meaningful once complete: the average fit accuracy, minus a small cost per miss. */
  get score(): number {
    if (this.accuracies.length === 0) {
      return 0;
    }
    const average = this.accuracies.reduce((sum, value) => sum + value, 0) / this.accuracies.length;
    return clampScore(average - MISS_PENALTY * this.missCount);
  }

  get quality(): Quality | null {
    return this.status === 'complete' ? qualityFromScore(this.score) : null;
  }
}
