import * as pc from 'playcanvas';
import { colorFromHex } from '../scene/colorFromHex';

/**
 * Slow motes of warm light that drift around the market's lanterns, so the square feels alive (Art Bible §4). They come
 * from a fixed pool and never allocate after construction. With reduced effects on, `setEnabled(false)` hides them, like
 * `SpiritBurst` does for its ring. Each mote follows a loop around one anchor, so the count stays small and cheap.
 */

export interface FireflyAnchor {
  readonly x: number;
  readonly z: number;
  /** How far the motes wander from the anchor, in metres. */
  readonly radiusM: number;
}

const MOTES_PER_ANCHOR = 7;
const MOTE_SIZE_M = 0.07;
const MOTE_HEX = '#F7D48A';
const MOTE_EMISSIVE = 2.5;
/** Height band the motes float in, above the ground, in metres. */
const MIN_HEIGHT_M = 1.0;
const MAX_HEIGHT_M = 2.4;

interface Mote {
  readonly entity: pc.Entity;
  readonly anchor: FireflyAnchor;
  readonly phase: number;
  readonly speed: number;
  readonly height: number;
}

export class Fireflies {
  private readonly motes: Mote[] = [];
  private elapsed = 0;

  constructor(parent: pc.Entity, anchors: readonly FireflyAnchor[]) {
    const material = new pc.StandardMaterial();
    material.diffuse = colorFromHex(MOTE_HEX);
    material.emissive = colorFromHex(MOTE_HEX);
    material.emissiveIntensity = MOTE_EMISSIVE;
    material.update();

    let index = 0;
    for (const anchor of anchors) {
      for (let i = 0; i < MOTES_PER_ANCHOR; i++) {
        const entity = new pc.Entity(`Firefly_${index}`);
        entity.addComponent('render', { type: 'sphere', material });
        entity.setLocalScale(MOTE_SIZE_M, MOTE_SIZE_M, MOTE_SIZE_M);
        parent.addChild(entity);
        // Spread the phases and heights so the motes around one anchor never move in step.
        const spread = (i + 1) / (MOTES_PER_ANCHOR + 1);
        this.motes.push({
          entity,
          anchor,
          phase: spread * Math.PI * 2,
          speed: 0.25 + 0.12 * ((index * 7) % 5),
          height: MIN_HEIGHT_M + (MAX_HEIGHT_M - MIN_HEIGHT_M) * spread,
        });
        index++;
      }
    }
  }

  /** Shows or hides every mote. Hidden motes do not move, so turning them back on costs nothing. */
  setEnabled(enabled: boolean): void {
    for (const mote of this.motes) {
      mote.entity.enabled = enabled;
    }
  }

  /** Advances the drift. `dt` is already clamped and is zero while paused. */
  update(dt: number): void {
    this.elapsed += dt;
    for (const mote of this.motes) {
      if (!mote.entity.enabled) {
        continue;
      }
      const t = this.elapsed * mote.speed + mote.phase;
      const { anchor } = mote;
      // A figure-of-eight loop around the anchor, with a slow bob in height.
      const x = anchor.x + Math.cos(t) * anchor.radiusM;
      const z = anchor.z + Math.sin(2 * t) * anchor.radiusM * 0.5;
      const y = mote.height + Math.sin(t * 1.3) * 0.25;
      mote.entity.setLocalPosition(x, y, z);
    }
  }

  /** Removes the mote entities. The parent belongs to the app and is not touched. */
  dispose(): void {
    for (const mote of this.motes) {
      mote.entity.destroy();
    }
    this.motes.length = 0;
  }
}
