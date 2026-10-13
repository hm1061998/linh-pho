/** RGB components in the 0..1 range. */
export type Rgb = readonly [number, number, number];

const HEX_PATTERN = /^#?([0-9a-fA-F]{6})$/;

/**
 * Parses `#RRGGBB` (the `#` is optional) into 0..1 components.
 * Throws on malformed input so bad content fails loudly during development.
 */
export function hexToRgb01(hex: string): Rgb {
  const digits = HEX_PATTERN.exec(hex)?.[1];
  if (!digits) {
    throw new Error(`Invalid hex color: "${hex}"`);
  }
  const value = parseInt(digits, 16);
  return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255];
}
