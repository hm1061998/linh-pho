import { describe, expect, it } from 'vitest';
import { hexToRgb01 } from '../shared/utils/color';

describe('hexToRgb01', () => {
  it('converts black and white', () => {
    expect(hexToRgb01('#000000')).toEqual([0, 0, 0]);
    expect(hexToRgb01('#FFFFFF')).toEqual([1, 1, 1]);
  });

  it('accepts an optional leading hash and mixed case', () => {
    const [r, g, b] = hexToRgb01('f2b759');
    expect(r).toBeCloseTo(242 / 255);
    expect(g).toBeCloseTo(183 / 255);
    expect(b).toBeCloseTo(89 / 255);
  });

  it('rejects malformed input', () => {
    expect(() => hexToRgb01('#FFF')).toThrow(/Invalid hex color/);
    expect(() => hexToRgb01('gold')).toThrow(/Invalid hex color/);
    expect(() => hexToRgb01('#GGGGGG')).toThrow(/Invalid hex color/);
  });
});
