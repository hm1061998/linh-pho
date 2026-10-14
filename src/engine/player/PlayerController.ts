import * as pc from 'playcanvas';
import { radToDeg, shortestAngleDelta } from '../../shared/utils/math';
import type { AssetLoader } from '../assets/AssetLoader';
import { startStates } from '../assets/playLoop';
import type { MoveInput } from '../input/moveInput';
import { colorFromHex } from '../scene/colorFromHex';
import { clampCircleToBounds, moveWithCollision, type GroundPoint, type WalkableWorld } from './collision';
import { dampFactor, worldMoveDirection } from './movement';
import { PLAYER_CONFIG, type PlayerConfig } from './playerConfig';
import { locomotionState, type LocomotionState } from './locomotion';

const BODY_COLOR = '#F5ECD7';
const FACING_COLOR = '#BC744E';
/** Below this speed (m/s) the player counts as standing still, and velocity snaps to zero. */
const STOP_SPEED = 0.01;
/** Below this speed the facing direction is not updated, so standing still keeps the last heading. */
const TURN_SPEED = 0.1;

/**
 * The playable character (GDD E2). It starts as a capsule with a nose marker that shows facing. When its model has loaded,
 * `attachModel` replaces both, and the model plays idle or walk by speed. Movement is in the XZ plane. Height comes from
 * `world.surfaceHeightAt`.
 */
export class PlayerController {
  private readonly root: pc.Entity;
  private readonly world: WalkableWorld;
  private readonly config: PlayerConfig;
  private readonly placeholder: pc.Entity[];
  private animator: { set(state: string, speed?: number): void } | null = null;
  private movementState: LocomotionState = 'idle';
  private hasRunClip = false;
  private animationSpeed = 1;
  private position: GroundPoint;
  private velocity: GroundPoint = { x: 0, z: 0 };
  /** Heading in radians around +Y. 0 faces +Z (south); the capsule's nose points along it. */
  private facingYaw = 0;

  constructor(parent: pc.Entity, world: WalkableWorld, config: PlayerConfig = PLAYER_CONFIG) {
    this.world = world;
    this.config = config;
    // Start from a legal position in case the spawn point overlaps an obstacle.
    this.position = moveWithCollision(config.start, { x: 0, z: 0 }, config.radius, world.solids);

    this.root = new pc.Entity('PLAYER_Root');

    // The primitive capsule is radius 0.5 and total height 2, so scale it to the configured size.
    const body = new pc.Entity('PLAYER_Body');
    body.addComponent('render', {
      type: 'capsule',
      material: this.createMaterial(BODY_COLOR),
    });
    body.setLocalScale(config.radius * 2, config.height / 2, config.radius * 2);
    body.setLocalPosition(0, config.height / 2, 0);

    const nose = new pc.Entity('PLAYER_Facing');
    nose.addComponent('render', {
      type: 'box',
      material: this.createMaterial(FACING_COLOR),
    });
    nose.setLocalScale(0.12, 0.12, 0.3);
    nose.setLocalPosition(0, config.height * 0.75, config.radius + 0.1);

    this.placeholder = [body, nose];
    this.root.addChild(body);
    this.root.addChild(nose);
    parent.addChild(this.root);
    this.applyTransform();
  }

  /**
   * Replaces the placeholder with the character model, once it has loaded, and starts its idle loop. The model faces -Z, so
   * it turns half a turn to face the direction the root points. Without a loaded model, the placeholder stays.
   */
  attachModel(assets: AssetLoader): void {
    const model = assets.instantiateLoaded('player.hero');
    if (!model) {
      return;
    }
    for (const entity of this.placeholder) {
      entity.destroy();
    }
    this.placeholder.length = 0;
    model.setLocalEulerAngles(0, 180, 0);
    this.root.addChild(model);
    const idle = assets.trackFor('player.hero', 'idle');
    const walk = assets.trackFor('player.hero', 'walk');
    const run = assets.trackFor('player.hero', 'run');
    if (idle && walk) {
      this.hasRunClip = run !== null;
      this.animator = startStates(model, run ? { idle, walk, run } : { idle, walk }, 'idle');
    }
  }

  /** Current ground position. Returns a copy. */
  get groundPosition(): GroundPoint {
    return { x: this.position.x, z: this.position.z };
  }

  /**
   * Intended speed in m/s, before collision. It stays high while pressing against an obstacle, because
   * the velocity is not reduced by walls. The real displacement is shorter in that case.
   */
  get speed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  /**
   * Advances the player one step. `move` is camera-space intent. `cameraYaw` is the camera's yaw, so
   * "forward" always means away from the camera. `dt` is already clamped by the engine (0.1 s max).
   */
  update(dt: number, move: MoveInput, cameraYaw: number, sprintHeld = false): void {
    const { walkSpeed, runSpeed, accelerationRate, turnRate, radius } = this.config;

    const direction = worldMoveDirection(move, cameraYaw);
    const movementSpeed = sprintHeld ? runSpeed : walkSpeed;
    const target = { x: direction.x * movementSpeed, z: direction.z * movementSpeed };
    const blend = dampFactor(accelerationRate, dt);
    this.velocity = {
      x: this.velocity.x + (target.x - this.velocity.x) * blend,
      z: this.velocity.z + (target.z - this.velocity.z) * blend,
    };
    if (target.x === 0 && target.z === 0 && this.speed < STOP_SPEED) {
      this.velocity = { x: 0, z: 0 };
    }

    const delta = { x: this.velocity.x * dt, z: this.velocity.z * dt };
    const previous = this.position;
    const moved = moveWithCollision(this.position, delta, radius, this.world.solids);
    this.position = clampCircleToBounds(moved, radius, this.world.bounds);

    if (this.speed > TURN_SPEED) {
      const targetYaw = Math.atan2(this.velocity.x, this.velocity.z);
      this.facingYaw += shortestAngleDelta(this.facingYaw, targetYaw) * dampFactor(turnRate, dt);
    }

    // Animate actual travel, so feet stop when pushing against a wall. Separate start/stop
    // thresholds prevent repeated transitions near the edge of the joystick dead zone.
    if (dt > 0) {
      const travelSpeed = Math.hypot(this.position.x - previous.x, this.position.z - previous.z) / dt;
      this.movementState = locomotionState(travelSpeed, walkSpeed, this.movementState, sprintHeld, this.hasRunClip);
        // Keep the brisk walk readable at the faster map traversal speed.
        const referenceSpeed = this.movementState === 'run' ? 4.51 : 1.3;
      const cadence = this.movementState !== 'idle' ? Math.max(0.25, Math.min(1.9, travelSpeed / referenceSpeed)) : 1;
      this.animationSpeed += (cadence - this.animationSpeed) * dampFactor(10, dt);
      this.animator?.set(this.movementState, this.animationSpeed);
    }
    this.applyTransform();
  }

  dispose(): void {
    this.root.destroy();
  }

  private applyTransform(): void {
    const surface = this.world.surfaceHeightAt(this.position);
    this.root.setLocalPosition(this.position.x, surface, this.position.z);
    this.root.setLocalEulerAngles(0, radToDeg(this.facingYaw), 0);
  }

  private createMaterial(hex: string): pc.StandardMaterial {
    const material = new pc.StandardMaterial();
    material.diffuse = colorFromHex(hex);
    material.gloss = 0.3;
    material.update();
    return material;
  }
}
