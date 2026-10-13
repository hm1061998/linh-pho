import { describe, expect, it } from 'vitest';
import assetsJson from '../content/assets.json';
import { validateAssets } from '../domain/content/validateAssets';
import { QUALITY_PROFILES, resolveQualityPreset } from '../engine/quality/qualityPresets';

describe('asset manifest', () => {
  it('ships a valid manifest: every furniture piece has a slot, and the test model is generated', () => {
    const result = validateAssets(assetsJson);
    expect(result.issues).toEqual([]);
    expect(result.entries.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(['furniture.lantern_shelf', 'furniture.hanging_lamp', 'dev.test_crate']),
    );
    expect(result.entries.find((entry) => entry.id === 'dev.test_crate')?.source).toEqual({ kind: 'generated', generator: 'crate' });
  });

  it('drops an entry that points outside the game, and says why', () => {
    const result = validateAssets({
      assets: [{ id: 'bad', source: { kind: 'url', url: 'https://example.com/model.glb' }, idleAnimation: null }],
    });
    expect(result.entries).toEqual([]);
    expect(result.issues.some((issue) => issue.message.includes('/assets/'))).toBe(true);
  });

  it('drops a generated entry whose generator the engine does not have', () => {
    const result = validateAssets({
      assets: [{ id: 'x', source: { kind: 'generated', generator: 'unicorn' }, idleAnimation: null }],
    });
    expect(result.entries).toEqual([]);
  });

  it('keeps a model with no source, which then always draws its fallback', () => {
    const result = validateAssets({ assets: [{ id: 'later', source: null, idleAnimation: null }] });
    expect(result.entries).toEqual([{ id: 'later', source: null, idleAnimation: null }]);
  });

  it('drops an entry without an idle setting, so the author has to say "none" explicitly', () => {
    const result = validateAssets({ assets: [{ id: 'x', source: null }] });
    expect(result.entries).toEqual([]);
  });

  it('keeps the valid entries when one of them is broken', () => {
    const result = validateAssets({
      assets: [
        { id: 'good', source: null, idleAnimation: null },
        { id: 'broken', source: { kind: 'url', url: '/elsewhere.glb' }, idleAnimation: null },
      ],
    });
    expect(result.entries.map((entry) => entry.id)).toEqual(['good']);
  });
});

describe('quality presets', () => {
  it('lets an explicit choice win over the device', () => {
    expect(resolveQualityPreset('low', false)).toBe('low');
    expect(resolveQualityPreset('high', true)).toBe('high');
  });

  it('picks mobile for a touch device and high otherwise, when the choice is auto', () => {
    expect(resolveQualityPreset('auto', true)).toBe('mobile');
    expect(resolveQualityPreset('auto', false)).toBe('high');
  });

  it('caps the pixel ratio lower on the lighter presets', () => {
    expect(QUALITY_PROFILES.low.pixelRatioCap).toBeLessThan(QUALITY_PROFILES.mobile.pixelRatioCap);
    expect(QUALITY_PROFILES.mobile.pixelRatioCap).toBeLessThan(QUALITY_PROFILES.high.pixelRatioCap);
  });
});
