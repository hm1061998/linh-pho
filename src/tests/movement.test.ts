import { describe, expect, it } from 'vitest';
import { NO_MOVE, applyDeadzone, clampMagnitude, addMoveInputs } from '../engine/input/moveInput';
import { dampFactor, dampToward, orbitOffset, worldMoveDirection } from '../engine/player/movement';

const FORWARD = { x: 0, y: 1 };
const RIGHT = { x: 1, y: 0 };

describe('worldMoveDirection', () => {
  it('moves north on W and east on D when the camera yaw is 0 (camera to the south)', () => {
    const forward = worldMoveDirection(FORWARD, 0);
    expect(forward.x).toBeCloseTo(0);
    expect(forward.z).toBeCloseTo(-1);

    const right = worldMoveDirection(RIGHT, 0);
    expect(right.x).toBeCloseTo(1);
    expect(right.z).toBeCloseTo(0);
  });

  it('rotates with the camera: at yaw 90° the camera is east, so W moves west', () => {
    const forward = worldMoveDirection(FORWARD, Math.PI / 2);
    expect(forward.x).toBeCloseTo(-1);
    expect(forward.z).toBeCloseTo(0);

    // Standing east of the player facing west, your right hand points north.
    const right = worldMoveDirection(RIGHT, Math.PI / 2);
    expect(right.x).toBeCloseTo(0);
    expect(right.z).toBeCloseTo(-1);
  });

  it('keeps forward and right perpendicular for any yaw', () => {
    for (const yaw of [0.3, 1.1, 2.7, -2.2]) {
      const forward = worldMoveDirection(FORWARD, yaw);
      const right = worldMoveDirection(RIGHT, yaw);
      expect(forward.x * right.x + forward.z * right.z).toBeCloseTo(0);
    }
  });

  it('returns no movement for no input', () => {
    const direction = worldMoveDirection(NO_MOVE, 1.234);
    // toBeCloseTo, not toBe: the result can be -0, which toBe rejects.
    expect(direction.x).toBeCloseTo(0);
    expect(direction.z).toBeCloseTo(0);
  });
});

describe('applyDeadzone', () => {
  it('ignores small stick drift', () => {
    expect(applyDeadzone({ x: 0.05, y: 0.05 })).toEqual(NO_MOVE);
  });

  it('reaches full magnitude at full deflection and keeps the direction', () => {
    const full = applyDeadzone({ x: 1, y: 0 });
    expect(full.x).toBeCloseTo(1);
    expect(full.y).toBeCloseTo(0);

    const diagonal = applyDeadzone({ x: 0.6, y: 0.8 });
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeLessThanOrEqual(1);
    expect(diagonal.x / diagonal.y).toBeCloseTo(0.6 / 0.8);
  });
});

describe('clampMagnitude and addMoveInputs', () => {
  it('normalizes diagonals so W+D is no faster than W', () => {
    const diagonal = clampMagnitude({ x: 1, y: 1 });
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1);
  });

  it('caps the sum of keyboard and joystick input', () => {
    const combined = addMoveInputs({ x: 1, y: 0 }, { x: 1, y: 0 });
    expect(combined.x).toBeCloseTo(1);
    expect(combined.y).toBeCloseTo(0);
  });
});

describe('dampFactor and dampToward', () => {
  it('does nothing when dt is zero, so paused time keeps positions still', () => {
    expect(dampFactor(12, 0)).toBe(0);
    expect(dampToward(3, 10, 12, 0)).toBe(3);
  });

  it('approaches the target and is frame-rate independent', () => {
    // Two half-steps should land where one full step does.
    const oneStep = dampToward(0, 1, 6, 1 / 30);
    const twoHalfSteps = dampToward(dampToward(0, 1, 6, 1 / 60), 1, 6, 1 / 60);
    expect(twoHalfSteps).toBeCloseTo(oneStep, 10);
  });

  it('never overshoots a large dt', () => {
    expect(dampToward(0, 1, 12, 5)).toBeLessThanOrEqual(1);
    expect(dampToward(0, 1, 12, 5)).toBeGreaterThan(0.99);
  });
});

describe('orbitOffset', () => {
  it('places the camera south of the focus point at 45° tilt when yaw is 0', () => {
    const distance = 10;
    const offset = orbitOffset(0, Math.PI / 4, distance);
    expect(offset.x).toBeCloseTo(0);
    expect(offset.y).toBeCloseTo(distance / Math.SQRT2);
    expect(offset.z).toBeCloseTo(distance / Math.SQRT2);
  });

  it('keeps the same distance from the focus point for any yaw', () => {
    for (const yaw of [0, 0.7, 2, -1.3]) {
      const offset = orbitOffset(yaw, Math.PI / 4, 50);
      expect(Math.hypot(offset.x, offset.y, offset.z)).toBeCloseTo(50);
    }
  });
});
