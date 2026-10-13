import type { GameApp } from '../../app/GameApp';
import { t } from '../../content';
import { useSessionSnapshot } from '../state/useSession';

/** Top-right currency: Xu Đèn (coins) and Uy Tín (reputation). Reputation is earned, never bought. */
export function CurrencyBar({ game }: { readonly game: GameApp }) {
  const snap = useSessionSnapshot(game);
  return (
    <div className="currency-bar" aria-label={t('ui.hud.currency')}>
      <span>
        <b>{snap.coins}</b> {t('ui.hud.coins')}
      </span>
      <span>
        <b>{snap.reputation}</b> {t('ui.hud.reputation')}
      </span>
    </div>
  );
}

/** Top-left tracker: the first active quest and its objectives, with progress. */
export function QuestTracker({ game }: { readonly game: GameApp }) {
  const snap = useSessionSnapshot(game);
  const quest = snap.activeQuest;
  if (!quest) {
    return null;
  }
  return (
    <section className="quest-tracker" aria-label={t('ui.tracker.title')}>
      <h2>{t(quest.titleKey)}</h2>
      <ul>
        {quest.objectives.map((objective) => (
          <li key={objective.id} className={objective.done ? 'done' : undefined}>
            <span aria-hidden="true">{objective.done ? '✓' : '○'}</span>
            <span>
              {t(objective.textKey)}
              {objective.count > 1 ? ` (${objective.progress}/${objective.count})` : ''}
              {/* The check mark above is hidden from screen readers, so the state is spoken here instead. */}
              <span className="sr-only">{` — ${t(objective.done ? 'ui.tracker.done' : 'ui.tracker.todo')}`}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
