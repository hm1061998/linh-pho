import { describe, expect, it } from 'vitest';
import enLocale from '../content/locales/en.json';
import viLocale from '../content/locales/vi.json';
import storyJson from '../content/story_cards.json';
import { platformFrom } from '../adapters/BrowserPlatform';
import { validateStoryCards } from '../domain/content/validateStoryCards';
import { NO_ANALYTICS } from '../ports/AnalyticsPort';

const hasKey = (key: string) => Object.hasOwn(viLocale, key);

describe('story cards', () => {
  it('ships cards that all validate, with no issues', () => {
    const result = validateStoryCards(storyJson, hasKey);
    expect(result.issues).toEqual([]);
    expect(result.cards.length).toBeGreaterThan(0);
  });

  it('keeps the chapter-2 teaser as needs_review, because it is draft copy', () => {
    const teaser = validateStoryCards(storyJson, hasKey).cards.find((card) => card.id === 'card_chapter2_teaser');
    expect(teaser?.status).toBe('needs_review');
    expect(teaser?.usedIn).toContain('end.teaser');
  });

  it('marks no cultural fact as verified, since the sources were read only as summaries', () => {
    const facts = validateStoryCards(storyJson, hasKey).cards.filter((card) => card.kind === 'fact');
    expect(facts.length).toBeGreaterThan(0);
    expect(facts.every((card) => card.status === 'needs_review')).toBe(true);
  });

  it('refuses a fact marked verified without any source, and says why', () => {
    const result = validateStoryCards(
      { cards: [{ id: 'c', kind: 'fact', claim: 'Một điều chưa kiểm tra.', status: 'verified', usedIn: [], sources: [], note: '' }] },
      hasKey,
    );
    expect(result.cards).toEqual([]);
    expect(result.issues.some((issue) => issue.message.includes('at least one source'))).toBe(true);
  });

  it('accepts a fiction marked verified without a source, because the design document is its source', () => {
    const result = validateStoryCards(
      { cards: [{ id: 'f', kind: 'fiction', claim: 'Một điều hư cấu.', status: 'verified', usedIn: [], sources: [], note: '' }] },
      hasKey,
    );
    expect(result.cards.map((card) => card.id)).toEqual(['f']);
  });

  it('drops a card whose status is neither verified nor needs_review', () => {
    const result = validateStoryCards(
      { cards: [{ id: 'x', kind: 'fiction', claim: 'Một điều.', status: 'probably', usedIn: [], sources: [], note: '' }] },
      hasKey,
    );
    expect(result.cards).toEqual([]);
  });

  it('drops a card that points at a locale key the game does not have', () => {
    const result = validateStoryCards(
      { cards: [{ id: 'y', kind: 'fiction', claim: 'Một điều.', status: 'verified', usedIn: ['no.such.key'], sources: [], note: '' }] },
      hasKey,
    );
    expect(result.cards).toEqual([]);
  });

  it('refuses a source that is not https', () => {
    const result = validateStoryCards(
      {
        cards: [
          {
            id: 'z',
            kind: 'fact',
            claim: 'Một điều.',
            status: 'needs_review',
            usedIn: [],
            sources: [{ title: 'Nguồn', url: 'http://example.com/a' }],
            note: '',
          },
        ],
      },
      hasKey,
    );
    expect(result.cards).toEqual([]);
  });

  it('has a Vietnamese and an English copy for every key a card uses', () => {
    for (const card of validateStoryCards(storyJson, hasKey).cards) {
      for (const key of card.usedIn) {
        expect(Object.hasOwn(enLocale, key), `en is missing ${key}`).toBe(true);
      }
    }
  });
});

describe('platform port', () => {
  it('reads a touch-first device from its pointer media query', () => {
    const device = platformFrom({ matchMedia: (query) => ({ matches: query === '(pointer: coarse)' }), language: 'vi-VN' });
    expect(device).toEqual({ touchFirst: true, languageTag: 'vi-VN' });
  });

  it('treats a desktop pointer as not touch-first', () => {
    expect(platformFrom({ matchMedia: () => ({ matches: false }) }).touchFirst).toBe(false);
  });

  it('treats a browser that throws on the media query as a desktop, and does not throw', () => {
    const device = platformFrom({
      matchMedia: () => {
        throw new Error('unsupported');
      },
    });
    expect(device.touchFirst).toBe(false);
  });

  it('knows nothing about the device when the environment is empty', () => {
    expect(platformFrom({})).toEqual({ touchFirst: false, languageTag: '' });
  });
});

describe('analytics port', () => {
  it('accepts the chapter event and does nothing with it', () => {
    expect(NO_ANALYTICS.track({ name: 'chapter.completed', chapter: 'first_chapter' })).toBeUndefined();
  });
});
