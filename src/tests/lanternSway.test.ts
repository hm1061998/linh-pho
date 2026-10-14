import { describe, expect, it } from 'vitest';
import type * as pc from 'playcanvas';
import { LanternSway, type SwayingLantern } from '../engine/scene/LanternSway';

/** A pivot that only records the angle it is given. The real pivot is a pc.Entity; the sway only calls this method. */
function recordingPivot(): { pivot: pc.Entity; angles: number[] } {
  const angles: number[] = [];
  const pivot = {
    setLocalEulerAngles: (_x: number, _y: number, z: number) => {
      angles.push(z);
    },
  } as unknown as pc.Entity;
  return { pivot, angles };
}

describe('LanternSway', () => {
  it('keeps every lantern within its amplitude, so the motion reads as air and not as a wobble', () => {
    const small = recordingPivot();
    const big = recordingPivot();
    const lanterns: SwayingLantern[] = [
      { pivot: small.pivot, amplitudeDeg: 3, speed: 1.2, phase: 0 },
      { pivot: big.pivot, amplitudeDeg: 1.5, speed: 1.4, phase: 2 },
    ];
    const sway = new LanternSway(lanterns);
    for (let i = 0; i < 400; i++) {
      sway.update(1 / 30);
    }
    expect(small.angles.length).toBe(400);
    expect(Math.max(...small.angles.map(Math.abs))).toBeLessThanOrEqual(3 + 1e-9);
    expect(Math.max(...big.angles.map(Math.abs))).toBeLessThanOrEqual(1.5 + 1e-9);
    // It really moves: the swing covers a good part of its range.
    expect(Math.max(...small.angles)).toBeGreaterThan(2);
  });

  it('does not move when the time step is zero, so a paused game holds still', () => {
    const { pivot, angles } = recordingPivot();
    const sway = new LanternSway([{ pivot, amplitudeDeg: 3, speed: 1.2, phase: Math.PI / 2 }]);
    sway.update(0);
    expect(angles).toEqual([3]);
  });
});
