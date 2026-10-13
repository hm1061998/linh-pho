import { describe, expect, it } from 'vitest';
import { LANTERN_TRANSITION_S, LanternPhase } from '../domain/lantern/LanternPhase';

const STEP = 1 / 60;

function settle(lantern: LanternPhase): void {
  for (let elapsed = 0; elapsed < LANTERN_TRANSITION_S + STEP; elapsed += STEP) {
    lantern.update(STEP);
  }
}

describe('LanternPhase transitions', () => {
  it('starts in REAL and moves to SPIRIT after one transition', () => {
    const lantern = new LanternPhase();
    expect(lantern.isSpirit).toBe(false);
    expect(lantern.toggle()).toBe(true);
    expect(lantern.snapshot.phase).toBe('to_spirit');
    settle(lantern);
    expect(lantern.snapshot).toEqual({ phase: 'spirit', spiritAmount: 1 });
    expect(lantern.isSpirit).toBe(true);
  });

  it('eases the spirit amount across the transition, from 0 to 1', () => {
    const lantern = new LanternPhase();
    lantern.toggle();
    const amounts: number[] = [];
    for (let elapsed = 0; elapsed < LANTERN_TRANSITION_S; elapsed += STEP) {
      lantern.update(STEP);
      amounts.push(lantern.snapshot.spiritAmount);
    }
    expect(amounts[0]).toBeGreaterThan(0);
    expect(amounts.at(-1)).toBeGreaterThan(0.9);
    for (let i = 1; i < amounts.length; i++) {
      expect(amounts[i]).toBeGreaterThanOrEqual(amounts[i - 1]!);
    }
  });

  it('does not count as seeing the spirit layer until the transition has finished', () => {
    const lantern = new LanternPhase();
    lantern.toggle();
    lantern.update(LANTERN_TRANSITION_S / 2);
    expect(lantern.isTransitioning).toBe(true);
    expect(lantern.isSpirit).toBe(false);
  });

  it('returns to REAL on the next toggle', () => {
    const lantern = new LanternPhase();
    lantern.toggle();
    settle(lantern);
    lantern.toggle();
    settle(lantern);
    expect(lantern.snapshot).toEqual({ phase: 'real', spiritAmount: 0 });
  });

  it('queues one toggle during a transition and drops the rest', () => {
    const lantern = new LanternPhase();
    lantern.toggle();
    expect(lantern.toggle()).toBe(true);
    expect(lantern.toggle()).toBe(false);
    expect(lantern.toggle()).toBe(false);
    settle(lantern);
    // The queued toggle starts the second transition. The extra taps did nothing.
    expect(lantern.snapshot.phase).toBe('to_real');
    settle(lantern);
    expect(lantern.snapshot.phase).toBe('real');
  });

  it('survives 20 rapid toggles without a broken state', () => {
    const lantern = new LanternPhase();
    for (let i = 0; i < 20; i++) {
      lantern.toggle();
      lantern.update(STEP * (i % 3));
    }
    settle(lantern);
    settle(lantern);
    settle(lantern);
    const { phase, spiritAmount } = lantern.snapshot;
    expect(['real', 'spirit']).toContain(phase);
    expect(spiritAmount === 0 || spiritAmount === 1).toBe(true);
    expect(lantern.isTransitioning).toBe(false);
  });

  it('ignores negative time, so a backward clock cannot rewind a transition', () => {
    const lantern = new LanternPhase();
    lantern.toggle();
    lantern.update(-5);
    expect(lantern.snapshot.spiritAmount).toBe(0);
    expect(lantern.snapshot.phase).toBe('to_spirit');
  });

  it('restores a settled phase and drops any transition in progress', () => {
    const lantern = new LanternPhase();
    lantern.toggle();
    lantern.restore(true);
    expect(lantern.snapshot).toEqual({ phase: 'spirit', spiritAmount: 1 });
    expect(lantern.isTransitioning).toBe(false);
    lantern.restore(false);
    expect(lantern.snapshot).toEqual({ phase: 'real', spiritAmount: 0 });
  });
});
