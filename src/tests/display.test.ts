import { describe, expect, it } from 'vitest';
import { MAX_PIXEL_RATIO, clampPixelRatio } from '../shared/utils/display';

describe('clampPixelRatio', () => {
  it('keeps ratios at or below the cap unchanged', () => {
    expect(clampPixelRatio(1)).toBe(1);
    expect(clampPixelRatio(1.5)).toBe(1.5);
    expect(clampPixelRatio(MAX_PIXEL_RATIO)).toBe(MAX_PIXEL_RATIO);
  });

  it('caps high-density screens at the maximum', () => {
    expect(clampPixelRatio(3)).toBe(MAX_PIXEL_RATIO);
    expect(clampPixelRatio(2.625)).toBe(MAX_PIXEL_RATIO);
  });

  it('honours a custom maximum', () => {
    expect(clampPixelRatio(3, 1.5)).toBe(1.5);
  });

  it('falls back to 1 for invalid device pixel ratios', () => {
    expect(clampPixelRatio(0)).toBe(1);
    expect(clampPixelRatio(-2)).toBe(1);
    expect(clampPixelRatio(Number.NaN)).toBe(1);
    expect(clampPixelRatio(Number.POSITIVE_INFINITY)).toBe(1);
  });
});
