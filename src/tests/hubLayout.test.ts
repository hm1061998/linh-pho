import { describe, expect, it } from 'vitest';
import { hexToRgb01 } from '../shared/utils/color';
import { HUB_HALF_SIZE_M, HUB_PROPS } from '../engine/scene/hubLayout';

const EPSILON = 1e-9;

describe('hub blockout layout', () => {
  it('uses unique stable IDs', () => {
    const ids = HUB_PROPS.map((prop) => prop.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps every prop footprint inside the 60 m hub', () => {
    for (const prop of HUB_PROPS) {
      const [x, , z] = prop.position;
      const [sx, , sz] = prop.size;
      expect(Math.abs(x) + sx / 2, `${prop.id} x extent`).toBeLessThanOrEqual(HUB_HALF_SIZE_M + EPSILON);
      expect(Math.abs(z) + sz / 2, `${prop.id} z extent`).toBeLessThanOrEqual(HUB_HALF_SIZE_M + EPSILON);
    }
  });

  it('sits every prop on the ground, except the ground slab itself', () => {
    for (const prop of HUB_PROPS) {
      if (prop.id === 'ENV_Ground') {
        continue;
      }
      const bottom = prop.position[1] - prop.size[1] / 2;
      expect(bottom, `${prop.id} bottom`).toBeGreaterThanOrEqual(-EPSILON);
    }
  });

  it('uses positive finite dimensions and valid colors', () => {
    for (const prop of HUB_PROPS) {
      for (const component of prop.size) {
        expect(Number.isFinite(component) && component > 0, `${prop.id} size`).toBe(true);
      }
      expect(() => hexToRgb01(prop.color), `${prop.id} color`).not.toThrow();
      if (prop.emissive) {
        expect(() => hexToRgb01(prop.emissive!), `${prop.id} emissive`).not.toThrow();
      }
    }
  });

  it('contains the three GDD landmarks that must always be visible', () => {
    const ids = new Set(HUB_PROPS.map((prop) => prop.id));
    expect(ids.has('PROP_Lamp_Plaza_Head')).toBe(true); // big lantern on the plaza
    expect(ids.has('ENV_Bridge_Deck')).toBe(true); // wooden bridge
    expect(ids.has('PROP_Signboard_Shop')).toBe(true); // shop signboard
  });
});
