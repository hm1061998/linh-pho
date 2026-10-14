import * as pc from 'playcanvas';
import { standardInstances } from '../scene/materialClones';

/** Height of the player's head above the ground, in metres. The fade test looks at this point, not at the feet. */
export const PLAYER_HEAD_HEIGHT_M = 1.5;
/** Opacity of a roof that hides the player. A roof that does not hide the player stays fully opaque. */
export const ROOF_FADED_OPACITY = 0.3;
/** How fast a roof's opacity moves toward its target, in fractions of the gap per second. */
const FADE_RATE_PER_S = 6;
const SNAP_DISTANCE = 0.001;

export interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** An axis-aligned box given by its centre and its half sizes. */
export interface Box3 {
  readonly center: Point3;
  readonly half: Point3;
}

/**
 * True when the segment from `from` to `to` passes through the box. Uses the slab method: for each axis, the segment's
 * entry and exit times must overlap the box's range on that axis. Touching a face counts as a hit.
 */
export function segmentHitsBox(from: Point3, to: Point3, box: Box3): boolean {
  let enter = 0;
  let exit = 1;
  for (const axis of ['x', 'y', 'z'] as const) {
    const start = from[axis];
    const delta = to[axis] - start;
    const low = box.center[axis] - box.half[axis];
    const high = box.center[axis] + box.half[axis];
    if (Math.abs(delta) < 1e-9) {
      if (start < low || start > high) {
        return false;
      }
      continue;
    }
    let t1 = (low - start) / delta;
    let t2 = (high - start) / delta;
    if (t1 > t2) {
      [t1, t2] = [t2, t1];
    }
    enter = Math.max(enter, t1);
    exit = Math.min(exit, t2);
    if (enter > exit) {
      return false;
    }
  }
  return true;
}

interface RoofView {
  readonly box: Box3;
  readonly materials: pc.StandardMaterial[];
  opacity: number;
}

/** Copies every standard material under a roof, so the fade changes only that roof, and makes each copy blend. */
function fadeMaterials(root: pc.Entity): pc.StandardMaterial[] {
  const clones = new Map<pc.StandardMaterial, pc.StandardMaterial>();
  for (const instance of standardInstances(root)) {
    const shared = instance.material as pc.StandardMaterial;
    let own = clones.get(shared);
    if (!own) {
      own = shared.clone();
      own.blendType = pc.BLEND_NORMAL;
      own.opacity = 1;
      own.update();
      clones.set(shared, own);
    }
    instance.material = own;
  }
  return [...clones.values()];
}

/**
 * Fades the roofs that stand between the camera and the player's head (GDD B2, E1), so the player stays visible behind
 * a roof. Each roof gets its own material copies, so fading one does not fade the others that share a material.
 */
export class RoofFader {
  private readonly roofs: RoofView[];

  constructor(roofs: ReadonlyArray<{ readonly root: pc.Entity; readonly box: Box3 }>) {
    this.roofs = roofs.map(({ root, box }) => ({ box, materials: fadeMaterials(root), opacity: 1 }));
  }

  /** Moves each roof's opacity toward faded or opaque, depending on whether it hides the head this frame. */
  update(dt: number, camera: Point3, head: Point3): void {
    const step = Math.min(1, dt * FADE_RATE_PER_S);
    for (const roof of this.roofs) {
      const target = segmentHitsBox(camera, head, roof.box) ? ROOF_FADED_OPACITY : 1;
      if (roof.opacity === target) {
        continue;
      }
      const next = roof.opacity + (target - roof.opacity) * step;
      roof.opacity = Math.abs(target - next) < SNAP_DISTANCE ? target : next;
      for (const material of roof.materials) {
        material.opacity = roof.opacity;
        material.update();
      }
    }
  }
}
