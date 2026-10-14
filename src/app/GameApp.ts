import * as pc from 'playcanvas';
import { CONTENT_ISSUES, GAME_CONTENT, findNpc, t } from '../content';
import { GameSession, type SessionSnapshot } from '../domain/GameSession';
import type { DialogueSystem } from '../domain/dialogue/DialogueSystem';
import { CameraController } from '../engine/camera/CameraController';
import { InputService } from '../engine/input/InputService';
import { InteractionSystem } from '../engine/interaction/InteractionSystem';
import { SpiritBurst } from '../engine/fx/SpiritBurst';
import { Fireflies, type FireflyAnchor } from '../engine/fx/Fireflies';
import { PostEffects } from '../engine/render/PostEffects';
import { LanternSway } from '../engine/scene/LanternSway';
import { SpiritAmbient } from '../engine/scene/SpiritAmbient';
import { NpcRenderer } from '../engine/npc/NpcRenderer';
import { PlayerController } from '../engine/player/PlayerController';
import { buildHubBlockout } from '../engine/scene/buildHubBlockout';
import { HUB_WORLD } from '../engine/scene/hubCollision';
import { HUB_PROPS } from '../engine/scene/hubLayout';
import { CraftStage, type CraftStations } from '../engine/craft/CraftStage';
import { WorldView } from '../engine/world/WorldView';
import { PLAYER_HEAD_HEIGHT_M, RoofFader } from '../engine/world/roofFade';
import { AssetLoader } from '../engine/assets/AssetLoader';
import { ASSET_MANIFEST, toAssetEntries } from '../engine/assets/manifest';
import type { QualityProfile } from '../engine/quality/qualityPresets';
import { NO_ANALYTICS, type AnalyticsPort } from '../ports/AnalyticsPort';
import { playSfx } from '../shared/audio/sfx';
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
  readonly inputBlocked: boolean;
  readonly interactionFocus: string | null;
  readonly dialogue: { readonly open: boolean; readonly dialogueId: string | null; readonly nodeId: string | null };
  readonly flags: Record<string, boolean>;
  readonly coins: number;
  readonly reputation: number;
  readonly activeQuest: string | null;
  readonly panel: string | null;
  readonly inventory: Record<string, number>;
  readonly lantern: string;
}

/** Blocker names. Each one locks gameplay input while it is active. */
const DIALOGUE_BLOCKER = 'dialogue';
const PANEL_BLOCKER = 'panel';

/** Where the fireflies drift: around the plaza lantern, and along the bridge lane between the two stalls. */
const FIREFLY_ANCHORS: readonly FireflyAnchor[] = [
  { x: 0, z: 0, radiusM: 5 },
  { x: 8, z: 12, radiusM: 4 },
];

type TargetKind = 'npc' | 'pickup' | 'station' | 'placement' | 'glyph' | 'counter';

/**
 * Owns the PlayCanvas Application lifecycle (device, canvas sizing, visibility pause, teardown), the per-frame
 * gameplay loop (input, player, camera, NPCs, lantern, interaction), and the connections between the engine and
 * the game session. Rules live in the session, so this class only turns engine events into session calls.
 */
export class GameApp {
  private readonly app: pc.Application;
  private readonly container: HTMLElement;
  private readonly inputService: InputService;
  private readonly sessionState: GameSession;
  private readonly interactionSystem: InteractionSystem;
  private readonly npcs: NpcRenderer;
  private readonly world: WorldView;
  private readonly craftStage: CraftStage;
  private readonly assetLoader: AssetLoader;
  private readonly fx: SpiritBurst;
  private readonly fireflies: Fireflies;
  private readonly postEffects: PostEffects;
  /** Built in start(), once the hub's models exist. */
  private lanternSway: LanternSway | null = null;
  private spiritAmbient: SpiritAmbient | null = null;
  private readonly player: PlayerController;
  private readonly camera: CameraController;
  /** Fades the roofs that hide the player. Built in start, once the hub's roof entities exist. */
  private roofs: RoofFader | null = null;
  private readonly targetKinds = new Map<string, TargetKind>();
  private readonly cleanups: Array<() => void> = [];
  private reducedVfx = false;
  private disposed = false;

