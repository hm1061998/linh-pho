import { describe, expect, it } from 'vitest';
import { segmentHitsBox, type Box3, type Point3 } from '../engine/world/roofFade';

// A 2 m cube centred at (0, 5, 0): it spans x, y and z from -1 to 1 around (0, 5, 0).
const ROOF: Box3 = { center: { x: 0, y: 5, z: 0 }, half: { x: 1, y: 1, z: 1 } };

const at = (x: number, y: number, z: number): Point3 => ({ x, y, z });

describe('segmentHitsBox', () => {
  it('reports a segment that passes straight through the box', () => {
    expect(segmentHitsBox(at(0, 10, 0), at(0, 0, 0), ROOF)).toBe(true);
  });

  it('reports a segment that passes through a corner of the box, a diagonal one', () => {
    expect(segmentHitsBox(at(-5, 9, -5), at(5, 1, 5), ROOF)).toBe(true);
  });

  it('reports a segment that goes around the box', () => {
    // Passes at x = 3, beside the box, which only reaches x = 1.
    expect(segmentHitsBox(at(3, 10, 0), at(3, 0, 0), ROOF)).toBe(false);
  });

  it('reports a segment that stays above the box', () => {
    expect(segmentHitsBox(at(0, 10, 0), at(0, 8, 0), ROOF)).toBe(false);
  });

  it('reports a segment that stops short of the box', () => {
    // Ends at y = 7, above the box's top at y = 6, so the segment never reaches the box.
    expect(segmentHitsBox(at(0, 10, 0), at(0, 7, 0), ROOF)).toBe(false);
  });

  it('counts a segment that only touches a face', () => {
    expect(segmentHitsBox(at(1, 10, 0), at(1, 0, 0), ROOF)).toBe(true);
  });

  it('reports a segment that is parallel to an axis and inside its slab', () => {
    // Runs along x at y = 5, z = 0: inside the box on y and z for the whole length.
    expect(segmentHitsBox(at(-10, 5, 0), at(10, 5, 0), ROOF)).toBe(true);
  });

  it('reports a segment that is parallel to an axis but outside its slab', () => {
    expect(segmentHitsBox(at(-10, 5, 2), at(10, 5, 2), ROOF)).toBe(false);
  });

  it('reports nothing for a segment that lies wholly before the box', () => {
    expect(segmentHitsBox(at(0, 20, 0), at(0, 10, 0), ROOF)).toBe(false);
  });
});
