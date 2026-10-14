import * as pc from 'playcanvas';
import { colorFromHex } from './colorFromHex';

/**
 * The hub's ambient light moves toward a deeper teal when the lantern is in the spirit layer (Art Bible §4, Stage 7). It
 * follows the lantern's `spiritAmount`, so it eases with the same transition as the glyphs and the glow. The change is
 * only in the ambient light, so the key light, the lanterns and the materials keep their colours.
 */

const SPIRIT_AMBIENT_HEX = '#2F5F6E';

export class SpiritAmbient {
  private readonly app: pc.Application;
  private readonly real: pc.Color;
  private readonly spirit: pc.Color;
  private readonly current = new pc.Color();

  /** `realAmbient` is the ambient colour of the real night, as buildHubBlockout set it. */
  constructor(app: pc.Application, realAmbient: pc.Color) {
    this.app = app;
    this.real = realAmbient.clone();
    this.spirit = colorFromHex(SPIRIT_AMBIENT_HEX);
  }

  /** `amount` is 0 in the real layer, 1 in the spirit layer, and eased in between. */
  update(amount: number): void {
    this.current.lerp(this.real, this.spirit, amount);
    this.app.scene.ambientLight = this.current;
  }
}
