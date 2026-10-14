import { describe, expect, it } from 'vitest';
import { QUALITY_PROFILES } from '../engine/quality/qualityPresets';

describe('post effects per quality preset', () => {
  it('turns ambient occlusion and bloom on only on the high preset, where their cost is not measured on a phone yet', () => {
    expect(QUALITY_PROFILES.high.postEffects).toBe(true);
    expect(QUALITY_PROFILES.mobile.postEffects).toBe(false);
    expect(QUALITY_PROFILES.low.postEffects).toBe(false);
  });
});
