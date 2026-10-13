import * as pc from 'playcanvas';
import { colorFromHex } from '../scene/colorFromHex';

/**
 * One sprite-style effect for the lantern toggle: a ring of small glowing motes that expands and fades over
 * about half a second. The motes come from a fixed pool, so a toggle never allocates. With reduced effects on,
 * `trigger` does nothing (GDD: a setting to reduce particles).
 */

const MOTE_COUNT = 8;
const LIFETIME_S = 0.45;
const RADIUS_M = 0.9;
const MOTE_SIZE_M = 0.12;
const MOTE_COLOR = '#65D4BD';

interface Mote {
  readonly entity: pc.Entity;
  readonly material: pc.StandardMaterial;
  readonly angle: number;
  active: boolean;
  age: number;
  centerX: number;
  centerY: number;
  centerZ: number;
}

export class SpiritBurst {
  private readonly motes: Mote[] = [];

  constructor(parent: pc.Entity) {
    for (let i = 0; i < MOTE_COUNT; i++) {
      const material = new pc.StandardMaterial();
      material.diffuse = colorFromHex(MOTE_COLOR);
      material.emissive = colorFromHex(MOTE_COLOR);
      material.emissiveIntensity = 0;
      material.update();
      const entity = new pc.Entity(`SpiritMote_${i}`);
      entity.addComponent('render', { type: 'sphere', material });
      entity.setLocalScale(MOTE_SIZE_M, MOTE_SIZE_M, MOTE_SIZE_M);
      entity.enabled = false;
      parent.addChild(entity);
      this.motes.push({
        entity,
        material,
        angle: (i / MOTE_COUNT) * Math.PI * 2,
        active: false,
        age: 0,
        centerX: 0,
        centerY: 0,
        centerZ: 0,
      });
    }
  }

  trigger(x: number, y: number, z: number, reduced: boolean): void {
    if (reduced) {
      return;
    }
    for (const mote of this.motes) {
      mote.active = true;
      mote.age = 0;
      mote.centerX = x;
      mote.centerY = y + 0.9;
      mote.centerZ = z;
      mote.entity.enabled = true;
    }
  }

  update(dt: number): void {
    for (const mote of this.motes) {
      if (!mote.active) {
        continue;
      }
      mote.age += Math.max(0, dt);
      const t = mote.age / LIFETIME_S;
      if (t >= 1) {
        mote.active = false;
        mote.entity.enabled = false;
        continue;
      }
      const radius = RADIUS_M * t;
      mote.entity.setLocalPosition(
        mote.centerX + Math.cos(mote.angle) * radius,
        mote.centerY,
        mote.centerZ + Math.sin(mote.angle) * radius,
      );
      mote.material.emissiveIntensity = 2 * (1 - t);
      mote.material.update();
    }
  }
}
