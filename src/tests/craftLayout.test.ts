import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CRAFT_LANTERN_MIDDLE_Y_M,
  CRAFT_MARK_RADIUS_M,
  CRAFT_TRAIL_STEPS,
  CRAFT_RING_M,
  CRAFT_SOCKET_ANGLES_DEG,
  CRAFT_SOCKET_BASE_Y_M,
  markPosition,
  segmentShape,
  snapProgressToHeight,
  socketPosition,
  trailSegments,
} from '../engine/craft/craftLayout';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

describe('craft layout', () => {
  it('puts the two sockets on one circle, on opposite sides, standing on the bottom ring', () => {
    const points = [0, 1].map((index) => socketPosition(index));
    for (const point of points) {
      expect(Math.hypot(point.x, point.z)).toBeCloseTo(CRAFT_RING_M, 6);
      expect(point.y).toBe(CRAFT_SOCKET_BASE_Y_M);
    }
    // 180 degrees apart: the two sockets are a full diameter of the ring, so they sit 2 × the ring radius apart.
    const distance = Math.hypot(points[0]!.x - points[1]!.x, points[0]!.z - points[1]!.z);
    expect(distance).toBeCloseTo(2 * CRAFT_RING_M, 6);
  });

  it('spreads the marks of a ring evenly, all at the lantern middle', () => {
    const marks = [0, 1, 2].map((index) => markPosition(index, 3));
    for (const mark of marks) {
      expect(mark.y).toBe(CRAFT_LANTERN_MIDDLE_Y_M);
    }
    const d01 = Math.hypot(marks[0]!.x - marks[1]!.x, marks[0]!.z - marks[1]!.z);
    const d12 = Math.hypot(marks[1]!.x - marks[2]!.x, marks[1]!.z - marks[2]!.z);
    expect(d01).toBeCloseTo(d12, 6);
  });

  it('agrees with the models: the socket angles in the Blender source are the ones the engine uses', () => {
    const source = readFileSync(join(ROOT, 'assets_src', 'build_assets.py'), 'utf8');
    const match = source.match(/CRAFT_SOCKET_ANGLES_DEG = \(([^)]*)\)/);
    expect(match).not.toBeNull();
    const angles = match![1]!.split(',').map((value) => Number(value.trim()));
    expect(angles).toEqual([...CRAFT_SOCKET_ANGLES_DEG]);
    const ring = source.match(/CRAFT_RING_M = ([0-9.]+)/);
    expect(Number(ring![1])).toBe(CRAFT_RING_M);
  });

  it('runs the trail around the ring between marks lit in a row, in the order they were lit', () => {
    // Lit out of order: the second mark was lit first, then the first, then the third. Two arcs, each of CRAFT_TRAIL_STEPS pieces.
    const lit = [
      { index: 1, step: 0 },
      { index: 0, step: 1 },
      { index: 2, step: 2 },
    ];
    const segments = trailSegments(lit, 3);
    expect(segments).toHaveLength(2 * CRAFT_TRAIL_STEPS);
    // The first arc starts at mark 1 and ends at mark 0. The second ends at mark 2.
    expect(segments[0]!.from.x).toBeCloseTo(markPosition(1, 3).x, 6);
    expect(segments[0]!.from.z).toBeCloseTo(markPosition(1, 3).z, 6);
    expect(segments[CRAFT_TRAIL_STEPS - 1]!.to.x).toBeCloseTo(markPosition(0, 3).x, 6);
    expect(segments[CRAFT_TRAIL_STEPS - 1]!.to.z).toBeCloseTo(markPosition(0, 3).z, 6);
    expect(segments[segments.length - 1]!.to.x).toBeCloseTo(markPosition(2, 3).x, 6);
    expect(segments[segments.length - 1]!.to.z).toBeCloseTo(markPosition(2, 3).z, 6);
  });

  it('keeps every trail piece on the ring, so the light follows the lantern', () => {
    const segments = trailSegments(
      [
        { index: 0, step: 0 },
        { index: 1, step: 1 },
      ],
      3,
    );
    for (const { from, to } of segments) {
      expect(Math.hypot(from.x, from.z)).toBeCloseTo(CRAFT_MARK_RADIUS_M, 6);
      expect(Math.hypot(to.x, to.z)).toBeCloseTo(CRAFT_MARK_RADIUS_M, 6);
    }
  });

  it('draws nothing for one lit mark, and nothing for none', () => {
    expect(trailSegments([], 3)).toEqual([]);
    expect(trailSegments([{ index: 0, step: 0 }], 3)).toEqual([]);
  });

  it('measures a segment: its midpoint and its length', () => {
    const shape = segmentShape({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0.4 });
    expect(shape.length).toBeCloseTo(0.4, 6);
    expect(shape.mid).toEqual({ x: 0, y: 0, z: 0.2 });
  });

  it('drops a rib from above into its socket, slowing as it lands', () => {
    expect(snapProgressToHeight(0)).toBeGreaterThan(CRAFT_SOCKET_BASE_Y_M);
    expect(snapProgressToHeight(1)).toBeCloseTo(CRAFT_SOCKET_BASE_Y_M, 9);
    // Ease-out: most of the drop happens early, so less than half the height is left at the halfway point.
    const leftAtHalf = snapProgressToHeight(0.5) - CRAFT_SOCKET_BASE_Y_M;
    const leftAtStart = snapProgressToHeight(0) - CRAFT_SOCKET_BASE_Y_M;
    expect(leftAtHalf).toBeLessThan(leftAtStart / 2);
  });
});
