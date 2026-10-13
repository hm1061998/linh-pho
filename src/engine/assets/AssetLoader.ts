import * as pc from 'playcanvas';
import type { FurnitureVisual } from '../../domain/content/gameplayTypes';
import { resolveAnimation } from './animation';
import { createFallbackEntity } from './fallback';

/**
 * Loads optional GLB models at runtime. Every asset has a fallback, so the game never needs a model to run:
 * - no source, a timeout, a parse error, or a missing file keeps the fallback, and the game goes on;
 * - a loaded model is cloned for each use, so one model can appear many times;
 * - a missing animation plays the idle loop, and with no idle the model stays still.
 * Swapping one asset is a change to `assets.json`: add the file's URL as its source, and the next load uses it.
 */

export type AssetSource =
  | { readonly kind: 'url'; readonly url: string }
  | { readonly kind: 'generated'; readonly bytes: Uint8Array<ArrayBuffer>; readonly filename: string };

export interface AssetEntry {
  readonly id: string;
  /** Where the model comes from. Null means no model yet, so the fallback is always used. */
  readonly source: AssetSource | null;
  readonly idleAnimation: string | null;
}

/** `none`: no model, or not requested yet. `failed`: requested, and the fallback is kept. */
export type AssetStatus = 'none' | 'loading' | 'loaded' | 'failed';

export interface AssetSummary {
  readonly total: number;
  readonly loaded: number;
  readonly failed: number;
  /** Assets that draw their fallback: those with no model, still loading, or failed. */
  readonly fallback: number;
}

interface LoadedModel {
  readonly asset: pc.Asset;
  readonly animations: readonly string[];
  /** The playable track for each clip name. */
  readonly tracks: ReadonlyMap<string, pc.AnimTrack>;
}

interface Slot {
  readonly entry: AssetEntry;
  status: AssetStatus;
  model: LoadedModel | null;
  pending: Promise<AssetStatus> | null;
}

/** How long a model may take before it is given up and its fallback is kept. */
const LOAD_TIMEOUT_MS = 8000;

/**
 * The clip name the file gave it, such as "idle". PlayCanvas names the animation asset "<file>/animation/<n>", but the
 * track keeps the name from the file, and that is the name animations are requested by.
 */
function clipNameOf(clip: pc.Asset): string {
  const track = clip.resource as pc.AnimTrack | null | undefined;
  return track?.name || clip.name;
}

export class AssetLoader {
  private readonly app: pc.AppBase;
  private readonly slots = new Map<string, Slot>();
  private readonly listeners = new Set<() => void>();

  constructor(app: pc.AppBase, entries: readonly AssetEntry[]) {
    this.app = app;
    for (const entry of entries) {
      this.slots.set(entry.id, { entry, status: 'none', model: null, pending: null });
    }
  }

  entries(): readonly AssetEntry[] {
    return [...this.slots.values()].map((slot) => slot.entry);
  }

  status(id: string): AssetStatus {
    return this.slots.get(id)?.status ?? 'none';
  }

  summary(): AssetSummary {
    const statuses = [...this.slots.values()].map((slot) => slot.status);
    const loaded = statuses.filter((status) => status === 'loaded').length;
    const failed = statuses.filter((status) => status === 'failed').length;
    return { total: statuses.length, loaded, failed, fallback: statuses.length - loaded };
  }

  /** Called whenever an asset changes status, so an inspector can redraw. Returns the unsubscribe function. */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Loads every model that has a source, and resolves once each one has loaded or failed. Failures keep their fallback,
   * so this never rejects. Development-only entries (ids starting `dev.`) load only when `includeDev` is set, so release
   * builds never fetch them. The scene is built after this resolves, so each object is drawn once, with its final model.
   */
  async loadAll(includeDev: boolean): Promise<void> {
    const pending: Promise<AssetStatus>[] = [];
    for (const slot of this.slots.values()) {
      const isDev = slot.entry.id.startsWith('dev.');
      if (slot.entry.source && (includeDev || !isDev)) {
        pending.push(this.load(slot.entry.id));
      }
    }
    await Promise.all(pending);
  }

