import { describe, expect, it } from 'vitest';
import enLocale from '../content/locales/en.json';
import viLocale from '../content/locales/vi.json';

/** Source text of every game file under src, except the tests. Vite loads them as raw strings at build time. */
const SOURCES = import.meta.glob<string>(['../**/*.ts', '../**/*.tsx', '!../tests/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Literal keys passed to `t('...')`. Dynamic keys (variables) are not checked here. */
function literalKeysUsedInSource(): Set<string> {
  const keys = new Set<string>();
  const pattern = /\bt\(\s*['"]([a-z][\w.]*)['"]/g;
  for (const text of Object.values(SOURCES)) {
    for (const match of text.matchAll(pattern)) {
      if (match[1]) {
        keys.add(match[1]);
      }
    }
  }
  return keys;
}

describe('locale files', () => {
  it('have the same keys in Vietnamese and English', () => {
    expect(Object.keys(enLocale).sort()).toEqual(Object.keys(viLocale).sort());
  });

  it('contain every literal t("...") key used by the game code', () => {
    const used = literalKeysUsedInSource();
    expect(used.size).toBeGreaterThan(0);
    const missing = [...used].filter((key) => !Object.hasOwn(viLocale, key));
    expect(missing).toEqual([]);
  });
});
