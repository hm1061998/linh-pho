/** Clamps `value` to the inclusive range [min, max]. If min > max, the result is max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Wraps an angle in radians into [-π, π). */
export function wrapAngle(radians: number): number {
  const twoPi = 2 * Math.PI;
  let wrapped = (radians + Math.PI) % twoPi;
  if (wrapped < 0) {
    wrapped += twoPi;
  }
  return wrapped - Math.PI;
}

/** Signed rotation from `from` to `to` that takes the shorter way round, in [-π, π). */
export function shortestAngleDelta(from: number, to: number): number {
  return wrapAngle(to - from);
}
