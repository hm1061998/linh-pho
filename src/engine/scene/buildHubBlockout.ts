import * as pc from 'playcanvas';
import { hexToRgb01 } from '../../shared/utils/color';
import { HUB_PROPS, type BlockoutProp } from './hubLayout';

// Lighting and sky (Art Bible §4): indigo ambience plus one warm key light from the upper left.
const AMBIENT_HEX = '#4A5685';
const KEY_LIGHT_HEX = '#FFD9A8';
const SKY_HEX = '#0F1A2A';

function colorFromHex(hex: string): pc.Color {
  const [r, g, b] = hexToRgb01(hex);
  return new pc.Color(r, g, b);
}

/**
 * Adds the placeholder hub, lights and an overview camera to `app.root`.
 * Props share materials by color/emissive key, which keeps material count low for batching later.
 * The camera is a fixed overview for Module 01 only; Module 02 replaces it with CameraController.
 */
export function buildHubBlockout(app: pc.Application): void {
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

  const camera = new pc.Entity('CAM_Overview');
  camera.addComponent('camera', {
    clearColor: colorFromHex(SKY_HEX),
    fov: 50,
    nearClip: 0.5,
    farClip: 300,
  });
  // 45° tilt from the horizon, matching the GDD's 3/4 view range (40–50°).
  // Looks at z = 6 instead of the center so the south edge (river) stays in frame under perspective.
  camera.setPosition(0, 50, 56);
  camera.lookAt(0, 0, 6);
  app.root.addChild(camera);

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
    const entity = new pc.Entity(prop.id);
    entity.addComponent('render', {
      type: prop.shape,
      material: materialFor(prop),
    });
    const [px, py, pz] = prop.position;
    const [sx, sy, sz] = prop.size;
    entity.setLocalPosition(px, py, pz);
    entity.setLocalScale(sx, sy, sz);
    app.root.addChild(entity);
  }
}
