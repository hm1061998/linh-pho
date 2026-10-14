import * as pc from 'playcanvas';

/**
 * Lanterns that hang or stand on a post sway a little, as if the air over the market moved them (Art Bible §5, Stage 7).
 * Each lantern hangs from a pivot just above its top, so the swing is a pendulum about that point. buildHubBlockout
 * creates the pivot and puts the lantern's model under it. The swing is a few degrees: enough to read as air moving,
 * too little to read as a wobbling prop.
 */

export interface SwayingLantern {
  readonly pivot: pc.Entity;
  /** Half the swing, in degrees. Small lanterns swing more than big ones, which are heavier to the eye. */
  readonly amplitudeDeg: number;
  /** Radians per second. */
  readonly speed: number;
  /** Offset of this lantern's swing from the others, in radians. */
  readonly phase: number;
}

export class LanternSway {
  private readonly lanterns: readonly SwayingLantern[];
  private elapsed = 0;

  constructor(lanterns: readonly SwayingLantern[]) {
    this.lanterns = lanterns;
  }

  /** Advances the swing. `dt` is already clamped and is zero while paused. */
  update(dt: number): void {
    this.elapsed += dt;
    for (const lantern of this.lanterns) {
      const angle = lantern.amplitudeDeg * Math.sin(this.elapsed * lantern.speed + lantern.phase);
      lantern.pivot.setLocalEulerAngles(0, 0, angle);
    }
  }
}
