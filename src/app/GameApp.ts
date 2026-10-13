import * as pc from 'playcanvas';
import { buildHubBlockout } from '../engine/scene/buildHubBlockout';
import { clampPixelRatio } from '../shared/utils/display';
import { GameStartupError, toGraphicsStartupError } from './startupErrors';

export interface GameAppOptions {
  /** Canvas the engine renders into. Must be a fresh element owned by the caller. */
  readonly canvas: HTMLCanvasElement;
  /** Element whose size drives the canvas size. The canvas must be a child of it. */
  readonly container: HTMLElement;
}

/**
 * Owns the PlayCanvas Application lifecycle: device creation, canvas sizing, visibility pause,
 * and teardown. Gameplay systems attach to `app` in later modules. React never touches the engine
 * beyond calling `create()` and `dispose()`.
 */
export class GameApp {
  private readonly app: pc.Application;
  private readonly container: HTMLElement;
  private readonly cleanups: Array<() => void> = [];
  private disposed = false;

  private constructor(app: pc.Application, container: HTMLElement) {
    this.app = app;
    this.container = container;
  }

  /**
   * Creates the WebGL2 device, builds the Module 01 scene, and starts the main loop.
   * Rejects with GameStartupError so the caller can show a specific message.
   */
  static async create({ canvas, container }: GameAppOptions): Promise<GameApp> {
    let device: pc.GraphicsDevice;
    try {
      device = await pc.createGraphicsDevice(canvas, {
        deviceTypes: [pc.DEVICETYPE_WEBGL2],
        antialias: true,
        // The canvas sits under an opaque scene, so it does not need an alpha channel.
        alpha: false,
      });
    } catch (error) {
      throw toGraphicsStartupError(error);
    }

    device.maxPixelRatio = clampPixelRatio(window.devicePixelRatio);

    let app: pc.Application;
    try {
      app = new pc.Application(canvas, { graphicsDevice: device });
    } catch (error) {
      device.destroy();
      throw new GameStartupError('engine_init_failed', 'PlayCanvas application could not be created.', {
        cause: error,
      });
    }

    const game = new GameApp(app, container);
    try {
      // Fixed-size mode: the engine sizes the canvas from the container, not from the window.
      app.setCanvasFillMode(pc.FILLMODE_NONE);
      app.setCanvasResolution(pc.RESOLUTION_AUTO);
      game.resize();
      buildHubBlockout(app);
      game.attachLifecycle();
      app.start();
    } catch (error) {
      // Tear down whatever was already created so a failed start leaves no engine instance behind.
      game.dispose();
      throw new GameStartupError('engine_init_failed', 'Scene setup failed after the engine started.', {
        cause: error,
      });
    }
    return game;
  }

  /** Stops the loop, removes listeners, and destroys the engine and its graphics device. Safe to call twice. */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const cleanup of this.cleanups.splice(0)) {
      cleanup();
    }
    // app.destroy() also cancels the requestAnimationFrame loop and destroys the device.
    this.app.destroy();
  }

  private resize(): void {
    const { clientWidth, clientHeight } = this.container;
    if (clientWidth === 0 || clientHeight === 0) {
      return;
    }
    this.app.resizeCanvas(clientWidth, clientHeight);
  }

  private attachLifecycle(): void {
    // The engine installs no window resize listener, so the container is observed directly.
    // This also catches browser zoom and mobile address-bar changes.
    const observer = new ResizeObserver(() => this.resize());
    observer.observe(this.container);
    this.cleanups.push(() => observer.disconnect());

    // Freeze simulation and skip rendering while hidden. The engine's maxDeltaTime (0.1 s)
    // then prevents a large time jump when the tab returns.
    const applyVisibility = () => {
      const hidden = document.hidden;
      this.app.timeScale = hidden ? 0 : 1;
      this.app.autoRender = !hidden;
    };
    document.addEventListener('visibilitychange', applyVisibility);
    this.cleanups.push(() => document.removeEventListener('visibilitychange', applyVisibility));
    applyVisibility();
  }
}