  private constructor(app: pc.Application, canvas: HTMLCanvasElement, container: HTMLElement) {
    this.app = app;
    this.container = container;

    for (const issue of CONTENT_ISSUES) {
      const log = issue.level === 'error' ? console.error : console.warn;
      log(`[Content] ${issue.source}: ${issue.message}`);
    }
    for (const issue of ASSET_MANIFEST.issues) {
      console.warn(`[Assets] ${issue.source}: ${issue.message}`);
    }

    this.inputService = new InputService(canvas);
    this.sessionState = new GameSession(GAME_CONTENT);
    this.interactionSystem = new InteractionSystem();
    this.npcs = new NpcRenderer(app.root, GAME_CONTENT.npcs, HUB_WORLD);
    this.assetLoader = new AssetLoader(app, toAssetEntries(ASSET_MANIFEST.entries));
    this.world = new WorldView(app.root, GAME_CONTENT, HUB_WORLD, this.assetLoader);
    this.craftStage = new CraftStage(app.root, this.assetLoader, craftStationPositions());
    this.fx = new SpiritBurst(app.root);
    this.fireflies = new Fireflies(app.root, FIREFLY_ANCHORS);
    this.player = new PlayerController(app.root, HUB_WORLD);
    this.camera = new CameraController(app.root, this.player.groundPosition, HUB_WORLD.bounds);
    this.postEffects = new PostEffects(app, this.camera.component);

    this.registerTargets();

    this.cleanups.push(
      () => this.inputService.dispose(),
      () => this.npcs.dispose(),
      () => this.fireflies.dispose(),
      () => this.world.dispose(),
      () => this.craftStage.dispose(),
      () => this.player.dispose(),
      () => this.camera.dispose(),
      () => this.postEffects.dispose(),
      this.sessionState.events.on('panel.opened', () => this.inputService.pushBlocker(PANEL_BLOCKER)),
      this.sessionState.events.on('panel.closed', () => this.inputService.popBlocker(PANEL_BLOCKER)),
      this.sessionState.events.on('changed', () => this.syncWorld()),
      this.interactionSystem.events.on('interaction.triggered', (event) => this.routeInteraction(event.targetId)),
      this.sessionState.dialogue.events.on('dialogue.opened', (event) => {
        this.inputService.pushBlocker(DIALOGUE_BLOCKER);
        this.npcs.faceToward(event.view.speakerId, this.player.groundPosition);
      }),
      this.sessionState.dialogue.events.on('dialogue.closed', () => this.inputService.popBlocker(DIALOGUE_BLOCKER)),
    );
  }

  /**
   * Creates the WebGL2 device, builds the hub with the player, camera, NPCs, lantern, and world objects, and starts
   * the loop. Rejects with GameStartupError so the caller can show a specific message.
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

    // Models load before the scene is built, so every object is drawn once with its final model. Never rejects.
    await game.assets.loadAll(import.meta.env.DEV);

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

  /** Input service for HUD controls (joystick, interact and lantern buttons) and modal blockers. */
  get input(): InputService {
    return this.inputService;
  }

  /** The game session: state, rules, and the dialogue system. The HUD reads it and sends it actions. */
  get session(): GameSession {
    return this.sessionState;
  }

  /** Dialogue system, kept for the existing HUD code. Same instance as `session.dialogue`. */
  get dialogue(): DialogueSystem {
    return this.sessionState.dialogue;
  }

  get interaction(): InteractionSystem {
    return this.interactionSystem;
  }

  /** Reduced effects: no lantern burst. Saved as a setting. */
  setReducedVfx(reduced: boolean): void {
    this.reducedVfx = reduced;
    this.fireflies.setEnabled(!reduced);
  }

  /** Optional models, and their loading state. Every entry has a fallback, so none of them is required. */
  /** The 3D lantern shown while a craft is in progress. The craft panel turns it with its rotate button. */
  get craft(): CraftStage {
    return this.craftStage;
  }

  get assets(): AssetLoader {
    return this.assetLoader;
  }

  /** Where analytics events go. The shipped port does nothing: nothing leaves the device (docs/PRIVACY.md). */
  get analytics(): AnalyticsPort {
    return NO_ANALYTICS;
  }

  /** Applies a quality preset. The canvas is re-sized at once, so the change shows without a reload. */
  setQuality(profile: QualityProfile): void {
    this.app.graphicsDevice.maxPixelRatio = clampPixelRatio(window.devicePixelRatio, profile.pixelRatioCap);
    this.postEffects.setEnabled(profile.postEffects);
    this.resize();
  }

