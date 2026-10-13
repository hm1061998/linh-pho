import * as pc from 'playcanvas';
import { describe, expect, it, vi } from 'vitest';
import { GameApp } from '../app/GameApp';

// Only the graphics-device entry point is needed here. The engine itself is never created in Node.
vi.mock('playcanvas', () => ({
  DEVICETYPE_WEBGL2: 'webgl2',
  createGraphicsDevice: vi.fn(),
}));

const fakeCanvas = {} as HTMLCanvasElement;
const fakeContainer = {} as HTMLElement;

describe('GameApp.create startup failures', () => {
  it('rejects with webgl2_unavailable when WebGL2 cannot be created', async () => {
    vi.mocked(pc.createGraphicsDevice).mockRejectedValueOnce(
      new AggregateError([new Error('no webgl2')], 'All device types failed'),
    );

    await expect(GameApp.create({ canvas: fakeCanvas, container: fakeContainer })).rejects.toMatchObject({
      name: 'GameStartupError',
      code: 'webgl2_unavailable',
    });
  });

  it('requests WebGL2 only, so the fallback path is deterministic', async () => {
    vi.mocked(pc.createGraphicsDevice).mockRejectedValueOnce(new Error('context lost'));

    await expect(GameApp.create({ canvas: fakeCanvas, container: fakeContainer })).rejects.toMatchObject({
      code: 'engine_init_failed',
    });
    expect(pc.createGraphicsDevice).toHaveBeenLastCalledWith(fakeCanvas, {
      deviceTypes: ['webgl2'],
      antialias: true,
      alpha: false,
    });
  });
});
