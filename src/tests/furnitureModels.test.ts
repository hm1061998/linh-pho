import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import assetsJson from '../content/assets.json';
import { validateAssets } from '../domain/content/validateAssets';

// Checks the shipped .glb files against docs/ASSET_MANIFEST.md. Reads the file's own JSON chunk, so it needs no Blender.
const PUBLIC_DIR = fileURLToPath(new URL('../../public', import.meta.url));

interface GltfAccessor {
  count: number;
  min?: number[];
  max?: number[];
}

interface GltfJson {
  meshes: { primitives: { attributes: { POSITION: number }; indices?: number }[] }[];
  accessors: GltfAccessor[];
  materials?: { name?: string }[];
}

function readGlbJson(path: string): GltfJson {
  const bytes = readFileSync(path);
  expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
  expect(bytes.readUInt32LE(4)).toBe(2);
  expect(bytes.toString('ascii', 16, 20)).toBe('JSON');
  const jsonLength = bytes.readUInt32LE(12);
  return JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength)) as GltfJson;
}

const urlSources = validateAssets(assetsJson).entries.flatMap((entry) =>
  entry.source && entry.source.kind === 'url' ? [{ id: entry.id, url: entry.source.url }] : [],
);

describe('shipped model files', () => {
  it('has a file in public/ for every url source in assets.json', () => {
    expect(urlSources.length).toBeGreaterThan(0);
    for (const { id, url } of urlSources) {
      expect(existsSync(join(PUBLIC_DIR, url)), `${id} -> ${url}`).toBe(true);
    }
  });

  describe('furniture.stool, manifest section 2', () => {
    const stool = urlSources.find((entry) => entry.id === 'furniture.stool');
    const path = stool ? join(PUBLIC_DIR, stool.url) : '';
    const json = path && existsSync(path) ? readGlbJson(path) : null;
    const positions = json?.meshes[0]?.primitives[0]?.attributes.POSITION;
    const accessor = positions === undefined ? undefined : json?.accessors[positions];

    it('is listed in assets.json', () => {
      expect(stool).toBeDefined();
    });

    it('is 0.6 m wide, 0.45 m high and 0.6 m deep, in the glTF Y-up frame', () => {
      expect(accessor?.min && accessor.max).toBeTruthy();
      const [minX = NaN, minY = NaN, minZ = NaN] = accessor?.min ?? [];
      const [maxX = NaN, maxY = NaN, maxZ = NaN] = accessor?.max ?? [];
      expect(maxX - minX).toBeCloseTo(0.6, 2);
      expect(maxY - minY).toBeCloseTo(0.45, 2);
      expect(maxZ - minZ).toBeCloseTo(0.6, 2);
    });

    it('has its pivot at the middle of the floor: feet on y = 0, centred on x and z', () => {
      const [minX = NaN, minY = NaN, minZ = NaN] = accessor?.min ?? [];
      const [maxX = NaN, , maxZ = NaN] = accessor?.max ?? [];
      expect(minY).toBeCloseTo(0, 3);
      expect((minX + maxX) / 2).toBeCloseTo(0, 3);
      expect((minZ + maxZ) / 2).toBeCloseTo(0, 3);
    });

    it('stays within its triangle budget of 800', () => {
      const indices = json?.meshes[0]?.primitives[0]?.indices;
      const indexCount = indices === undefined ? NaN : json?.accessors[indices]?.count ?? NaN;
      const triangles = indexCount / 3;
      expect(triangles).toBeGreaterThan(0);
      expect(triangles).toBeLessThanOrEqual(800);
    });

    it('uses the warm wood material named in the art bible', () => {
      expect(json?.materials?.map((material) => material.name)).toContain('MAT_WoodWarm_A');
    });
  });
});
