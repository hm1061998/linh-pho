import * as pc from 'playcanvas';
import { CameraController } from '../engine/camera/CameraController';
import { InputService } from '../engine/input/InputService';
import { PlayerController } from '../engine/player/PlayerController';
import { buildHubBlockout } from '../engine/scene/buildHubBlockout';
import { HUB_WORLD } from '../engine/scene/hubCollision';
import { clampPixelRatio } from '../shared/utils/display';
import { radToDeg } from '../shared/utils/math';
import { GameStartupError, toGraphicsStartupError } from './startupErrors';

export interface GameAppOptions {
  /** Canvas the engine renders into. Must be a fresh element owned by the caller. */
  readonly canvas: HTMLCanvasElement;
  /** Element whose size drives the canvas size. The canvas must be a child of it. */
  readonly container: HTMLElement;
}

/** Read-only state for dev tools and acceptance checks. Not used by gameplay code. */
export interface GameDebugSnapshot {
  readonly player: { readonly x: number; readonly z: number; readonly speed: number };
  readonly camera: { readonly yawDeg: number; readonly distance: number };
  readonly interactPresses: number;
  readonly inputBlocked: boolean;
}

/**
 * Owns the PlayCanvas Application lifecycle (device, canvas sizing, visibility pause, teardown) and
 * the per-frame gameplay loop: input, then player, then camera. React only calls `create()`,
 * `dispose()`, and reads `input` for HUD controls.
 */
export class GameApp {
  private readonly app: pc.Application;
  private readonly container: HTMLElement;
  private readonly inputService: InputService;
  private readonly player: PlayerController;
  private readonly camera: CameraController;
  private readonly cleanups: Array<() => void> = [];
  private interactPresses = 0;
  private disposed = false;

  private constructor(app: pc.Application, canvas: HTMLCanvasElement, container: HTMLElement) {
    this.app = app;
    this.container = container;

    this.inputService = new InputService(canvas);
    this.player = new PlayerController(app.root, HUB_WORLD);
    this.camera = new CameraController(app.root, this.player.groundPosition, HUB_WORLD.bounds);
    this.cleanups.push(
      () => this.inputService.dispose(),
      () => this.player.dispose(),
      () => this.camera.dispose(),
    );
  }

  /**
   * Creates the WebGL2 device, builds the hub with the player and camera, and starts the main loop.
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

    let game: GameApp;
    try {
      game = new GameApp(app, canvas, container);
    } catch (error) {
      app.destroy();
      throw new GameStartupError('engine_init_failed', 'Gameplay systems could not be created.', {
        cause: error,
      });
    }

    try {
      game.start();
    } catch (error) {
      // Tear down whatever was already created so a failed start leaves no engine instance behind.
      game.dispose();
      throw new GameStartupError('engine_init_failed', 'Scene setup failed after the engine started.', {
        cause: error,
      });
    }
    return game;
  }

  /** Input service for HUD controls (joystick, interact button) and modal blockers. */
  get input(): InputService {
    return this.inputService;
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

  debugSnapshot(): GameDebugSnapshot {
    const { x, z } = this.player.groundPosition;
    return {
      player: { x, z, speed: this.player.speed },
      camera: { yawDeg: radToDeg(this.camera.yawRadians), distance: this.camera.currentDistance },
      interactPresses: this.interactPresses,
      inputBlocked: this.inputService.isBlocked,
    };
  }

  private start(): void {
    // Fixed-size mode: the engine sizes the canvas from the container, not from the window.
    this.app.setCanvasFillMode(pc.FILLMODE_NONE);
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
    this.resize();
    buildHubBlockout(this.app);
    this.attachLifecycle();
    this.app.on('update', this.tick);
    this.cleanups.push(() => this.app.off('update', this.tick));
    this.app.start();
  }

  /** One gameplay frame. `dt` is already clamped by the engine to 0.1 s, so a tab switch cannot teleport the player. */
  private readonly tick = (dt: number): void => {
    const frame = this.inputService.frame();
    if (frame.interactPressed) {
      // Module 03 (InteractionSystem) will consume this. It is counted here to verify the wiring.
      this.interactPresses += 1;
    }
    this.player.update(dt, frame.move, this.camera.yawRadians);
    this.camera.update(dt, this.player.groundPosition, frame.yawDelta, frame.zoomDelta);
  };

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
