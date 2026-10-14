import * as pc from 'playcanvas';
import { clamp, degToRad, wrapAngle } from '../../shared/utils/math';
import { clampPointToBounds, type Aabb2, type GroundPoint } from '../player/collision';
import { dampToward, orbitOffset } from '../player/movement';
import { colorFromHex } from '../scene/colorFromHex';

export interface CameraConfig {
  /** Tilt above the horizon in degrees. The GDD asks for 40–50°. */
  readonly pitchDeg: number;
  readonly fovDeg: number;
  /** Opening distance in meters, close enough to read the character and its steps. */
  readonly defaultDistance: number;
  /** Closest zoom in meters. Including focus height, the camera remains above the roofs at 40°. */
  readonly minDistance: number;
  readonly maxDistance: number;
  /** How fast the focus point catches up with the player, in 1/s. */
  readonly followRate: number;
  /** How fast zoom eases to its target, in 1/s. */
  readonly zoomRate: number;
  readonly clearColor: string;
}

export const CAMERA_CONFIG: CameraConfig = {
  pitchDeg: 40,
  fovDeg: 50,
  defaultDistance: 14,
  minDistance: 9,
  maxDistance: 60,
  followRate: 6,
  zoomRate: 8,
  clearColor: '#0F1A2A',
};

/**
 * Third-person 3/4 camera. Keeps a fixed tilt, orbits the focus point by yaw, zooms within bounds,
 * and eases toward the player. The focus point never leaves the playable area.
 */
export class CameraController {
  private readonly entity: pc.Entity;
  private readonly config: CameraConfig;
  private readonly bounds: Aabb2;
  private yaw = 0;
  private distance: number;
  private targetDistance: number;
  private focus: GroundPoint;

  constructor(parent: pc.Entity, initialFocus: GroundPoint, bounds: Aabb2, config: CameraConfig = CAMERA_CONFIG) {
    this.config = config;
    this.bounds = bounds;
    this.focus = clampPointToBounds(initialFocus, bounds);
    this.distance = config.defaultDistance;
    this.targetDistance = config.defaultDistance;

    this.entity = new pc.Entity('CAM_Main');
    this.entity.addComponent('camera', {
      clearColor: colorFromHex(config.clearColor),
      fov: config.fovDeg,
      nearClip: 0.5,
      farClip: 300,
    });
    parent.addChild(this.entity);
    this.applyTransform();
  }

  /** Camera yaw in radians. 0 means the camera sits south of the focus point. */
  get yawRadians(): number {
    return this.yaw;
  }

  /** Current distance from the focus point in meters, after easing. */
  get currentDistance(): number {
    return this.distance;
  }

  /** The camera component, for effects that run on the camera frame (see render/PostEffects.ts). */
  get component(): pc.CameraComponent {
    const camera = this.entity.camera;
    if (!camera) {
      throw new Error('CAM_Main has no camera component');
    }
    return camera;
  }

  /** Where the camera stands in the world. Returns a copy, so a caller cannot move the camera through it. */
  get position(): pc.Vec3 {
    return this.entity.getPosition().clone();
  }

  /**
   * Applies one frame of camera input and eases toward the follow point.
   * `follow` is normally the player's ground position. `yawDelta` is radians of drag. `zoomDelta` is meters.
   */
  update(dt: number, follow: GroundPoint, yawDelta: number, zoomDelta: number): void {
    this.yaw = wrapAngle(this.yaw + yawDelta);

    const { minDistance, maxDistance, zoomRate, followRate } = this.config;
    this.targetDistance = clamp(this.targetDistance + zoomDelta, minDistance, maxDistance);
    this.distance = dampToward(this.distance, this.targetDistance, zoomRate, dt);

    const goal = clampPointToBounds(follow, this.bounds);
    this.focus = {
      x: dampToward(this.focus.x, goal.x, followRate, dt),
      z: dampToward(this.focus.z, goal.z, followRate, dt),
    };

    this.applyTransform();
  }

  dispose(): void {
    this.entity.destroy();
  }

  private applyTransform(): void {
    const offset = orbitOffset(this.yaw, degToRad(this.config.pitchDeg), this.distance);
    const focusHeight = 0.85;
    this.entity.setPosition(this.focus.x + offset.x, focusHeight + offset.y, this.focus.z + offset.z);
    this.entity.lookAt(this.focus.x, focusHeight, this.focus.z);
  }
}
