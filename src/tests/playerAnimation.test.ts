import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { AnimTrack, Entity } from 'playcanvas';
import { startStates } from '../engine/assets/playLoop';
import { Mat4, Quat, Vec3 } from 'playcanvas';

describe('locomotion transitions', () => {
  it('blends into walking once and changes cadence without restarting the loop', () => {
    const layer = { play: vi.fn(), transition: vi.fn() };
    const anim = { assignAnimation: vi.fn(), baseLayer: layer, speed: 1 };
    const root = { addComponent: vi.fn(), anim } as unknown as Entity;
    const animator = startStates(root, { idle: {} as AnimTrack, walk: {} as AnimTrack }, 'idle');
    animator.set('walk', 1.2);
    animator.set('walk', 1.6);
    expect(layer.play.mock.calls).toEqual([['idle']]);
    expect(layer.transition.mock.calls).toEqual([['walk', 0.2]]);
    expect(anim.speed).toBe(1.6);
    animator.set('idle');
    expect(layer.transition.mock.calls).toEqual([['walk', 0.2], ['idle', 0.2]]);
  });
});

interface Gltf {
  nodes: { name: string; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }[];
  animations: { name: string; channels: { sampler: number; target: { node: number; path: string } }[]; samplers: { input: number; output: number }[] }[];
  accessors: { bufferView: number; byteOffset?: number; count: number; type: string; componentType: number }[];
  bufferViews: { byteOffset: number; byteStride?: number }[];
}

it.each(['walk', 'run'])('ships a seamless %s with moving knees, rather than constant sampled poses', (clipName) => {
  const bytes = readFileSync(new URL('../../public/assets/player_hero.glb', import.meta.url));
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength)) as Gltf;
  const walk = gltf.animations.find((clip) => clip.name === clipName)!;
  expect(walk).toBeDefined();
  for (const name of ['UpperLeg.L', 'LowerLeg.L', 'UpperLeg.R', 'LowerLeg.R']) {
    const channel = walk.channels.find((c) => gltf.nodes[c.target.node]?.name === name && c.target.path === 'rotation')!;
    expect(channel, name).toBeDefined();
    const accessor = gltf.accessors[walk.samplers[channel.sampler]!.output]!;
    expect(accessor.componentType).toBe(5126);
    expect(accessor.type).toBe('VEC4');
    const view = gltf.bufferViews[accessor.bufferView]!;
    const start = 20 + jsonLength + 8 + view.byteOffset + (accessor.byteOffset ?? 0);
    const poses = Array.from({ length: accessor.count }, (_, frame) =>
      Array.from({ length: 4 }, (_, axis) => bytes.readFloatLE(start + frame * (view.byteStride ?? 16) + axis * 4)),
    );
    const first = poses[0]!;
    const last = poses.at(-1)!;
    first.forEach((value, axis) => expect(last[axis]).toBeCloseTo(value, 4));
    const change = Math.max(...poses.map((pose) => Math.hypot(...pose.map((value, axis) => value - first[axis]!))));
    expect(change, `${name} must move throughout the walk`).toBeGreaterThan(0.05);
  }
});

it('preserves Quaternius heel lift and swing without accumulated root motion', () => {
  const bytes = readFileSync(new URL('../../public/assets/player_hero.glb', import.meta.url));
  const length = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + length)) as Gltf;
  const walk = gltf.animations.find((clip) => clip.name === 'walk')!;
  const read = (index: number, sample: number) => {
    const accessor = gltf.accessors[index]!;
    const view = gltf.bufferViews[accessor.bufferView]!;
    const width = accessor.type === 'VEC4' ? 4 : accessor.type === 'VEC3' ? 3 : 1;
    const start = 20 + length + 8 + view.byteOffset + (accessor.byteOffset ?? 0) + sample * (view.byteStride ?? width * 4);
    return Array.from({ length: width }, (_, axis) => bytes.readFloatLE(start + axis * 4));
  };
  const parents = new Map<number, number>();
  gltf.nodes.forEach((node, parent) => node.children?.forEach((child) => parents.set(child, parent)));
  const footIndex = gltf.nodes.findIndex((node) => node.name === 'Foot.L');
  const contacts: number[][] = [];
  const roots: number[][] = [];
  for (let frame = 0; frame <= 32; frame++) {
    const time = frame / 24;
    const worldMatrix = (index: number): Mat4 => {
      const node = gltf.nodes[index]!;
      let translation = node.translation ?? [0, 0, 0];
      let rotation = node.rotation ?? [0, 0, 0, 1];
      let scale = node.scale ?? [1, 1, 1];
      for (const channel of walk.channels.filter((c) => c.target.node === index)) {
        const sampler = walk.samplers[channel.sampler]!;
        const count = gltf.accessors[sampler.input]!.count;
        let nearest = 0;
        for (let sample = 1; sample < count; sample++) {
          if (Math.abs(read(sampler.input, sample)[0]! - time) < Math.abs(read(sampler.input, nearest)[0]! - time)) nearest = sample;
        }
        const values = read(sampler.output, nearest);
        if (channel.target.path === 'translation') translation = values;
        if (channel.target.path === 'rotation') rotation = values;
        if (channel.target.path === 'scale') scale = values;
      }
      const local = new Mat4().setTRS(new Vec3(...translation), new Quat(...rotation), new Vec3(...scale));
      const parent = parents.get(index);
      return parent === undefined ? local : new Mat4().mul2(worldMatrix(parent), local);
    };
    const position = worldMatrix(footIndex).getTranslation();
    const right = worldMatrix(gltf.nodes.findIndex((node) => node.name === 'Foot.R')).getTranslation();
    expect(Math.abs(position.x - right.x), 'feet stay in narrow walking lanes').toBeLessThan(0.23);
    const root = worldMatrix(gltf.nodes.findIndex((node) => node.name === 'Root')).getTranslation();
    contacts.push([position.y, position.z]);
    roots.push([root.x, root.z]);
  }
  const heights = contacts.map((point) => point[0]!);
  // Unlike the old flat-foot procedural cycle, this clip rolls the heel and lifts the ankle.
  expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.04);
  expect(Math.min(...heights)).toBeGreaterThan(0.02);
  expect(Math.max(...heights)).toBeLessThan(0.35);
  for (const axis of [0, 1]) {
    const values = roots.map((point) => point[axis]!);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThan(0.15);
    expect(values.at(-1)).toBeCloseTo(values[0]!, 4);
  }
});
