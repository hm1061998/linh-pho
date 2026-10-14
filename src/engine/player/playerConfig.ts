import type { GroundPoint } from './collision';

/** Tuning for the player. Kept free of PlayCanvas imports so tests can read it in Node. */
export interface PlayerConfig {
  /** Collision radius in meters. */
  readonly radius: number;
  /** Feet to crown in meters. */
  readonly height: number;
  /** Top walk speed in m/s, reached at full input. */
  readonly walkSpeed: number;
  /** Top speed while Shift is held. */
  readonly runSpeed: number;
  /** Speed smoothing in 1/s. Higher reacts faster; the player stops about 0.1 s after release. */
  readonly accelerationRate: number;
  /** Turn smoothing in 1/s for facing direction. */
  readonly turnRate: number;
  readonly start: GroundPoint;
}

export const PLAYER_CONFIG: PlayerConfig = {
  radius: 0.35,
  height: 1.75,
  walkSpeed: 2.2,
  runSpeed: 5.4,
  accelerationRate: 12,
  turnRate: 14,
  start: { x: 0, z: 10 },
};
