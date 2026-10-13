/**
 * Upper bound for the canvas backbuffer pixel ratio. Above 2 the fill cost grows quickly
 * on phones (3x screens) for little visible gain, so the cap is deliberate.
 */
export const MAX_PIXEL_RATIO = 2;

/**
 * Returns the pixel ratio to use for the game backbuffer, capped at `max`.
 * Invalid input (0, negative, NaN) falls back to 1 so the canvas never gets a zero size.
 */
export function clampPixelRatio(devicePixelRatio: number, max: number = MAX_PIXEL_RATIO): number {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) {
    return 1;
  }
  return Math.min(devicePixelRatio, max);
}
