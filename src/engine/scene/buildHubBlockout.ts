import * as pc from 'playcanvas';
import type { AssetLoader } from '../assets/AssetLoader';
import { colorFromHex } from './colorFromHex';
import { HUB_PROPS, type BlockoutProp } from './hubLayout';

// Lighting (Art Bible §4): indigo ambience plus one warm key light from the upper left.
const AMBIENT_HEX = '#4A5685';
const KEY_LIGHT_HEX = '#FFD9A8';

/**
 * Adds the hub and its lights to `app.root`. Each prop is a blockout box, unless its model (`hub.<prop id>` in
 * assets.json) has loaded: then the model replaces the box, at the same position. The camera and player are separate
 * controllers. Props share materials by color/emissive key, which keeps material count low for batching later.
 */
export function buildHubBlockout(app: pc.Application, assets: AssetLoader): void {
  app.scene.ambientLight = colorFromHex(AMBIENT_HEX);

  const keyLight = new pc.Entity('LIGHT_Key');
  keyLight.addComponent('light', {
    type: 'directional',
    color: colorFromHex(KEY_LIGHT_HEX),
    intensity: 1.1,
    castShadows: true,
    shadowResolution: 2048,
    shadowDistance: 90,
  });
  // Light comes from north-west and above, so shadows fall toward the south-east.
  keyLight.setPosition(-30, 45, -30);
  keyLight.lookAt(0, 0, 0);
  app.root.addChild(keyLight);

  const materials = new Map<string, pc.StandardMaterial>();
  const materialFor = (prop: BlockoutProp): pc.StandardMaterial => {
    const key = `${prop.color}|${prop.emissive ?? ''}|${prop.emissiveIntensity ?? 0}`;
    const cached = materials.get(key);
    if (cached) {
      return cached;
    }
    const material = new pc.StandardMaterial();
    material.diffuse = colorFromHex(prop.color);
    material.gloss = 0.15;
    if (prop.emissive) {
      material.emissive = colorFromHex(prop.emissive);
      material.emissiveIntensity = prop.emissiveIntensity ?? 1;
    }
    material.update();
    materials.set(key, material);
    return material;
  };

  for (const prop of HUB_PROPS) {
    const root = new pc.Entity(prop.id);
    const [px, py, pz] = prop.position;
    root.setLocalPosition(px, py, pz);
    const model = assets.instantiateLoaded(`hub.${prop.id}`);
    if (model) {
      // A model is built around the blockout's centre and has the blockout's size, so it needs no scale.
      root.addChild(model);
    } else {
      root.addComponent('render', {
        type: prop.shape,
        material: materialFor(prop),
      });
      const [sx, sy, sz] = prop.size;
      root.setLocalScale(sx, sy, sz);
    }
    app.root.addChild(root);
  }
}
