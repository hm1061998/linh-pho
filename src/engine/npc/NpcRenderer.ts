import * as pc from 'playcanvas';
import type { NpcDefinition } from '../../domain/content/types';
import { radToDeg } from '../../shared/utils/math';
import type { AssetLoader } from '../assets/AssetLoader';
import { playLoop } from '../assets/playLoop';
import type { GroundPoint, WalkableWorld } from '../player/collision';
import { dampToward } from '../player/movement';
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
/** Within this distance an NPC turns to greet the player (Stage 8). Dialogue turns them too, once it opens. */
const GREET_RADIUS_M = 4.5;
/**
 * Looking around while idle (Stage 8): the body turns this many degrees each way, and the turn wanders slowly. It eases
 * toward zero while the NPC greets the player, so they keep their eyes on the player.
 */
const LOOK_AMPLITUDE_DEG = 10;
const LOOK_SPEED = 0.5;
const LOOK_RATE = 2;

interface NpcView {
  readonly root: pc.Entity;
  /** The placeholder shape, until the NPC's model replaces it. */
  readonly body: pc.Entity;
  /** Holds the body and the model. It turns for looking around; the root keeps the facing toward the player. */
  readonly look: pc.Entity;
  readonly isSpirit: boolean;
  readonly baseY: number;
  readonly phase: number;
  /** The current look-around angle, in degrees. */
  lookYaw: number;
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
      const look = new pc.Entity(`${npc.id}_Look`);
      look.addChild(body);
      root.addChild(look);

      const baseY = surface + (isSpirit ? npc.hoverHeight : 0);
      root.setLocalPosition(point.x, baseY, point.z);
      root.addChild(this.groundHalo(npc.id, isSpirit ? npc.color : HALO_HUMAN_HEX, surface - baseY));
      parent.addChild(root);
      this.views.set(npc.id, {
        root,
        body,
        look,
        isSpirit,
        baseY,
        // Spread the spirits' bob phases so several spirits do not move in unison.
        phase: index * 1.7,
        lookYaw: 0,
      });
    });
  }

  /**
   * Replaces each placeholder whose model has loaded, and starts the model's idle loop. Call once, after the models have
   * loaded. An NPC without a loaded model keeps its placeholder. A model faces -Z (docs/ASSET_MANIFEST.md section 1), so
   * each model turns half a turn to face +Z, which is the direction `faceToward` aims the root.
   */
  attachModels(assets: AssetLoader): void {
    for (const [id, view] of this.views) {
      const modelId = `npc.${id}`;
      const model = assets.instantiateLoaded(modelId);
      if (!model) {
        continue;
      }
      view.body.destroy();
      model.setLocalEulerAngles(0, 180, 0);
      view.look.addChild(model);
      const track = assets.trackFor(modelId, 'idle');
      if (track) {
        playLoop(model, 'idle', track);
      }
    }
  }

  /**
   * Advances the spirit bob, and turns each NPC within GREET_RADIUS_M of `player` to face them. `dt` is already clamped and
   * is zero while paused. Without a player point, NPCs only bob.
   */
  update(dt: number, player?: GroundPoint): void {
    this.elapsed += dt;
    for (const [id, view] of this.views) {
      const { x, z } = view.root.getLocalPosition();
      const greeting = player !== undefined && Math.hypot(player.x - x, player.z - z) <= GREET_RADIUS_M;
      if (greeting && player) {
        this.faceToward(id, player);
      }
      const lookTarget = greeting ? 0 : LOOK_AMPLITUDE_DEG * Math.sin(this.elapsed * LOOK_SPEED + view.phase);
      view.lookYaw = dampToward(view.lookYaw, lookTarget, LOOK_RATE, dt);
      view.look.setLocalEulerAngles(0, view.lookYaw, 0);
      if (view.isSpirit) {
        const y = view.baseY + Math.sin(this.elapsed * BOB_SPEED + view.phase) * BOB_AMPLITUDE_M;
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
