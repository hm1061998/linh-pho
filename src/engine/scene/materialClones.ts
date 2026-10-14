import * as pc from 'playcanvas';
import { colorFromHex } from './colorFromHex';

/**
 * The mesh instances with a standard material at or under a node. That is the blockout box itself, or each mesh of a
 * model placed under the node. A model can have one mesh per material, so the mesh instance is the unit that counts.
 */
export function standardInstances(node: pc.GraphNode | null): pc.MeshInstance[] {
  if (!(node instanceof pc.Entity)) {
    return [];
  }
  return (node.findComponents('render') as pc.RenderComponent[]).flatMap((render) =>
    render.meshInstances.filter((instance) => instance.material instanceof pc.StandardMaterial),
  );
}

/**
 * Gives every standard material under a node that passes `filter` its own clone, so a glow lights only this node and
 * not the other objects that shared the blockout material. The clones are assigned to each mesh instance, because
 * setting a render component's material changes only its first. Returns the clones, which the caller then drives.
 */
export function cloneGlowMaterials(
  node: pc.GraphNode | null,
  emissiveHex: string,
  filter: (material: pc.StandardMaterial) => boolean = () => true,
): pc.StandardMaterial[] {
  const clones = new Map<pc.StandardMaterial, pc.StandardMaterial>();
  for (const instance of standardInstances(node)) {
    const shared = instance.material as pc.StandardMaterial;
    if (!filter(shared)) {
      continue;
    }
    let own = clones.get(shared);
    if (!own) {
      own = shared.clone();
      own.emissive = colorFromHex(emissiveHex);
      own.update();
      clones.set(shared, own);
    }
    instance.material = own;
  }
  return [...clones.values()];
}
