import { useEffect, useState } from 'react';
import type { GameApp } from '../../app/GameApp';
import { t } from '../../content';
import { useSessionSnapshot } from '../state/useSession';

/** Input blocker name. It stops movement and interaction behind the card, and is removed when the card closes. */
const ENDING_BLOCKER = 'ending';

/**
 * The end of the first playable chapter. It shows once the MVP flag is set, with a short summary and a teaser for
 * the next chapter. Closing it returns the player to the open shop. The teaser is draft copy: the story cards
 * track whether each line has been checked.
 */
export function EndScreen({ game }: { readonly game: GameApp }) {
  const snap = useSessionSnapshot(game);
  const [dismissed, setDismissed] = useState(false);
  const visible = snap.flags.mvp_complete === true && !dismissed;

  useEffect(() => {
    if (!visible) {
      return;
    }
    // One modal at a time: an open panel would sit under the card. Closing it returns any materials in use.
    if (game.session.currentPanel) {
      game.session.closePanel();
    }
    game.input.pushBlocker(ENDING_BLOCKER);
    return () => game.input.popBlocker(ENDING_BLOCKER);
  }, [game, visible]);

  if (!visible) {
    return null;
  }
  return (
    <section className="end-card" role="dialog" aria-modal="true" aria-labelledby="end-title">
      <h2 id="end-title">{t('end.title')}</h2>
      <p>{t('end.body')}</p>
      <p className="end-stats">{t('end.stats', { coins: String(snap.coins), reputation: String(snap.reputation) })}</p>
      <h3>{t('end.teaser_title')}</h3>
      <p className="end-teaser">{t('end.teaser')}</p>
      <button type="button" onClick={() => setDismissed(true)}>
        {t('end.continue')}
      </button>
    </section>
  );
}
