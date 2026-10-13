import { describe, expect, it } from 'vitest';
import { resolveAnimation } from '../engine/assets/animation';
import { buildCrateGlb } from '../engine/assets/testGlb';

/** Reads the GLB container the way a glTF loader does, and checks every part of it. */
function readGlb(bytes: Uint8Array): { json: Record<string, unknown>; binary: Uint8Array; total: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  expect(view.getUint32(0, true)).toBe(0x46546c67); // "glTF"
  expect(view.getUint32(4, true)).toBe(2);
  const total = view.getUint32(8, true);
  expect(total).toBe(bytes.byteLength);

  const jsonLength = view.getUint32(12, true);
  expect(view.getUint32(16, true)).toBe(0x4e4f534a); // "JSON"
  expect(jsonLength % 4).toBe(0);
  const jsonText = new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength));
  const json = JSON.parse(jsonText) as Record<string, unknown>;

  const binOffset = 20 + jsonLength;
  const binLength = view.getUint32(binOffset, true);
  expect(view.getUint32(binOffset + 4, true)).toBe(0x004e4942); // "BIN\0"
  expect(binLength % 4).toBe(0);
  expect(binOffset + 8 + binLength).toBe(total);
  return { json, binary: bytes.subarray(binOffset + 8, binOffset + 8 + binLength), total };
}

describe('the generated test GLB (crate)', () => {
  const bytes = buildCrateGlb();
  const { json, binary } = readGlb(bytes);
  const buffers = json.buffers as { byteLength: number }[];
  const bufferViews = json.bufferViews as { byteOffset: number; byteLength: number }[];
  const accessors = json.accessors as { bufferView: number; count: number; componentType: number; type: string }[];

  it('is glTF 2.0 with one scene, one mesh, and one node that draws it', () => {
    expect((json.asset as { version: string }).version).toBe('2.0');
    expect(json.scenes).toHaveLength(1);
    expect((json.meshes as unknown[]).length).toBe(1);
    expect((json.nodes as { mesh: number }[])[0]?.mesh).toBe(0);
  });

  it('has a buffer that holds exactly the bytes its views describe', () => {
    expect(buffers[0]?.byteLength).toBe(binary.byteLength);
    for (const view of bufferViews) {
      expect(view.byteOffset + view.byteLength).toBeLessThanOrEqual(binary.byteLength);
    }
  });

  it('keeps every accessor inside its view, with the element size its type requires', () => {
    const sizes: Record<string, number> = { SCALAR: 1, VEC3: 3, VEC4: 4 };
    const bytesPerComponent: Record<number, number> = { 5126: 4, 5123: 2 };
    for (const accessor of accessors) {
      const view = bufferViews[accessor.bufferView];
      const need = accessor.count * (sizes[accessor.type] ?? 0) * (bytesPerComponent[accessor.componentType] ?? 0);
      expect(view, `view for accessor ${accessor.bufferView}`).toBeDefined();
      expect(need).toBeLessThanOrEqual(view?.byteLength ?? 0);
    }
  });

  it('draws twelve triangles, every index points at a real vertex', () => {
    const indexAccessor = accessors[1];
    expect(indexAccessor?.count).toBe(36);
    const positions = accessors[0];
    expect(positions?.count).toBe(8);
    const view = bufferViews[indexAccessor?.bufferView ?? 0];
    const indices = new Uint16Array(binary.buffer, binary.byteOffset + (view?.byteOffset ?? 0), indexAccessor?.count ?? 0);
    expect(Math.max(...indices)).toBeLessThan(positions?.count ?? 0);
  });

  it('has an idle animation whose keyframe times and rotations line up', () => {
    const animations = json.animations as { name: string; samplers: { input: number; output: number }[] }[];
    const idle = animations.find((clip) => clip.name === 'idle');
    expect(idle).toBeDefined();
    const sampler = idle?.samplers[0];
    expect(accessors[sampler?.input ?? 0]?.count).toBe(accessors[sampler?.output ?? 0]?.count);
  });

  it('builds the same bytes every time, so a test or a demo never sees a changing asset', () => {
    expect(buildCrateGlb()).toEqual(bytes);
  });
});

describe('resolveAnimation: a missing clip falls back to idle, then to nothing', () => {
  it('plays the requested clip when the model has it', () => {
    expect(resolveAnimation('wave', ['idle', 'wave'], 'idle')).toBe('wave');
  });

  it('plays idle when the requested clip is missing', () => {
    expect(resolveAnimation('wave', ['idle'], 'idle')).toBe('idle');
  });

  it('plays nothing when neither the requested clip nor idle exists', () => {
    expect(resolveAnimation('wave', ['run'], 'idle')).toBeNull();
  });

  it('plays nothing for a model with no clips, and when no clip was asked for', () => {
    expect(resolveAnimation('wave', [], null)).toBeNull();
    expect(resolveAnimation(null, ['idle'], 'idle')).toBe('idle');
  });
});
