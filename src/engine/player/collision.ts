import { clamp } from '../../shared/utils/math';

/** A point on the ground plane, in world X and Z. Height is handled by the caller. */
export interface GroundPoint {
  readonly x: number;
  readonly z: number;
}

/** Axis-aligned rectangle on the ground plane. */
export interface Aabb2 {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/**
 * Everything the player needs to know about the level. Implemented by the hub today;
 * later modules can supply other levels without changing the controller.
 */
export interface WalkableWorld {
  /** Obstacles the player cannot enter. */
  readonly solids: readonly Aabb2[];
  /** Playable area. The player's center is kept inside it, offset by the radius. */
  readonly bounds: Aabb2;
  /** Walking height in meters at a point. 0 means open ground. */
  surfaceHeightAt(point: GroundPoint): number;
}

const EPSILON = 1e-9;
/**
 * Longest single collision step, as a fraction of the player radius. Thin obstacles (for example
 * a 0.12 m post) are only skipped if a single step is longer than the obstacle, so this must stay
 * below the thinnest solid.
 */
const MAX_STEP_FRACTION = 0.25;
/** Passes over all boxes per step, so pushes out of two touching boxes settle. */
const PUSH_PASSES = 2;

/**
 * Pushes a circle out of one box. Returns the corrected center.
 * A circle that is not touching the box is returned unchanged.
 */
export function resolveCircleAabb(center: GroundPoint, radius: number, box: Aabb2): GroundPoint {
  const closestX = clamp(center.x, box.minX, box.maxX);
  const closestZ = clamp(center.z, box.minZ, box.maxZ);
  const dx = center.x - closestX;
  const dz = center.z - closestZ;
  const distSq = dx * dx + dz * dz;

  if (distSq >= radius * radius) {
    return { x: center.x, z: center.z };
  }
  if (distSq > EPSILON) {
    // Outside the box but overlapping: move along the contact normal until the circle just touches.
    const dist = Math.sqrt(distSq);
    const scale = radius / dist;
    return { x: closestX + dx * scale, z: closestZ + dz * scale };
  }

  // Center is inside the box: exit through the nearest face.
  const toMinX = center.x - box.minX;
  const toMaxX = box.maxX - center.x;
  const toMinZ = center.z - box.minZ;
  const toMaxZ = box.maxZ - center.z;
  const nearest = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);
  if (nearest === toMinX) {
    return { x: box.minX - radius, z: center.z };
  }
  if (nearest === toMaxX) {
    return { x: box.maxX + radius, z: center.z };
  }
  if (nearest === toMinZ) {
    return { x: center.x, z: box.minZ - radius };
  }
  return { x: center.x, z: box.maxZ + radius };
}

function resolveAll(point: GroundPoint, radius: number, boxes: readonly Aabb2[]): GroundPoint {
  let current = point;
  for (let pass = 0; pass < PUSH_PASSES; pass++) {
    for (const box of boxes) {
      current = resolveCircleAabb(current, radius, box);
    }
  }
  return current;
}

function slideAlong(
  point: GroundPoint,
  axis: 'x' | 'z',
  amount: number,
  radius: number,
  boxes: readonly Aabb2[],
): GroundPoint {
  if (!Number.isFinite(amount) || amount === 0) {
    return point;
  }
  const maxStep = radius * MAX_STEP_FRACTION;
  const steps = Math.ceil(Math.abs(amount) / maxStep);
  const stepAmount = amount / steps;

  let current = point;
  for (let i = 0; i < steps; i++) {
    current =
      axis === 'x'
        ? { x: current.x + stepAmount, z: current.z }
        : { x: current.x, z: current.z + stepAmount };
    current = resolveAll(current, radius, boxes);
  }
  return current;
}

/**
 * Moves a circle by `delta` against the solid boxes. The player slides along walls, cannot pass
 * through them, and cannot tunnel through thin obstacles because the move is split into small steps.
 * Any overlap at `start` is resolved first.
 */
export function moveWithCollision(
  start: GroundPoint,
  delta: GroundPoint,
  radius: number,
  boxes: readonly Aabb2[],
): GroundPoint {
  let point = resolveAll(start, radius, boxes);
  point = slideAlong(point, 'x', delta.x, radius, boxes);
  point = slideAlong(point, 'z', delta.z, radius, boxes);
  return point;
}

/** Keeps a circle of `radius` fully inside `bounds`. */
export function clampCircleToBounds(center: GroundPoint, radius: number, bounds: Aabb2): GroundPoint {
  return {
    x: clamp(center.x, bounds.minX + radius, bounds.maxX - radius),
    z: clamp(center.z, bounds.minZ + radius, bounds.maxZ - radius),
  };
}

/** Keeps a point inside `bounds`. Same as a zero-radius circle. */
export function clampPointToBounds(point: GroundPoint, bounds: Aabb2): GroundPoint {
  return clampCircleToBounds(point, 0, bounds);
}

export function isPointInAabb(point: GroundPoint, box: Aabb2): boolean {
  return point.x >= box.minX && point.x <= box.maxX && point.z >= box.minZ && point.z <= box.maxZ;
}
