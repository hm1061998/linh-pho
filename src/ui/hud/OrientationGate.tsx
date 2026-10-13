import { useEffect } from 'react';
import type { GameApp } from '../../app/GameApp';
import { t } from '../../content';
import { PORTRAIT_TOUCH_QUERY } from '../state/orientation';
import { useMediaQuery } from '../state/useMediaQuery';

/** Blocker name used while the portrait prompt is up. Gameplay input stays locked until the device is landscape. */
const ORIENTATION_BLOCKER = 'orientation';

/**
 * Full-screen prompt for touch devices held in portrait. It covers the game and blocks touches, and it
 * locks gameplay input while it is shown. Rotating the device removes it and restores input.
 *
 * `game` is null until the engine has started. The prompt still shows during loading, because it only
 * depends on the screen orientation.
 */
export function OrientationGate({ game }: { readonly game: GameApp | null }) {
  const needsLandscape = useMediaQuery(PORTRAIT_TOUCH_QUERY);

  useEffect(() => {
    if (!game || !needsLandscape) {
      return;
    }
    game.input.pushBlocker(ORIENTATION_BLOCKER);
    return () => game.input.popBlocker(ORIENTATION_BLOCKER);
  }, [game, needsLandscape]);

  if (!needsLandscape) {
    return null;
  }
  return (
    <section className="orientation-gate" role="alert">
      <svg className="orientation-icon" viewBox="0 0 64 64" aria-hidden="true">
        <rect x="21" y="10" width="22" height="40" rx="4" fill="none" stroke="currentColor" strokeWidth="3" />
        <path
          d="M10 40 A 24 24 0 0 1 24 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path d="M19 8 L24 12 L19 16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <h1>{t('ui.rotate.title')}</h1>
      <p>{t('ui.rotate.body')}</p>
    </section>
  );
}
