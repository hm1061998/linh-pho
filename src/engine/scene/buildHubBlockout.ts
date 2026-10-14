import * as pc from 'playcanvas';
import type { AssetLoader } from '../assets/AssetLoader';
import { colorFromHex } from './colorFromHex';
import { LanternSway, type SwayingLantern } from './LanternSway';
import { HUB_PROPS, type BlockoutProp } from './hubLayout';

// Lighting (Art Bible §4): indigo ambience plus one warm key light from the upper left.
const AMBIENT_HEX = '#4A5685';
const KEY_LIGHT_HEX = '#FFD9A8';

// Warm point lights at the landmark lanterns (Art Bible §4). Only these are real lights, and none casts a shadow. The other
// lanterns are glow only, which keeps the number of lights low for mobile.
const LANTERN_LIGHT_HEX = '#F2B759';
const LANDMARK_LIGHTS: readonly { readonly propId: string; readonly range: number; readonly intensity: number }[] = [
  { propId: 'PROP_Lamp_Plaza_Head', range: 9, intensity: 1.2 },
  { propId: 'PROP_Lantern_Gate', range: 6, intensity: 0.8 },
  { propId: 'PROP_Lantern_Workshop', range: 5, intensity: 0.8 },
  { propId: 'PROP_Stall_5_Lantern', range: 5, intensity: 0.8 },
  { propId: 'PROP_Stall_6_Lantern', range: 5, intensity: 0.8 },
];

/** Lanterns that sway: the stall and corner lanterns, the plaza head, and the gate and workshop lanterns (Stage 7). */
function isSwayingLantern(id: string): boolean {
  return (
    /^PROP_Stall_\d_Lantern$/.test(id) ||
    /^PROP_Lamp_Corner_[A-Z]+_Head$/.test(id) ||
    id === 'PROP_Lamp_Plaza_Head' ||
    id === 'PROP_Lantern_Gate' ||
    id === 'PROP_Lantern_Workshop'
  );
}
/** How far above the top of a lantern its hook sits, in metres. */
const HOOK_CLEARANCE_M = 0.05;
/** Lanterns this tall or taller sway less: the plaza head, and the gate lantern (0.7 m). */
const BIG_LANTERN_M = 0.6;

/**
 * Adds the hub and its lights to `app.root`. Each prop is a blockout box, unless its model (`hub.<prop id>` in
 * assets.json) has loaded: then the model replaces the box, at the same position. The camera and player are separate
 * controllers. Props share materials by color/emissive key, which keeps material count low for batching later.
 */
export function buildHubBlockout(app: pc.Application, assets: AssetLoader): LanternSway {
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

  const swaying: SwayingLantern[] = [];
  for (const prop of HUB_PROPS) {
    const root = new pc.Entity(prop.id);
    const [px, py, pz] = prop.position;
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
    if (isSwayingLantern(prop.id)) {
      // The lantern hangs from a pivot just above its top, so it swings about that point.
      const hookY = py + prop.size[1] / 2 + HOOK_CLEARANCE_M;
      const pivot = new pc.Entity(`${prop.id}_Pivot`);
      pivot.setLocalPosition(px, hookY, pz);
      root.setLocalPosition(0, py - hookY, 0);
      pivot.addChild(root);
      app.root.addChild(pivot);
      const index = swaying.length;
      swaying.push({
        pivot,
        amplitudeDeg: prop.size[1] >= BIG_LANTERN_M ? 1.5 : 3,
        speed: 1.1 + 0.25 * (index % 3),
        phase: index * 1.3,
      });
    } else {
      root.setLocalPosition(px, py, pz);
      app.root.addChild(root);
    }
  }

  for (const landmark of LANDMARK_LIGHTS) {
    const prop = HUB_PROPS.find((candidate) => candidate.id === landmark.propId);
    if (!prop) {
      throw new Error(`hubLayout.ts has no prop named ${landmark.propId}`);
    }
    const light = new pc.Entity(`LIGHT_${prop.id}`);
    light.addComponent('light', {
      type: 'omni',
      color: colorFromHex(LANTERN_LIGHT_HEX),
      intensity: landmark.intensity,
      range: landmark.range,
      castShadows: false,
    });
    const [px, py, pz] = prop.position;
    light.setPosition(px, py, pz);
    app.root.addChild(light);
  }

  return new LanternSway(swaying);
}
