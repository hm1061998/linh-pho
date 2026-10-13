import * as pc from 'playcanvas';
import type { NpcDefinition } from '../../domain/content/types';
import { radToDeg } from '../../shared/utils/math';
import type { GroundPoint, WalkableWorld } from '../player/collision';
import { colorFromHex } from '../scene/colorFromHex';

/** Human body height in meters. Matches the placeholder player capsule. */
const HUMAN_HEIGHT_M = 1.7;
const HUMAN_RADIUS_M = 0.35;
/** Spirit bob: amplitude in meters and angular speed in radians per second. */
const BOB_AMPLITUDE_M = 0.08;
const BOB_SPEED = 2.2;
const SPIRIT_DIAMETER_M = 0.36;

interface NpcView {
  readonly root: pc.Entity;
  readonly isSpirit: boolean;
  readonly baseY: number;
  readonly phase: number;
}

/**
 * Renders NPCs as placeholder primitives: a capsule for humans and a glowing sphere for spirits.
 * Spirits bob in place (Art Bible §5), so no skeleton is needed. Facing follows the player during
 * dialogue. Real models replace these in Module 09.
 */
export class NpcRenderer {
  private readonly views = new Map<string, NpcView>();
  private elapsed = 0;

  constructor(parent: pc.Entity, npcs: readonly NpcDefinition[], world: WalkableWorld) {
    npcs.forEach((npc, index) => {
      const point: GroundPoint = { x: npc.position.x, z: npc.position.z };
      const surface = world.surfaceHeightAt(point);
      const isSpirit = npc.kind === 'spirit';

      const root = new pc.Entity(npc.id);
      const body = new pc.Entity(`${npc.id}_Body`);
      if (isSpirit) {
        const material = new pc.StandardMaterial();
        material.diffuse = colorFromHex(npc.color);
        material.emissive = colorFromHex(npc.color);
        material.emissiveIntensity = 1.8;
        material.update();
        body.addComponent('render', { type: 'sphere', material });
        body.setLocalScale(SPIRIT_DIAMETER_M, SPIRIT_DIAMETER_M, SPIRIT_DIAMETER_M);
      } else {
        const material = new pc.StandardMaterial();
        material.diffuse = colorFromHex(npc.color);
        material.gloss = 0.2;
        material.update();
        body.addComponent('render', { type: 'capsule', material });
        body.setLocalScale(HUMAN_RADIUS_M * 2, HUMAN_HEIGHT_M / 2, HUMAN_RADIUS_M * 2);
        body.setLocalPosition(0, HUMAN_HEIGHT_M / 2, 0);
      }
      root.addChild(body);

      const baseY = surface + (isSpirit ? npc.hoverHeight : 0);
      root.setLocalPosition(point.x, baseY, point.z);
      parent.addChild(root);
      this.views.set(npc.id, {
        root,
        isSpirit,
        baseY,
        // Spread the spirits' bob phases so several spirits do not move in unison.
        phase: index * 1.7,
      });
    });
  }

  /** Advances the spirit bob. `dt` is already clamped and is zero while paused. */
  update(dt: number): void {
    this.elapsed += dt;
    for (const view of this.views.values()) {
      if (view.isSpirit) {
        const y = view.baseY + Math.sin(this.elapsed * BOB_SPEED + view.phase) * BOB_AMPLITUDE_M;
        const { x, z } = view.root.getLocalPosition();
        view.root.setLocalPosition(x, y, z);
      }
    }
  }

  /** Turns an NPC to face a ground point, for example the player during dialogue. */
  faceToward(npcId: string, point: GroundPoint): void {
    const view = this.views.get(npcId);
    if (!view) {
      return;
    }
    const { x, z } = view.root.getLocalPosition();
    const yaw = Math.atan2(point.x - x, point.z - z);
    view.root.setLocalEulerAngles(0, radToDeg(yaw), 0);
  }

  /** Removes the NPC entities. The parent belongs to the app and is not touched. */
  dispose(): void {
    for (const view of this.views.values()) {
      view.root.destroy();
    }
    this.views.clear();
  }
}
