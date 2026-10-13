import type { MoveInput } from '../input/moveInput';
import type { GroundPoint } from './collision';

/**
 * Turns camera-relative walk intent into a world-space direction on the ground.
 *
 * The camera sits at `yaw` around the focus point and looks back at it. yaw = 0 places the camera
 * to the south, looking north. So W (forward) moves north, and D (right) moves east.
 * The direction is not normalized beyond the input length. Diagonals are already clamped upstream.
 */
export function worldMoveDirection(input: MoveInput, cameraYaw: number): GroundPoint {
  const forward = { x: -Math.sin(cameraYaw), z: -Math.cos(cameraYaw) };
  const right = { x: Math.cos(cameraYaw), z: -Math.sin(cameraYaw) };
  return {
    x: right.x * input.x + forward.x * input.y,
    z: right.z * input.x + forward.z * input.y,
  };
}

/**
 * Fraction of the gap closed in one frame by exponential smoothing. `rate` is in 1/s: a higher rate
 * reaches the target faster. The result is frame-rate independent.
 */
export function dampFactor(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * Math.max(0, dt));
}

export function dampToward(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * dampFactor(rate, dt);
}

/**
 * Camera offset from the focus point for a given yaw, pitch (radians above the horizon), and distance.
 * At yaw 0 the offset points south (+Z).
 */
export function orbitOffset(
  yaw: number,
  pitch: number,
  distance: number,
): { readonly x: number; readonly y: number; readonly z: number } {
  return {
    x: Math.sin(yaw) * Math.cos(pitch) * distance,
    y: Math.sin(pitch) * distance,
    z: Math.cos(yaw) * Math.cos(pitch) * distance,
  };
}
