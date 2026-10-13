import { describe, expect, it } from 'vitest';
import enLocale from '../content/locales/en.json';
import viLocale from '../content/locales/vi.json';

/**
 * The locale test checks literal `t('...')` calls. Some keys are built at runtime (a status name, a quality, a
 * startup message), so this list names them. Each one must exist in both languages.
 */
const BUILT_AT_RUNTIME = [
  'startup.webgl2',
  'startup.engine',
  'startup.unknown',
  'ui.shop.status.open',
  'ui.shop.status.accepted',
  'ui.shop.status.delivered',
  'quality.normal',
  'quality.good',
  'quality.perfect',
  'ui.action.collect',
  'ui.action.work',
  'ui.action.place',
  'ui.action.scan',
  'ui.action.shop',
  'symbol.gate.name',
  'symbol.bridge.name',
  'symbol.signboard.name',
  'ui.lantern.real',
  'ui.lantern.spirit',
];

describe('keys built at runtime', () => {
  it.each(BUILT_AT_RUNTIME)('%s exists in both languages', (key) => {
    expect(Object.hasOwn(viLocale, key), `vi is missing ${key}`).toBe(true);
    expect(Object.hasOwn(enLocale, key), `en is missing ${key}`).toBe(true);
  });
});