  /** Frame rate and draw calls from the engine's own counters, for the stats overlay. */
  stats(): { readonly fps: number; readonly drawCalls: number } {
    return { fps: this.app.stats.frame.fps, drawCalls: this.app.stats.drawCalls.total };
  }

  /** For the asset inspector: puts an entity on the ground two metres in front of the player. */
  placeInFrontOfPlayer(entity: pc.Entity): void {
    const { x, z } = this.player.groundPosition;
    const spot = { x: x + 2, z };
    entity.setLocalPosition(spot.x, HUB_WORLD.surfaceHeightAt(spot), spot.z);
    this.app.root.addChild(entity);
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
    const view = this.sessionState.dialogue.view;
    const snap: SessionSnapshot = this.sessionState.snapshot();
    return {
      player: { x, z, speed: this.player.speed },
      camera: { yawDeg: radToDeg(this.camera.yawRadians), distance: this.camera.currentDistance },
      inputBlocked: this.inputService.isBlocked,
      interactionFocus: this.interactionSystem.focus?.id ?? null,
      dialogue: {
        open: this.sessionState.dialogue.isOpen,
        dialogueId: view?.dialogueId ?? null,
        nodeId: view?.nodeId ?? null,
      },
      flags: snap.flags as Record<string, boolean>,
      coins: snap.coins,
      reputation: snap.reputation,
      activeQuest: snap.activeQuest?.id ?? null,
      panel: snap.panel?.kind ?? null,
      inventory: Object.fromEntries(snap.inventory.map((stack) => [stack.itemId, stack.count])),
      lantern: snap.lantern.phase,
    };
  }

  private start(): void {
    // Fixed-size mode: the engine sizes the canvas from the container, not from the window.
    this.app.setCanvasFillMode(pc.FILLMODE_NONE);
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
    this.resize();
    this.lanternSway = buildHubBlockout(this.app, this.assetLoader);
    this.spiritAmbient = new SpiritAmbient(this.app, this.app.scene.ambientLight);
    this.npcs.attachModels(this.assetLoader);
    this.player.attachModel(this.assetLoader);
    this.world.attachModels();
    this.roofs = this.createRoofFader();
    this.attachLifecycle();
    this.app.on('update', this.tick);
    this.cleanups.push(() => this.app.off('update', this.tick));
    this.sessionState.start();
    this.syncWorld();
    this.app.start();
  }

  /** One gameplay frame. `dt` is already clamped by the engine to 0.1 s, so a tab switch cannot teleport the player. */
  private readonly tick = (dt: number): void => {
    const frame = this.inputService.frame();
    if (frame.lanternPressed) {
      const turningOn = !this.sessionState.lantern.isSpirit;
      if (this.sessionState.toggleLantern().ok) {
        playSfx(turningOn ? 'lantern_on' : 'lantern_off');
        const { x, z } = this.player.groundPosition;
        this.fx.trigger(x, 0, z, this.reducedVfx);
      }
    }
    this.sessionState.updateLantern(dt);
    this.fx.update(dt);
    this.fireflies.update(dt);
    this.lanternSway?.update(dt);
    const spirit = this.sessionState.lantern.snapshot.spiritAmount;
    this.spiritAmbient?.update(spirit);
    this.fireflies.setSpiritAmount(spirit);
    this.player.update(dt, frame.move, this.camera.yawRadians, frame.sprintHeld);
    this.camera.update(dt, this.player.groundPosition, frame.yawDelta, frame.zoomDelta);
    const { x, z } = this.player.groundPosition;
    this.roofs?.update(dt, this.camera.position, { x, y: HUB_WORLD.surfaceHeightAt({ x, z }) + PLAYER_HEAD_HEIGHT_M, z });
    this.npcs.update(dt, this.player.groundPosition);
    this.craftStage.update(dt);
    this.interactionSystem.update(this.player.groundPosition);
    if (frame.interactPressed) {
      this.interactionSystem.press();
    }
  };

  /** Brings the world objects and the glyph hints in line with the session. Runs on every session change. */
  private syncWorld(): void {
    const snap = this.sessionState.snapshot();
    this.world.sync(snap);
    this.craftStage.sync(snap);
    const spirit = snap.lantern.phase === 'spirit';
    for (const [id, kind] of this.targetKinds) {
      if (kind === 'glyph') {
        this.interactionSystem.setEnabled(id, spirit);
      }
    }
  }

