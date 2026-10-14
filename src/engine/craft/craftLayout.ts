/**
 * The craft stage's geometry, in game coordinates (Y up), in metres. Pure, so it can be tested in Node. The models in
 * `assets_src/build_assets.py` use the same numbers, and a test reads that file to make sure they still agree.
 */

/** Distance from the lantern's centre to each socket and each mark. */
export const CRAFT_RING_M = 0.18;
/** The sockets, in order a, b: their angles from +X toward +Z, in degrees. The two sit on opposite sides of the ring. */
export const CRAFT_SOCKET_ANGLES_DEG: readonly number[] = [0, 180];
/** The height of a rib's bottom when it stands in its socket: on top of the bottom ring. */
export const CRAFT_SOCKET_BASE_Y_M = 0.16;
/** The height of the engraving lantern's middle, where its marks sit. */
export const CRAFT_LANTERN_MIDDLE_Y_M = 0.32;
/** Marks sit just outside the paper body, so they read on it. */
export const CRAFT_MARK_RADIUS_M = 0.19;
/** A rib starts this far above its socket, and drops in over SNAP_SECONDS. */
export const CRAFT_SNAP_HEIGHT_M = 0.5;
export const CRAFT_SNAP_SECONDS = 0.28;

export interface Point {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Where a rib stands when it is in socket `index` (0 for a, 1 for b). The stage's own origin is the base. */
export function socketPosition(index: number): Point {
  const angle = degreesToRadians(CRAFT_SOCKET_ANGLES_DEG[index] ?? 0);
  return { x: CRAFT_RING_M * Math.cos(angle), y: CRAFT_SOCKET_BASE_Y_M, z: CRAFT_RING_M * Math.sin(angle) };
}

/** Where mark `index` of `count` sits on the lantern's ring. The marks are spread evenly, starting at +X. */
export function markPosition(index: number, count: number): Point {
  const angle = degreesToRadians((360 / Math.max(count, 1)) * index);
  return {
    x: CRAFT_MARK_RADIUS_M * Math.cos(angle),
    y: CRAFT_LANTERN_MIDDLE_Y_M,
    z: CRAFT_MARK_RADIUS_M * Math.sin(angle),
  };
}

/** How many short pieces make up the arc between two marks. More pieces make a smoother curve. */
export const CRAFT_TRAIL_STEPS = 8;

/**
 * The light trail runs around the lantern, along the ring, from each mark lit to the next one in the order they were lit.
 * It takes the shorter way round between two marks. A mark that is not lit yet ends the trail, so the line never runs
 * ahead of the player. Each arc is drawn as short straight pieces.
 */
export function trailSegments(litMarks: readonly { readonly index: number; readonly step: number }[], count: number): { from: Point; to: Point }[] {
  const ordered = [...litMarks].sort((a, b) => a.step - b.step);
  const segments: { from: Point; to: Point }[] = [];
  for (let i = 1; i < ordered.length; i++) {
    const previous = ordered[i - 1];
    const current = ordered[i];
    if (!previous || !current) {
      continue;
    }
    const start = ringAngle(previous.index, count);
    const delta = shorterTurn(ringAngle(current.index, count) - start);
    for (let step = 0; step < CRAFT_TRAIL_STEPS; step++) {
      const from = ringPoint(start + (delta * step) / CRAFT_TRAIL_STEPS);
      const to = ringPoint(start + (delta * (step + 1)) / CRAFT_TRAIL_STEPS);
      segments.push({ from, to });
    }
  }
  return segments;
}

/** The angle of mark `index` on a ring of `count` marks, in radians, measured from +X toward +Z. */
function ringAngle(index: number, count: number): number {
  return degreesToRadians((360 / Math.max(count, 1)) * index);
}

/** A point on the lantern's ring at `angle` radians, at the height of the marks. */
function ringPoint(angle: number): Point {
  return {
    x: CRAFT_MARK_RADIUS_M * Math.cos(angle),
    y: CRAFT_LANTERN_MIDDLE_Y_M,
    z: CRAFT_MARK_RADIUS_M * Math.sin(angle),
  };
}

/** The turn between two angles, wrapped to (-pi, pi], so the trail takes the shorter way round. */
function shorterTurn(angle: number): number {
  const turn = ((angle + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  return turn;
}

/** The midpoint and length of a segment, which is what the engine needs to draw it as a stretched box. */
export function segmentShape(from: Point, to: Point): { mid: Point; length: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  return {
    mid: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, z: (from.z + to.z) / 2 },
    length: Math.hypot(dx, dy, dz),
  };
}

/** How far a rib has dropped in, from 0 (still above the socket) to 1 (in place). Ease-out, so it slows as it lands. */
export function snapProgressToHeight(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  const eased = 1 - (1 - p) ** 3;
  return CRAFT_SOCKET_BASE_Y_M + CRAFT_SNAP_HEIGHT_M * (1 - eased);
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
