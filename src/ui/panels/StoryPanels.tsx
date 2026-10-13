import type { GameApp } from '../../app/GameApp';
import { t } from '../../content';
import type { SessionSnapshot } from '../../domain/GameSession';

/**
 * The «Chuyện Đằng Sau» card. The cultural fact and the fiction set in the world are shown in two parts, so a player can
 * tell them apart. The fact lists its sources. Closing the card marks it read.
 */
export function StoryCardPanel({ game, snap, cardId }: { readonly game: GameApp; readonly snap: SessionSnapshot; readonly cardId: string }) {
  const card = snap.storyCards.find((candidate) => candidate.id === cardId);
  return (
    <>
      <header className="panel-header">
        <h2>{card ? t(card.titleKey) : t('ui.story.label')}</h2>
        <button type="button" onClick={() => game.session.closePanel()}>
          {t('ui.panel.close')}
        </button>
      </header>
      {card?.factKey ? (
        <section className="story-part story-fact" aria-labelledby="story-fact-title">
          <h3 id="story-fact-title">{t('ui.story.fact')}</h3>
          <p>{t(card.factKey)}</p>
          <ul className="story-sources">
            {card.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {card?.fictionKey ? (
        <section className="story-part story-fiction" aria-labelledby="story-fiction-title">
          <h3 id="story-fiction-title">{t('ui.story.fiction')}</h3>
          <p>{t(card.fictionKey)}</p>
        </section>
      ) : null}
    </>
  );
}

/** The journal: the quests with their state, and the story cards that are open, read or not. */
export function JournalPanel({ game, snap }: { readonly game: GameApp; readonly snap: SessionSnapshot }) {
  return (
    <>
      <header className="panel-header">
        <h2>{t('ui.journal.title')}</h2>
        <button type="button" onClick={() => game.session.closePanel()}>
          {t('ui.panel.close')}
        </button>
      </header>
      <section className="journal-section" aria-label={t('ui.journal.quests')}>
        <h3>{t('ui.journal.quests')}</h3>
        <ul>
          {snap.quests.map((quest) => (
            <li key={quest.id}>
              {t(quest.titleKey)}: <span>{t(`ui.journal.quest.${quest.status}`)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="journal-section" aria-label={t('ui.journal.stories')}>
        <h3>{t('ui.journal.stories')}</h3>
        {snap.storyCards.length === 0 ? (
          <p>{t('ui.journal.empty')}</p>
        ) : (
          <ul>
            {snap.storyCards.map((card) => (
              <li key={card.id}>
                <button type="button" onClick={() => game.session.openPanel({ kind: 'story', cardId: card.id })}>
                  {t(card.titleKey)}
                </button>{' '}
                <span>{t(card.read ? 'ui.story.read' : 'ui.story.unread')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
