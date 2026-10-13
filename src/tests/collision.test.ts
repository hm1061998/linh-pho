import { describe, expect, it } from 'vitest';
import {
  clampCircleToBounds,
  isPointInAabb,
  moveWithCollision,
  resolveCircleAabb,
  type Aabb2,
} from '../engine/player/collision';

const RADIUS = 0.35;
const WALL: Aabb2 = { minX: 0, maxX: 10, minZ: -5, maxZ: 5 };
const BIG_BOUNDS: Aabb2 = { minX: -30, maxX: 30, minZ: -30, maxZ: 30 };

describe('resolveCircleAabb', () => {
  it('leaves a circle that does not touch the box unchanged', () => {
    expect(resolveCircleAabb({ x: -2, z: 0 }, RADIUS, WALL)).toEqual({ x: -2, z: 0 });
  });

  it('pushes a circle that overlaps the left face out to exactly one radius away', () => {
    const pushed = resolveCircleAabb({ x: -0.2, z: 0 }, RADIUS, WALL);
    expect(pushed.x).toBeCloseTo(-RADIUS);
    expect(pushed.z).toBeCloseTo(0);
  });

  it('pushes a circle at a corner along the diagonal normal', () => {
    // Closest point is the corner (0, -5). The circle center is 0.2 away in x and 0.2 away in z.
    const pushed = resolveCircleAabb({ x: -0.2, z: -5.2 }, RADIUS, WALL);
    const distance = Math.hypot(pushed.x, pushed.z + 5);
    expect(distance).toBeCloseTo(RADIUS);
  });

  it('exits through the nearest face when the center is inside the box', () => {
    // Center is 0.5 from the left face, far from the others. It should exit left.
    const pushed = resolveCircleAabb({ x: 0.5, z: 0 }, RADIUS, WALL);
    expect(pushed.x).toBeCloseTo(-RADIUS);
    expect(pushed.z).toBeCloseTo(0);
  });
});

describe('moveWithCollision', () => {
  it('stops a circle at the wall face minus its radius', () => {
    const end = moveWithCollision({ x: -5, z: 0 }, { x: 20, z: 0 }, RADIUS, [WALL]);
    expect(end.x).toBeCloseTo(-RADIUS, 5);
    expect(end.z).toBeCloseTo(0);
  });

  it('cannot tunnel through a thin obstacle in one long move', () => {
    // A 0.12 m post, much thinner than the 0.4 m move. Without sub-steps the circle would land beyond it.
    const post: Aabb2 = { minX: 0, maxX: 0.12, minZ: -1, maxZ: 1 };
    const end = moveWithCollision({ x: -2, z: 0 }, { x: 4, z: 0 }, RADIUS, [post]);
    expect(end.x).toBeLessThanOrEqual(-RADIUS + 1e-6);
  });

  it('slides along a wall when the move has a component parallel to it', () => {
    const end = moveWithCollision({ x: -2, z: 0 }, { x: 5, z: 1.5 }, RADIUS, [WALL]);
    expect(end.x).toBeCloseTo(-RADIUS, 5);
    expect(end.z).toBeCloseTo(1.5, 5);
  });

  it('moves freely when nothing is in the way', () => {
    const end = moveWithCollision({ x: -20, z: -20 }, { x: 1, z: 2 }, RADIUS, [WALL]);
    expect(end.x).toBeCloseTo(-19);
    expect(end.z).toBeCloseTo(-18);
  });

  it('resolves an overlap at the start before moving', () => {
    const end = moveWithCollision({ x: -0.1, z: 0 }, { x: 0, z: 0 }, RADIUS, [WALL]);
    expect(end.x).toBeCloseTo(-RADIUS);
  });
});

describe('clampCircleToBounds', () => {
  it('keeps the whole circle inside the area', () => {
    const clamped = clampCircleToBounds({ x: 40, z: -40 }, RADIUS, BIG_BOUNDS);
    expect(clamped.x).toBeCloseTo(30 - RADIUS);
    expect(clamped.z).toBeCloseTo(-30 + RADIUS);
  });
});

describe('isPointInAabb', () => {
  it('includes points inside and on the edge, and excludes points outside', () => {
    expect(isPointInAabb({ x: 5, z: 0 }, WALL)).toBe(true);
    expect(isPointInAabb({ x: 0, z: 5 }, WALL)).toBe(true);
    expect(isPointInAabb({ x: -0.01, z: 0 }, WALL)).toBe(false);
  });
});
