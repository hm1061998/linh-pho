import { describe, expect, it } from 'vitest';
import { PLAYER_CONFIG } from '../engine/player/playerConfig';
import { isPointInAabb, moveWithCollision, type GroundPoint } from '../engine/player/collision';
import { HUB_WORLD } from '../engine/scene/hubCollision';

const { radius } = PLAYER_CONFIG;

function isBlockedAt(point: GroundPoint): boolean {
  return HUB_WORLD.solids.some((box) => isPointInAabb(point, box));
}

describe('hub collision world', () => {
  it('spawns the player on free ground', () => {
    const spawn = PLAYER_CONFIG.start;
    const stays = moveWithCollision(spawn, { x: 0, z: 0 }, radius, HUB_WORLD.solids);
    expect(stays.x).toBeCloseTo(spawn.x);
    expect(stays.z).toBeCloseTo(spawn.z);
  });

  it('keeps all solids inside the hub bounds', () => {
    for (const box of HUB_WORLD.solids) {
      expect(box.minX).toBeGreaterThanOrEqual(HUB_WORLD.bounds.minX - 1e-9);
      expect(box.maxX).toBeLessThanOrEqual(HUB_WORLD.bounds.maxX + 1e-9);
      expect(box.minZ).toBeGreaterThanOrEqual(HUB_WORLD.bounds.minZ - 1e-9);
      expect(box.maxZ).toBeLessThanOrEqual(HUB_WORLD.bounds.maxZ + 1e-9);
    }
  });

  it('blocks the river but leaves the bridge crossing open', () => {
    expect(isBlockedAt({ x: 3, z: 23 })).toBe(true); // river, west of the bridge
    expect(isBlockedAt({ x: 25, z: 23 })).toBe(true); // river, east of the bridge
    expect(isBlockedAt({ x: 8, z: 23 })).toBe(false); // middle of the bridge deck
  });

  it('lets the player walk south across the bridge and stop at the hub edge', () => {
    const end = moveWithCollision({ x: 8, z: 17 }, { x: 0, z: 14 }, radius, HUB_WORLD.solids);
    expect(end.x).toBeCloseTo(8);
    expect(end.z).toBeGreaterThan(26); // past the river (z 20–26)
  });

  it('stops a walker who tries to wade straight through the river', () => {
    const end = moveWithCollision({ x: 3, z: 17 }, { x: 0, z: 10 }, radius, HUB_WORLD.solids);
    expect(end.z).toBeLessThan(20);
  });

  it('gives walking height 0 on open ground, the plaza top on the plaza, and the deck top on the bridge', () => {
    expect(HUB_WORLD.surfaceHeightAt({ x: -25, z: -25 })).toBe(0);
    expect(HUB_WORLD.surfaceHeightAt({ x: 0, z: 0 })).toBeCloseTo(0.08);
    expect(HUB_WORLD.surfaceHeightAt({ x: 8, z: 23 })).toBeCloseTo(0.375);
    expect(HUB_WORLD.surfaceHeightAt({ x: 3, z: 23 })).toBe(0); // river is not walkable
  });
});
