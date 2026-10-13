import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../shared/i18n/translator';

const DICTIONARIES = {
  vi: { 'ui.hello': 'Xin chào', 'ui.only_vi': 'Chỉ có tiếng Việt', 'ui.greet': 'Chào {name}' },
  en: { 'ui.hello': 'Hello', 'ui.only_en': 'English only' },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createTranslator', () => {
  it('uses the primary locale first', () => {
    const t = createTranslator(DICTIONARIES, 'vi', 'en').t;
    expect(t('ui.hello')).toBe('Xin chào');
  });

  it('falls back to the fallback locale', () => {
    const t = createTranslator(DICTIONARIES, 'vi', 'en').t;
    expect(t('ui.only_en')).toBe('English only');
  });

  it('shows a visible marker for a missing key and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = createTranslator(DICTIONARIES, 'vi', 'en').t;

    expect(t('ui.nope')).toBe('[ui.nope]');
    expect(t('ui.nope')).toBe('[ui.nope]');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('fills {name} placeholders and leaves unknown ones visible', () => {
    const t = createTranslator(DICTIONARIES, 'vi', 'en').t;
    expect(t('ui.greet', { name: 'Bấc' })).toBe('Chào Bấc');
    expect(t('ui.greet')).toBe('Chào {name}');
  });

  it('does not resolve inherited object properties as text', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = createTranslator(DICTIONARIES, 'vi', 'en').t;
    expect(t('constructor')).toBe('[constructor]');
    expect(t('toString')).toBe('[toString]');
  });
});
