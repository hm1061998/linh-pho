import * as pc from 'playcanvas';
import type { NpcDefinition } from '../../domain/content/types';
import { radToDeg } from '../../shared/utils/math';
import type { AssetLoader } from '../assets/AssetLoader';
import { playLoop } from '../assets/playLoop';
import type { GroundPoint, WalkableWorld } from '../player/collision';
import { colorFromHex } from '../scene/colorFromHex';

/** Human body height in meters. Matches the placeholder player capsule. */
const HUMAN_HEIGHT_M = 1.7;
const HUMAN_RADIUS_M = 0.35;
/** Spirit bob: amplitude in meters and angular speed in radians per second. */
const BOB_AMPLITUDE_M = 0.08;
const BOB_SPEED = 2.2;
const SPIRIT_DIAMETER_M = 0.36;
/**
 * A ring of light on the ground under each NPC. From the default camera a person is only a few pixels tall, and the
 * ring is what makes them read against the dark ground (GDD E3, visual acceptance). A spirit's ring keeps its own colour.
 */
const HALO_DIAMETER_M = 1.1;
const HALO_THICKNESS_M = 0.02;
const HALO_HUMAN_HEX = '#F2B759';
const HALO_INTENSITY = 0.6;

interface NpcView {
  readonly root: pc.Entity;
  /** The placeholder shape, until the NPC's model replaces it. */
  readonly body: pc.Entity;
  readonly isSpirit: boolean;
  readonly baseY: number;
  readonly phase: number;
}

/**
 * Renders each NPC as a placeholder primitive (a capsule for humans, a glowing sphere for spirits) until `attachModels`
 * swaps in its model, which is in assets.json as `npc.<npc id>`. Spirits bob in place (Art Bible §5). Facing follows
 * the player during dialogue.
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
      root.addChild(this.groundHalo(npc.id, isSpirit ? npc.color : HALO_HUMAN_HEX, surface - baseY));
      parent.addChild(root);
      this.views.set(npc.id, {
        root,
        body,
        isSpirit,
        baseY,
        // Spread the spirits' bob phases so several spirits do not move in unison.
        phase: index * 1.7,
      });
    });
  }

  /**
   * Replaces each placeholder whose model has loaded, and starts the model's idle loop. Call once, after the models have
   * loaded. An NPC without a loaded model keeps its placeholder. A model faces -Z (docs/ASSET_MANIFEST.md section 1), so
   * a human turns half a turn to face +Z, which is the direction `faceToward` aims the root.
   */
  attachModels(assets: AssetLoader): void {
    for (const [id, view] of this.views) {
      const modelId = `npc.${id}`;
      const model = assets.instantiateLoaded(modelId);
      if (!model) {
        continue;
      }
      view.body.destroy();
      if (!view.isSpirit) {
        model.setLocalEulerAngles(0, 180, 0);
      }
      view.root.addChild(model);
      const track = assets.trackFor(modelId, 'idle');
      if (track) {
        playLoop(model, 'idle', track);
      }
    }
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

  /**
   * A flat ring of light on the ground. `groundOffsetM` is the ground's height relative to the NPC's root, so a spirit's
   * ring sits on the ground under its hover. The ring stays when the model replaces the placeholder.
   */
  private groundHalo(id: string, hex: string, groundOffsetM: number): pc.Entity {
    const material = new pc.StandardMaterial();
    material.diffuse = colorFromHex(hex);
    material.emissive = colorFromHex(hex);
    material.emissiveIntensity = HALO_INTENSITY;
    material.update();
    const halo = new pc.Entity(`${id}_Halo`);
    halo.addComponent('render', { type: 'cylinder', material });
    halo.setLocalScale(HALO_DIAMETER_M, HALO_THICKNESS_M, HALO_DIAMETER_M);
    halo.setLocalPosition(0, groundOffsetM + HALO_THICKNESS_M / 2, 0);
    return halo;
  }

  /** Removes the NPC entities. The parent belongs to the app and is not touched. */
  dispose(): void {
    for (const view of this.views.values()) {
      view.root.destroy();
    }
    this.views.clear();
  }
}