  /** Registers every interactable from content. Each one shows a hint when the player is close. */
  private registerTargets(): void {
    for (const npc of GAME_CONTENT.npcs) {
      this.addTarget(npc.id, 'npc', npc.nameKey, npc.position, 'ui.hint.talk');
    }
    for (const pickup of GAME_CONTENT.pickups) {
      const item = GAME_CONTENT.items.find((candidate) => candidate.id === pickup.itemId);
      this.addTarget(pickup.id, 'pickup', item?.nameKey ?? pickup.itemId, pickup.position, 'ui.action.collect');
    }
    for (const station of GAME_CONTENT.stations) {
      this.addTarget(station.id, 'station', station.labelKey, station.position, 'ui.action.work');
    }
    for (const placement of GAME_CONTENT.placements) {
      this.addTarget(placement.id, 'placement', placement.labelKey, placement.position, 'ui.action.place');
    }
    for (const glyph of GAME_CONTENT.glyphs) {
      this.addTarget(glyph.id, 'glyph', glyph.labelKey, glyph.position, 'ui.action.scan');
      // Glyphs exist only in spirit phase, so they start hidden. syncWorld turns them on.
      this.interactionSystem.setEnabled(glyph.id, false);
    }
    const counter = GAME_CONTENT.shop.counter;
    if (counter) {
      this.addTarget(counter.id, 'counter', counter.labelKey, counter.position, 'ui.action.shop');
    }
  }

  private addTarget(
    id: string,
    kind: TargetKind,
    labelKey: string,
    position: { x: number; z: number },
    actionKey: string,
  ): void {
    this.targetKinds.set(id, kind);
    this.interactionSystem.register({ id, labelKey, actionKey, position });
  }

  /**
   * Maps a pressed target to its action. Results that the player needs to know about already produce session
   * notices. Here we only log content problems, and unregister targets that are used up.
   */
  private routeInteraction(targetId: string): void {
    const kind = this.targetKinds.get(targetId);
    switch (kind) {
      case 'npc': {
        const npc = findNpc(targetId);
        if (!npc) {
          console.error(`[Interaction] NPC "${targetId}" has no definition; nothing opened`);
          return;
        }
        const result = this.sessionState.dialogue.start(npc.dialogueId);
        if (!result.ok) {
          console.error(`[Interaction] Could not open dialogue "${npc.dialogueId}" for "${targetId}": ${result.reason}`);
        }
        return;
      }
      case 'pickup': {
        const result = this.sessionState.collectPickup(targetId);
        if (result.ok) {
          playSfx('pickup');
          this.interactionSystem.unregister(targetId);
        }
        return;
      }
      case 'station':
        this.sessionState.interactStation(targetId);
        return;
      case 'placement': {
        const result = this.sessionState.placeItem(targetId);
        if (result.ok) {
          playSfx('snap');
          this.interactionSystem.unregister(targetId);
        }
        return;
      }
      case 'glyph':
        this.sessionState.scanGlyph(targetId);
        return;
      case 'counter':
        this.sessionState.openPanel({ kind: 'shop' });
        return;
      default:
        console.error(`[Interaction] Target "${targetId}" has no action; nothing happened (${t('error.generic')})`);
    }
  }

  /**
   * The hub's roofs, each with its blockout box, so the fader can test whether a roof stands between the camera and the
   * player's head. A roof with no entity is skipped.
   */
  private createRoofFader(): RoofFader {
    const roofs = HUB_PROPS.filter((prop) => prop.id.endsWith('_Roof')).flatMap((prop) => {
      const root = this.app.root.findByName(prop.id);
      if (!(root instanceof pc.Entity)) {
        return [];
      }
      const [x, y, z] = prop.position;
      const [width, height, depth] = prop.size;
      return [{ root, box: { center: { x, y, z }, half: { x: width / 2, y: height / 2, z: depth / 2 } } }];
    });
    return new RoofFader(roofs);
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

/** Where the two craft stations stand, from content. A station missing from the content falls back to the origin. */
function craftStationPositions(): CraftStations {
  const at = (id: string) => {
    const station = GAME_CONTENT.stations.find((candidate) => candidate.id === id);
    return station ? { x: station.position.x, z: station.position.z } : { x: 0, z: 0 };
  };
  return { assembly: at('station_workbench'), engraving: at('station_engraving') };
}
