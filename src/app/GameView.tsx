import { useEffect, useRef, useState } from 'react';
import { StartupErrorPanel, type StartupErrorReason } from '../ui/hud/StartupErrorPanel';
import { GameApp } from './GameApp';
import { GameStartupError } from './startupErrors';

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready' }
  | { readonly status: 'error'; readonly reason: StartupErrorReason };

/**
 * Mounts the game canvas under a transparent HUD root.
 * The canvas is created imperatively for each effect run, so StrictMode and HMR never share an
 * engine instance or a WebGL context. The effect cleanup disposes the engine and removes the canvas.
 */
export function GameView() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<ViewState>({ status: 'loading' });

  useEffect(() => {
    const container = viewportRef.current;
    if (!container) {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.className = 'game-canvas';
    canvas.setAttribute('aria-label', 'Cảnh chơi Linh Phố');
    container.appendChild(canvas);

    let cancelled = false;
    let game: GameApp | null = null;

    GameApp.create({ canvas, container })
      .then((created) => {
        // The effect was cleaned up while the device was still being created. Dispose and stop.
        if (cancelled) {
          created.dispose();
          return;
        }
        game = created;
        setState({ status: 'ready' });
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
      game?.dispose();
      game = null;
      canvas.remove();
    };
  }, []);

  return (
    <div className="game-shell">
      <div ref={viewportRef} className="game-viewport" />
      <div className="hud-root">
        {state.status === 'loading' && (
          <p className="status-card" role="status">
            Đang thắp đèn chợ…
          </p>
        )}
        {state.status === 'error' && <StartupErrorPanel reason={state.reason} />}
      </div>
    </div>
  );
}
