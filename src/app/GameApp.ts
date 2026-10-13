import * as pc from 'playcanvas';
import { CONTENT_ISSUES, GAME_CONTENT, findNpc } from '../content';
import { DialogueSystem } from '../domain/dialogue/DialogueSystem';
import { FlagStore } from '../domain/flags/FlagStore';
import { CameraController } from '../engine/camera/CameraController';
import { InputService } from '../engine/input/InputService';
import { InteractionSystem } from '../engine/interaction/InteractionSystem';
import { NpcRenderer } from '../engine/npc/NpcRenderer';
import { PlayerController } from '../engine/player/PlayerController';
import { buildHubBlockout } from '../engine/scene/buildHubBlockout';
import { HUB_WORLD } from '../engine/scene/hubCollision';
import { clampPixelRatio } from '../shared/utils/display';
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
  readonly inputBlocked: boolean;
  readonly interactionFocus: string | null;
  readonly dialogue: { readonly open: boolean; readonly dialogueId: string | null; readonly nodeId: string | null };
  readonly flags: Record<string, boolean>;
}

/** Blocker name while a dialogue is open. Movement and interaction stay locked until it closes. */
const DIALOGUE_BLOCKER = 'dialogue';

/**
 * Owns the PlayCanvas Application lifecycle (device, canvas sizing, visibility pause, teardown) and the
 * per-frame gameplay loop: input, player, camera, NPCs, then interaction. It also connects systems through
 * typed events: an interaction opens a dialogue, and an open dialogue blocks input.
 * React reads the systems through the getters below. It never drives the engine directly.
 */
export class GameApp {
  private readonly app: pc.Application;
  private readonly container: HTMLElement;
  private readonly inputService: InputService;
  private readonly flagStore: FlagStore;
  private readonly interactionSystem: InteractionSystem;
  private readonly dialogueSystem: DialogueSystem;
  private readonly npcs: NpcRenderer;
  private readonly player: PlayerController;
  private readonly camera: CameraController;
  private readonly cleanups: Array<() => void> = [];
  private disposed = false;

  private constructor(app: pc.Application, canvas: HTMLCanvasElement, container: HTMLElement) {
    this.app = app;
    this.container = container;

    for (const issue of CONTENT_ISSUES) {
      const log = issue.level === 'error' ? console.error : console.warn;
      log(`[Content] ${issue.source}: ${issue.message}`);
    }

    this.inputService = new InputService(canvas);
    this.flagStore = new FlagStore();
    this.interactionSystem = new InteractionSystem();
    this.dialogueSystem = new DialogueSystem(GAME_CONTENT.dialogues, this.flagStore);
    this.npcs = new NpcRenderer(app.root, GAME_CONTENT.npcs, HUB_WORLD);
    this.player = new PlayerController(app.root, HUB_WORLD);
    this.camera = new CameraController(app.root, this.player.groundPosition, HUB_WORLD.bounds);

    for (const npc of GAME_CONTENT.npcs) {
      this.interactionSystem.register({ id: npc.id, labelKey: npc.nameKey, position: npc.position });
    }

    this.cleanups.push(
      () => this.inputService.dispose(),
      () => this.npcs.dispose(),
      () => this.player.dispose(),
      () => this.camera.dispose(),
      this.interactionSystem.events.on('interaction.triggered', (event) =>
        this.routeInteraction(event.targetId),
      ),
      this.dialogueSystem.events.on('dialogue.opened', (event) =>
        this.onDialogueOpened(event.view.speakerId),
      ),
      this.dialogueSystem.events.on('dialogue.closed', () =>
        this.inputService.popBlocker(DIALOGUE_BLOCKER),
      ),
    );
  }

  /**
   * Creates the WebGL2 device, builds the hub with the player, camera, and NPCs, and starts the main loop.
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

  get interaction(): InteractionSystem {
    return this.interactionSystem;
  }

  get dialogue(): DialogueSystem {
    return this.dialogueSystem;
  }

  get flags(): FlagStore {
    return this.flagStore;
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
    const view = this.dialogueSystem.view;
    return {
      player: { x, z, speed: this.player.speed },
      camera: { yawDeg: (this.camera.yawRadians * 180) / Math.PI, distance: this.camera.currentDistance },
      inputBlocked: this.inputService.isBlocked,
      interactionFocus: this.interactionSystem.focus?.id ?? null,
      dialogue: {
        open: this.dialogueSystem.isOpen,
        dialogueId: view?.dialogueId ?? null,
        nodeId: view?.nodeId ?? null,
      },
      flags: this.flagStore.snapshot(),
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
    this.player.update(dt, frame.move, this.camera.yawRadians);
    this.camera.update(dt, this.player.groundPosition, frame.yawDelta, frame.zoomDelta);
    this.npcs.update(dt);
    this.interactionSystem.update(this.player.groundPosition);
    if (frame.interactPressed) {
      // Interaction is only accepted from a press in range. The event handler opens the dialogue.
      this.interactionSystem.press();
    }
  };

  /**
   * Maps an interaction target to what it does. Today every target is an NPC that opens its dialogue.
   * Unknown targets and missing dialogues are logged and ignored, so the game keeps running.
   */
  private routeInteraction(targetId: string): void {
    const npc = findNpc(targetId);
    if (!npc) {
      console.error(`[Interaction] Target "${targetId}" has no NPC definition; nothing opened`);
      return;
    }
    const result = this.dialogueSystem.start(npc.dialogueId);
    if (!result.ok) {
      console.error(
        `[Interaction] Could not open dialogue "${npc.dialogueId}" for "${targetId}": ${result.reason}`,
      );
    }
  }

  private onDialogueOpened(speakerId: string): void {
    this.inputService.pushBlocker(DIALOGUE_BLOCKER);
    this.npcs.faceToward(speakerId, this.player.groundPosition);
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
