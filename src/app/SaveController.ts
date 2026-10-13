import { setLanguage } from '../content';
import { parseSaveDocument, serializeSaveDocument, DEFAULT_SETTINGS, type Settings } from '../domain/save/SaveDocument';
import type { SavePort } from '../ports/SavePort';
import { QUALITY_PROFILES, isCoarsePointer, resolveQualityPreset } from '../engine/quality/qualityPresets';
import { setSfxEnabled } from '../shared/audio/sfx';
import type { GameApp } from './GameApp';

/**
 * Loads the save before the player can act, then saves on its own. A burst of changes becomes one write, and the page
 * flushes when it is hidden or closed. A save that cannot be read is kept as a backup, and the game starts fresh.
 * Settings apply the moment they change.
 */

/** How long the game waits after the last change before writing. */
const AUTOSAVE_DELAY_MS = 800;

export type LoadOutcome = 'new' | 'loaded' | 'recovered';

export class SaveController {
  private readonly game: GameApp;
  private readonly port: SavePort;
  private settings: Settings = DEFAULT_SETTINGS;
  private timer: number | null = null;
  private attached = false;
  private writeFailing = false;
  private unsubscribe: (() => void) | null = null;
  private readonly onHidden = () => {
    if (document.visibilityState === 'hidden') {
      void this.flush();
    }
  };
  private readonly onPageHide = () => {
    void this.flush();
  };

  constructor(game: GameApp, port: SavePort) {
    this.game = game;
    this.port = port;
  }

  /** Reads the save and applies it. Call once, before the player can act. Autosave starts when this resolves. */
  async load(): Promise<LoadOutcome> {
    let outcome: LoadOutcome = 'new';
    const text = await this.readSafely();
    if (text !== null) {
      const parsed = parseText(text);
      const result = parsed === undefined ? { ok: false as const, reason: 'not_json' } : parseSaveDocument(parsed);
      // Keep the bad text, so nothing is lost, and start the game fresh. The player is told.
      const recover = async () => {
        await this.port.writeBackup(text).catch(() => false);
        this.game.session.resetProgress();
        this.game.session.reportSaveProblem('unreadable');
        return 'recovered' as const;
      };
      if (result.ok) {
        try {
          this.game.session.restoreProgress(result.document.progress);
          this.settings = result.document.settings;
          outcome = 'loaded';
        } catch {
          // The checks passed, but restoring still failed. A half-restored world is worse than a fresh one.
          outcome = await recover();
        }
      } else {
        outcome = await recover();
      }
    }
    this.applySettings();
    this.attach();
    return outcome;
  }

  getSettings(): Settings {
    return this.settings;
  }

  /** Changes settings, applies them now, and saves them. */
  updateSettings(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    this.applySettings();
    this.scheduleSave();
  }

  /** Starts a new playthrough and saves the blank state, so a reload does not bring the old one back. */
  async restart(): Promise<void> {
    this.game.session.resetProgress();
    await this.flush();
  }

  /** Writes the current state now. Used when the page hides and when the player restarts. */
  async flush(): Promise<void> {
    if (!this.attached) {
      return;
    }
    this.clearTimer();
    // A throw here (from serialising or from storage) counts as a failed write. It never reaches the game loop.
    let ok = false;
    try {
      const text = serializeSaveDocument(this.game.session.saveProgress(), this.settings, new Date());
      ok = await this.port.write(text);
    } catch {
      ok = false;
    }
    if (ok) {
      this.writeFailing = false;
    } else if (!this.writeFailing) {
      this.writeFailing = true;
      this.game.session.reportSaveProblem('write_failed');
    }
  }

  dispose(): void {
    this.clearTimer();
    this.unsubscribe?.();
    this.unsubscribe = null;
    window.removeEventListener('pagehide', this.onPageHide);
    document.removeEventListener('visibilitychange', this.onHidden);
    this.attached = false;
  }

  private attach(): void {
    this.attached = true;
    this.unsubscribe = this.game.session.events.on('changed', () => this.scheduleSave());
    window.addEventListener('pagehide', this.onPageHide);
    document.addEventListener('visibilitychange', this.onHidden);
  }

  private scheduleSave(): void {
    if (!this.attached) {
      return;
    }
    this.clearTimer();
    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, AUTOSAVE_DELAY_MS);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private applySettings(): void {
    setLanguage(this.settings.language);
    document.documentElement.lang = this.settings.language;
    document.documentElement.dataset.largeText = String(this.settings.largeText);
    this.game.setReducedVfx(this.settings.reducedEffects);
    setSfxEnabled(this.settings.soundOn);
    const preset = resolveQualityPreset(this.settings.quality, isCoarsePointer());
    this.game.setQuality(QUALITY_PROFILES[preset]);
  }

  /** A storage failure while reading counts as "nothing saved" and is reported, never thrown into the load. */
  private async readSafely(): Promise<string | null> {
    try {
      return await this.port.read();
    } catch {
      this.game.session.reportSaveProblem('unreadable');
      return null;
    }
  }
}

function parseText(text: string): unknown | undefined {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
