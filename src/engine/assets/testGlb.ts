/**
 * A small glTF 2.0 binary (.glb): a unit cube with one mesh and one looping "idle" animation that turns it a quarter
 * turn. The bytes are built in code, so no binary file is committed and no Blender step is needed to test the loader.
 * It is a test asset only. Production models come from the Blender pipeline (see docs/ASSET_MANIFEST.md).
 */

const GLB_MAGIC = 0x46546c67; // "glTF"
const GLB_VERSION = 2;
const CHUNK_JSON = 0x4e4f534a; // "JSON"
const CHUNK_BIN = 0x004e4942; // "BIN\0"

const FLOAT32 = 5126;
const UINT16 = 5123;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

/** The eight corners of a cube with 1 m sides, centred on the origin. */
const CORNERS: readonly (readonly [number, number, number])[] = [
  [-0.5, -0.5, -0.5],
  [0.5, -0.5, -0.5],
  [0.5, 0.5, -0.5],
  [-0.5, 0.5, -0.5],
  [-0.5, -0.5, 0.5],
  [0.5, -0.5, 0.5],
  [0.5, 0.5, 0.5],
  [-0.5, 0.5, 0.5],
];

/** Twelve triangles, wound counter-clockwise seen from outside, so back-face culling keeps the outside. */
const TRIANGLES: readonly number[] = [
  0, 2, 1, 0, 3, 2, // back
  4, 5, 6, 4, 6, 7, // front
  0, 1, 5, 0, 5, 4, // bottom
  3, 7, 6, 3, 6, 2, // top
  0, 4, 7, 0, 7, 3, // left
  1, 2, 6, 1, 6, 5, // right
];

/** Quarter turn about Y, as a quaternion (x, y, z, w). */
const KEY_START = [0, 0, 0, 1];
const KEY_END = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
const ANIMATION_SECONDS = 2;

function buildBinary(): Uint8Array {
  const vertexBytes = CORNERS.length * 3 * 4; // 96
  const indexBytes = TRIANGLES.length * 2; // 72
  const timeBytes = 2 * 4; // 8
  const rotationBytes = 2 * 4 * 4; // 32
  const buffer = new ArrayBuffer(vertexBytes + indexBytes + timeBytes + rotationBytes);
  const view = new DataView(buffer);
  let offset = 0;
  for (const corner of CORNERS) {
    for (const value of corner) {
      view.setFloat32(offset, value, true);
      offset += 4;
    }
  }
  for (const index of TRIANGLES) {
    view.setUint16(offset, index, true);
    offset += 2;
  }
  for (const time of [0, ANIMATION_SECONDS]) {
    view.setFloat32(offset, time, true);
    offset += 4;
  }
  for (const key of [KEY_START, KEY_END]) {
    for (const value of key) {
      view.setFloat32(offset, value, true);
      offset += 4;
    }
  }
  return new Uint8Array(buffer);
}

function buildJson(binaryLength: number): object {
  const vertexBytes = CORNERS.length * 3 * 4;
  const indexBytes = TRIANGLES.length * 2;
  const timeBytes = 2 * 4;
  const rotationBytes = 2 * 4 * 4;
  return {
    asset: { version: '2.0', generator: 'linh-pho test crate' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'Crate', mesh: 0 }],
    meshes: [{ name: 'Crate', primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }] }],
    accessors: [
      {
        bufferView: 0,
        componentType: FLOAT32,
        count: CORNERS.length,
        type: 'VEC3',
        min: [-0.5, -0.5, -0.5],
        max: [0.5, 0.5, 0.5],
      },
      { bufferView: 1, componentType: UINT16, count: TRIANGLES.length, type: 'SCALAR' },
      { bufferView: 2, componentType: FLOAT32, count: 2, type: 'SCALAR', min: [0], max: [ANIMATION_SECONDS] },
      { bufferView: 3, componentType: FLOAT32, count: 2, type: 'VEC4' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: vertexBytes, target: ARRAY_BUFFER },
      { buffer: 0, byteOffset: vertexBytes, byteLength: indexBytes, target: ELEMENT_ARRAY_BUFFER },
      { buffer: 0, byteOffset: vertexBytes + indexBytes, byteLength: timeBytes },
      { buffer: 0, byteOffset: vertexBytes + indexBytes + timeBytes, byteLength: rotationBytes },
    ],
    buffers: [{ byteLength: binaryLength }],
    animations: [
      {
        name: 'idle',
        channels: [{ sampler: 0, target: { node: 0, path: 'rotation' } }],
        samplers: [{ input: 2, output: 3, interpolation: 'LINEAR' }],
      },
    ],
  };
}

/** Pads a byte array to a multiple of four, using `fill` (spaces for JSON, zeros for binary). */
function pad4(bytes: Uint8Array, fill: number): Uint8Array {
  const remainder = bytes.byteLength % 4;
  if (remainder === 0) {
    return bytes;
  }
  const padded = new Uint8Array(bytes.byteLength + (4 - remainder));
  padded.set(bytes);
  padded.fill(fill, bytes.byteLength);
  return padded;
}

/** Builds the complete .glb file: a 12-byte header, a JSON chunk, and a binary chunk. */
export function buildCrateGlb(): Uint8Array<ArrayBuffer> {
  const binary = buildBinary();
  const json = pad4(new TextEncoder().encode(JSON.stringify(buildJson(binary.byteLength))), 0x20);
  const bin = pad4(binary, 0);
  const total = 12 + 8 + json.byteLength + 8 + bin.byteLength;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, GLB_VERSION, true);
  view.setUint32(8, total, true);
  view.setUint32(12, json.byteLength, true);
  view.setUint32(16, CHUNK_JSON, true);
  out.set(json, 20);
  const binOffset = 20 + json.byteLength;
  view.setUint32(binOffset, bin.byteLength, true);
  view.setUint32(binOffset + 4, CHUNK_BIN, true);
  out.set(bin, binOffset + 8);
  return out;
}
