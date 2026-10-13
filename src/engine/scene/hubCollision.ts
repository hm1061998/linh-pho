import { isPointInAabb, type Aabb2, type GroundPoint, type WalkableWorld } from '../player/collision';
import { HUB_HALF_SIZE_M, HUB_PROPS, type BlockoutProp } from './hubLayout';

/** XZ footprint of a prop: its box, ignoring height. */
function footprintOf(prop: BlockoutProp): Aabb2 {
  const [x, , z] = prop.position;
  const [sizeX, , sizeZ] = prop.size;
  return {
    minX: x - sizeX / 2,
    maxX: x + sizeX / 2,
    minZ: z - sizeZ / 2,
    maxZ: z + sizeZ / 2,
  };
}

const WALKABLE_SURFACES: readonly { readonly box: Aabb2; readonly top: number }[] = HUB_PROPS.filter(
  (prop) => prop.walkable,
).map((prop) => ({
  box: footprintOf(prop),
  top: prop.position[1] + prop.size[1] / 2,
}));

/**
 * The hub as the player sees it. Solids come from props marked `solid`. Walking height is the highest
 * `walkable` top face under a point, or 0 on open ground. Rivers are solid, and the bridge deck is
 * walkable, so the bridge is the only crossing.
 */
export const HUB_WORLD: WalkableWorld = {
  solids: HUB_PROPS.filter((prop) => prop.solid).map(footprintOf),
  bounds: {
    minX: -HUB_HALF_SIZE_M,
    maxX: HUB_HALF_SIZE_M,
    minZ: -HUB_HALF_SIZE_M,
    maxZ: HUB_HALF_SIZE_M,
  },
  surfaceHeightAt(point: GroundPoint): number {
    let height = 0;
    for (const surface of WALKABLE_SURFACES) {
      if (surface.top > height && isPointInAabb(point, surface.box)) {
        height = surface.top;
      }
    }
    return height;
  },
};
