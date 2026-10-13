import { describe, expect, it } from 'vitest';
import { clamp, degToRad, radToDeg, shortestAngleDelta, wrapAngle } from '../shared/utils/math';

describe('clamp', () => {
  it('keeps values inside the range and clips outside values', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });
});

describe('degree and radian conversion', () => {
  it('round-trips common angles', () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI);
    expect(radToDeg(Math.PI / 4)).toBeCloseTo(45);
  });
});

describe('wrapAngle', () => {
  it('maps any angle into [-π, π)', () => {
    expect(wrapAngle(0)).toBeCloseTo(0);
    expect(wrapAngle(3 * Math.PI / 2)).toBeCloseTo(-Math.PI / 2);
    expect(wrapAngle(-3 * Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    expect(wrapAngle(4 * Math.PI + 0.5)).toBeCloseTo(0.5);
  });
});

describe('shortestAngleDelta', () => {
  it('turns the short way across the ±π seam', () => {
    // From 170° to -170° is a +20° turn, not a -340° turn.
    const from = degToRad(170);
    const to = degToRad(-170);
    expect(radToDeg(shortestAngleDelta(from, to))).toBeCloseTo(20);
  });

  it('returns a negative turn when that is shorter', () => {
    expect(radToDeg(shortestAngleDelta(degToRad(10), degToRad(-10)))).toBeCloseTo(-20);
  });
});
