import type { GameApp } from '../../app/GameApp';
import { t } from '../../content';
import { useSessionSnapshot } from '../state/useSession';

/**
 * Lantern feedback: a soft jade tint over the screen in spirit phase, and a small badge that says which lamp is out.
 * The tint is a CSS transition on opacity, so it costs nothing per frame. It updates only when the phase changes.
 */
export function LanternHud({ game }: { readonly game: GameApp }) {
  const snap = useSessionSnapshot(game);
  const spirit = snap.lantern.phase === 'spirit' || snap.lantern.phase === 'to_spirit';
  return (
    <>
      <div className="spirit-tint" style={{ opacity: snap.lantern.spiritAmount }} aria-hidden="true" />
      <div className="lantern-badge" role="status">
        <span>{t(spirit ? 'ui.lantern.spirit' : 'ui.lantern.real')}</span>
        <kbd aria-hidden="true">{t('ui.lantern.key')}</kbd>
        <span className="lantern-hint">{t('ui.lantern.toggle')}</span>
      </div>
    </>
  );
}
