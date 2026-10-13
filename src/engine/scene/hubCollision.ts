import { GAME_CONTENT } from '../../content';
import { isPointInAabb, type Aabb2, type GroundPoint, type WalkableWorld } from '../player/collision';
import { HUB_HALF_SIZE_M, HUB_PROPS, type BlockoutProp } from './hubLayout';

/** Half-width of a standing NPC's collision box. Matches the player's radius, so they cannot overlap. */
export const NPC_BODY_RADIUS_M = 0.35;

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

/** Walking NPCs block movement. Spirits float and do not. */
const NPC_SOLIDS: readonly Aabb2[] = GAME_CONTENT.npcs
  .filter((npc) => npc.kind === 'human')
  .map((npc) => ({
    minX: npc.position.x - NPC_BODY_RADIUS_M,
    maxX: npc.position.x + NPC_BODY_RADIUS_M,
    minZ: npc.position.z - NPC_BODY_RADIUS_M,
    maxZ: npc.position.z + NPC_BODY_RADIUS_M,
  }));

/**
 * The hub as the player sees it. Solids come from props marked `solid` and from walking NPCs.
 * Walking height is the highest `walkable` top face under a point, or 0 on open ground. Rivers are
 * solid, and the bridge deck is walkable, so the bridge is the only crossing.
 */
export const HUB_WORLD: WalkableWorld = {
  solids: [...HUB_PROPS.filter((prop) => prop.solid).map(footprintOf), ...NPC_SOLIDS],
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