  /** Loads one model, once. Resolves with the final status. Concurrent callers share the same load. */
  load(id: string): Promise<AssetStatus> {
    const slot = this.slots.get(id);
    if (!slot?.entry.source) {
      return Promise.resolve(slot?.status ?? 'none');
    }
    if (slot.status === 'loaded' || slot.status === 'failed') {
      return Promise.resolve(slot.status);
    }
    if (slot.pending) {
      return slot.pending;
    }
    slot.status = 'loading';
    this.notify();
    slot.pending = this.fetch(slot.entry.id, slot.entry.source).then((model) => {
      slot.pending = null;
      slot.model = model;
      slot.status = model ? 'loaded' : 'failed';
      this.notify();
      return slot.status;
    });
    return slot.pending;
  }

  /**
   * A new entity for the asset. A loaded model is cloned from its container. Otherwise the fallback is built from the
   * given visual. This never throws, so a missing model cannot stop the scene from being built.
   */
  instantiate(id: string, fallback: FurnitureVisual): pc.Entity {
    const slot = this.slots.get(id);
    if (slot?.status === 'loaded' && slot.model) {
      const container = slot.model.asset.resource as pc.ContainerResource;
      return container.instantiateRenderEntity();
    }
    return createFallbackEntity(`FALLBACK_${id}`, fallback);
  }

  /** A new entity with the loaded model in it, or null when the model is not loaded, so the caller draws its own fallback. */
  instantiateLoaded(id: string): pc.Entity | null {
    const slot = this.slots.get(id);
    if (slot?.status === 'loaded' && slot.model) {
      return (slot.model.asset.resource as pc.ContainerResource).instantiateRenderEntity();
    }
    return null;
  }

  /** The track to play for a requested clip: the clip itself, else the idle loop, else null (the model stays still). */
  trackFor(id: string, requested: string | null): pc.AnimTrack | null {
    const slot = this.slots.get(id);
    const model = slot?.model;
    if (!slot || !model) {
      return null;
    }
    const name = resolveAnimation(requested, model.animations, slot.entry.idleAnimation);
    return name === null ? null : (model.tracks.get(name) ?? null);
  }

  /** The clip to play for a requested animation. Falls back to idle, then to nothing. */
  animationFor(id: string, requested: string | null): string | null {
    const slot = this.slots.get(id);
    if (!slot) {
      return null;
    }
    return resolveAnimation(requested, slot.model?.animations ?? [], slot.entry.idleAnimation);
  }

  animationsOf(id: string): readonly string[] {
    return this.slots.get(id)?.model?.animations ?? [];
  }

  private fetch(id: string, source: AssetSource): Promise<LoadedModel | null> {
    return new Promise((resolve) => {
      const generatedUrl = source.kind === 'generated' ? URL.createObjectURL(new Blob([source.bytes], { type: 'model/gltf-binary' })) : null;
      const url = source.kind === 'url' ? source.url : (generatedUrl ?? '');
      const filename = source.kind === 'url' ? (url.split('/').pop() ?? 'model.glb') : source.filename;
      const asset = new pc.Asset(id, 'container', { url, filename });
      let settled = false;
      let timer = 0;
      const finish = (model: LoadedModel | null) => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timer);
        if (generatedUrl) {
          URL.revokeObjectURL(generatedUrl);
        }
        resolve(model);
      };
      timer = window.setTimeout(() => finish(null), LOAD_TIMEOUT_MS);
      asset.on('error', () => finish(null));
      asset.ready(() => {
        const container = asset.resource as pc.ContainerResource | null;
        if (!container) {
          finish(null);
          return;
        }
        const tracks = new Map<string, pc.AnimTrack>();
        for (const clip of container.animations) {
          const track = clip.resource as pc.AnimTrack | null | undefined;
          if (track) {
            tracks.set(clipNameOf(clip), track);
          }
        }
        finish({ asset, animations: [...tracks.keys()], tracks });
      });
      this.app.assets.add(asset);
      this.app.assets.load(asset);
    });
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
