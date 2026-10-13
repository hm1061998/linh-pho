import { describe, expect, it } from 'vitest';
import { GAME_CONTENT } from '../content';
import { validateStoryCards } from '../domain/content/validateStoryCards';
import { GameSession, storyReadFlag } from '../domain/GameSession';
import storyJson from '../content/story_cards.json';
import viLocale from '../content/locales/vi.json';
import { fitFrame } from './craftHelpers';

const hasKey = (key: string) => Object.hasOwn(viLocale, key);

/** Q00 played through with the shipped content. Its completion opens the first «Chuyện Đằng Sau» cards. */
function afterQ00(): GameSession {
  const session = new GameSession(GAME_CONTENT);
  session.start();
  session.dialogue.start('dlg_ba_nghiem');
  session.dialogue.close('dismissed');
  for (const pickup of ['pk_bamboo_1', 'pk_bamboo_2', 'pk_paper_1', 'pk_rope_1']) {
    session.collectPickup(pickup);
  }
  session.beginCraft('recipe_wooden_lantern', 'station_workbench');
  fitFrame(session);
  session.placeItem('shop_lamp');
  return session;
}

describe('story cards in the game', () => {
  it('shows no card before its quest is done', () => {
    const session = new GameSession(GAME_CONTENT);
    session.start();
    expect(session.snapshot().storyCards).toEqual([]);
    expect(session.currentPanel).toBeNull();
  });

  it('opens the first unread card once its quest is done, and lists the open cards in the journal', () => {
    const session = afterQ00();
    expect(session.currentPanel).toEqual({ kind: 'story', cardId: 'card_giay_do_material' });
    expect(session.snapshot().storyCards.map((card) => card.id)).toEqual(['card_giay_do_material', 'card_fiction_market']);
  });

  it('marks a card read when it closes, and then offers the next unread card', () => {
    const session = afterQ00();
    session.closePanel();
    expect(session.flags.get(storyReadFlag('card_giay_do_material'))).toBe(true);
    expect(session.currentPanel).toEqual({ kind: 'story', cardId: 'card_fiction_market' });
  });

  it('does not open a read card again after a reload', () => {
    const session = afterQ00();
    session.closePanel();
    session.closePanel();
    const saved = session.saveProgress();

    const reloaded = new GameSession(GAME_CONTENT);
    reloaded.start();
    reloaded.restoreProgress(saved);
    expect(reloaded.currentPanel).not.toEqual({ kind: 'story', cardId: 'card_giay_do_material' });
    const read = reloaded.snapshot().storyCards.filter((card) => card.read).map((card) => card.id);
    expect(read).toEqual(['card_giay_do_material', 'card_fiction_market']);
  });

  it('does not offer a card while the chapter-end card is pending', () => {
    const session = new GameSession(GAME_CONTENT);
    session.start();
    session.flags.set('mvp_complete', true);
    session.flags.set('q00_complete', true);
    session.closePanel();
    expect(session.currentPanel).toBeNull();
  });
});

describe('story cards: what the game is allowed to show', () => {
  it('shows the verified cards and keeps the unverified harvest card out of the game', () => {
    const shown = validateStoryCards(storyJson, hasKey).cards.filter((card) => card.unlockedBy !== null);
    expect(shown.map((card) => card.id)).toEqual([
      'card_giay_do_material',
      'card_buoi_history',
      'card_fiction_market',
      'card_fiction_spirit_lamp',
    ]);
    for (const card of shown) {
      expect(card.titleKey, card.id).not.toBeNull();
      if (card.kind === 'fact') {
        expect(card.status, card.id).toBe('verified');
        expect(card.factKey, card.id).not.toBeNull();
      }
    }
  });

  it('drops a fact shown in the game when it is not verified, and says why', () => {
    const result = validateStoryCards(
      {
        cards: [
          {
            id: 'unchecked',
            kind: 'fact',
            claim: 'Một điều chưa kiểm tra.',
            status: 'needs_review',
            usedIn: [],
            sources: [{ title: 'Nguồn', url: 'https://example.org/a' }],
            note: '',
            unlockedBy: 'q00_dem_mo_cho',
            titleKey: 'story.giay_do.title',
            factKey: 'story.giay_do.fact',
          },
        ],
      },
      hasKey,
    );
    expect(result.cards).toEqual([]);
    expect(result.issues.some((issue) => issue.message.includes('verified'))).toBe(true);
  });

  it('drops a shown card with no title, and says why', () => {
    const result = validateStoryCards(
      {
        cards: [{ id: 'no_title', kind: 'fiction', claim: 'Hư cấu.', status: 'verified', usedIn: [], sources: [], note: '', unlockedBy: 'q00_dem_mo_cho', fictionKey: 'story.market.fiction' }],
      },
      hasKey,
    );
    expect(result.cards).toEqual([]);
    expect(result.issues.some((issue) => issue.message.includes('titleKey'))).toBe(true);
  });
});
