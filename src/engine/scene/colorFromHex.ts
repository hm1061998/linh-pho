import * as pc from 'playcanvas';
import { hexToRgb01 } from '../../shared/utils/color';

/** Creates a PlayCanvas color from `#RRGGBB`. Colors are authored in sRGB, as the Art Bible lists them. */
export function colorFromHex(hex: string): pc.Color {
  const [r, g, b] = hexToRgb01(hex);
  return new pc.Color(r, g, b);
}
