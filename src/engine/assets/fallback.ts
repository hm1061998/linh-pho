import * as pc from 'playcanvas';
import type { FurnitureVisual } from '../../domain/content/gameplayTypes';
import { colorFromHex } from '../scene/colorFromHex';

/**
 * Placeholder geometry in the visual's shape, colour and size. Used whenever a model is missing, has not loaded yet,
 * or failed to load, so the scene always has something in every place.
 */
export function createFallbackEntity(name: string, visual: FurnitureVisual, emissive = false): pc.Entity {
  const color = colorFromHex(visual.color);
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  if (emissive) {
    material.emissive = color;
    material.emissiveIntensity = 0.8;
  }
  material.update();
  const entity = new pc.Entity(name);
  entity.addComponent('render', { type: visual.shape, material });
  const [width, height, depth] = visual.size;
  entity.setLocalScale(width, height, depth);
  return entity;
}
