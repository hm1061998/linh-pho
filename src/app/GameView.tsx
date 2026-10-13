import { useEffect, useRef, useState } from 'react';
import { DialoguePanel } from '../ui/dialogue/DialoguePanel';
import { PanelHost } from '../ui/panels/PanelHost';
import { EndScreen } from '../ui/hud/EndScreen';
import { CurrencyBar, QuestTracker } from '../ui/hud/HudBars';
import { InteractionHint } from '../ui/hud/InteractionHint';
import { LanternHud } from '../ui/hud/LanternHud';
import { MenuButton, PauseMenu } from '../ui/hud/PauseMenu';
import { AssetInspector } from '../ui/dev/AssetInspector';
import { StatsOverlay } from '../ui/dev/StatsOverlay';
import { NoticeStack } from '../ui/hud/NoticeStack';
import { OrientationGate } from '../ui/hud/OrientationGate';
import { StartupErrorPanel, type StartupErrorReason } from '../ui/hud/StartupErrorPanel';
import { TouchControls } from '../ui/hud/TouchControls';
import { useLanguage } from '../ui/state/useLanguage';
import { t } from '../content';
import { acquireSaveLock, browserLocks } from '../adapters/SaveLock';
import { LocalSaveAdapter } from '../adapters/LocalSaveAdapter';
import { unlockAudio } from '../shared/audio/sfx';
import { GameApp } from './GameApp';
import { GameStartupError } from './startupErrors';
import { SaveController, type LoadOutcome } from './SaveController';

type ViewState =
  | { readonly status: 'loading' }
  /** Another tab owns the save. This tab waits, and starts when that tab closes. */
  | { readonly status: 'waiting_save' }
  | {
      readonly status: 'ready';
      readonly game: GameApp;
      readonly controller: SaveController;
      readonly loadOutcome: LoadOutcome;
    }
  | { readonly status: 'error'; readonly reason: StartupErrorReason };

/**
 * Mounts the game canvas under a transparent HUD root. The canvas is created imperatively for each effect run, so
 * StrictMode and HMR never share an engine instance or a WebGL context. The save is loaded before the HUD appears, so
 * the player never sees a fresh world replace the saved one. Only one tab at a time owns the save, so two open tabs
 * cannot overwrite each other. The effect cleanup disposes everything it created and gives the save lock back.
 */
export function GameView() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<ViewState>({ status: 'loading' });
  const language = useLanguage();

  useEffect(() => {
    const container = viewportRef.current;
    if (!container) {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.className = 'game-canvas';
    canvas.setAttribute('aria-label', t('ui.canvas.label'));
    container.appendChild(canvas);

    // Browsers block audio until the player does something. The first press or key starts the sound.
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    let cancelled = false;
    let game: GameApp | null = null;
    let controller: SaveController | null = null;
    let removeDevHandle: (() => void) | null = null;
    let releaseSave: (() => void) | null = null;
    const waitingForSave = new AbortController();

    // Without the Web Locks API the lock is skipped, and the game starts as it did before.
    const locks = browserLocks();
    const ownership: Promise<(() => void) | null> = locks
      ? acquireSaveLock(locks, waitingForSave.signal, () => {
          if (!cancelled) {
            setState({ status: 'waiting_save' });
          }
        })
      : Promise.resolve(null);

    ownership
      .then((release) => {
        if (cancelled) {
          release?.();
          return undefined;
        }
        releaseSave = release;
        setState({ status: 'loading' });
        return GameApp.create({ canvas, container }).then(async (created) => {
          // The effect was cleaned up while the device was still being created. Dispose and stop.
          if (cancelled) {
            created.dispose();
            return;
          }
          game = created;
          const loader = new SaveController(created, new LocalSaveAdapter());
          const loadOutcome = await loader.load();
          if (cancelled) {
            loader.dispose();
            created.dispose();
            return;
          }
          controller = loader;
          if (import.meta.env.DEV) {
            // Dev-only handle for acceptance checks in the browser console. Stripped from production builds.
            const scope = window as Window & { __linhPho?: { game: GameApp } };
            scope.__linhPho = { game: created };
            removeDevHandle = () => {
              delete scope.__linhPho;
            };
          }
          setState({ status: 'ready', game: created, controller: loader, loadOutcome });
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        console.error('[Linh Phố] Game failed to start', error);
        const reason = error instanceof GameStartupError ? error.code : 'unknown';
        setState({ status: 'error', reason });
      });

    return () => {
      cancelled = true;
      waitingForSave.abort();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      removeDevHandle?.();
      controller?.dispose();
      game?.dispose();
      game = null;
      // Last, so nothing writes the save after another tab has been given the lock.
      releaseSave?.();
      releaseSave = null;
      canvas.remove();
    };
  }, []);

  return (
    <div className="game-shell">
      <div ref={viewportRef} className="game-viewport" />
      {/* Keyed by language, so every HUD string re-renders in the new language at once. */}
      <div className="hud-root" key={language} lang={language}>
        {state.status === 'loading' && (
          <p className="status-card" role="status">
            {t('ui.loading')}
          </p>
        )}
        {state.status === 'waiting_save' && (
          <p className="status-card" role="status">
            {t('ui.save.waiting')}
          </p>
        )}
        {state.status === 'ready' && (
          <>
            <LanternHud game={state.game} />
            <CurrencyBar game={state.game} />
            <QuestTracker game={state.game} />
            <NoticeStack game={state.game} />
            <InteractionHint game={state.game} />
            <PanelHost game={state.game} />
            <EndScreen game={state.game} />
            <DialoguePanel game={state.game} />
            <TouchControls game={state.game} />
            <MenuButton />
            <StatsOverlay game={state.game} />
            <AssetInspector game={state.game} />
            <PauseMenu game={state.game} controller={state.controller} />
            {state.loadOutcome === 'recovered' && <RecoveryBanner />}
          </>
        )}
        {state.status === 'error' && <StartupErrorPanel reason={state.reason} />}
        <OrientationGate game={state.status === 'ready' ? state.game : null} />
      </div>
    </div>
  );
}

/** Shown once when an old save could not be read. The copy is kept, and the game starts fresh. */
function RecoveryBanner() {
  const [open, setOpen] = useState(true);
  if (!open) {
    return null;
  }
  return (
    <div className="save-banner" role="status">
      <p>{t('notice.save_unreadable')}</p>
      <button type="button" onClick={() => setOpen(false)}>
        {t('ui.panel.close')}
      </button>
    </div>
  );
}
