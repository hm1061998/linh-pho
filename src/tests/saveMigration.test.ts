import { describe, expect, it } from 'vitest';
import { DEFAULT_KEY_MAP } from '../domain/input/keyMap';
import { BLANK_PROGRESS } from '../domain/save/SessionProgress';
import {
  DEFAULT_SETTINGS,
  parseSaveDocument,
  parseSaveDocumentWith,
  serializeSaveDocument,
  type Migration,
} from '../domain/save/SaveDocument';

/**
 * A pretend version-0 save, from before the settings were called `settings`. The shipped game has no version 0, so
 * these tests give the migration table their own steps. That way every step is proven before a real format change.
 */
function versionZeroSave(): Record<string, unknown> {
  return {
    version: 0,
    savedAt: '2026-01-01T00:00:00.000Z',
    progress: { ...BLANK_PROGRESS, coins: 7 },
    config: { language: 'en', reducedEffects: true, soundOn: false, quality: 'low' },
  };
}

const RENAME_CONFIG: Migration = (raw) => {
  const { config, ...rest } = raw;
  return { ...rest, version: 1, settings: config };
};

describe('save migrations', () => {
  it('runs the registered step, then checks the result as the current version', () => {
    const result = parseSaveDocumentWith(versionZeroSave(), { 0: RENAME_CONFIG });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.version).toBe(1);
      expect(result.document.progress.coins).toBe(7);
      // Settings the old save did not have (largeText, keys) take their defaults. The ones it had are kept.
      expect(result.document.settings).toEqual({
        language: 'en',
        reducedEffects: true,
        soundOn: false,
        quality: 'low',
        largeText: false,
        keys: DEFAULT_KEY_MAP,
      });
    }
  });

  it('refuses an old version when no step exists for it, and says which step is missing', () => {
    expect(parseSaveDocumentWith(versionZeroSave(), {})).toEqual({ ok: false, reason: 'no_migration' });
  });

  it('does not run any step for a save that is already the current version', () => {
    const current = JSON.parse(serializeSaveDocument(BLANK_PROGRESS, DEFAULT_SETTINGS, new Date(0))) as Record<string, unknown>;
    const explode: Migration = () => {
      throw new Error('should not run');
    };
    expect(parseSaveDocumentWith(current, { 0: explode, 1: explode }).ok).toBe(true);
  });

  it('catches a step that breaks the progress, because the result is still checked', () => {
    const breaks: Migration = (raw) => ({ ...raw, version: 1, progress: 'not a playthrough' });
    expect(parseSaveDocumentWith(versionZeroSave(), { 0: breaks })).toEqual({ ok: false, reason: 'invalid_progress' });
  });

  it('the shipped game has no old versions yet, so a version-0 save is refused rather than guessed at', () => {
    expect(parseSaveDocument(versionZeroSave())).toEqual({ ok: false, reason: 'no_migration' });
  });

  it('refuses a save from a newer game, so an old build never half-reads it', () => {
    expect(parseSaveDocument({ ...versionZeroSave(), version: 2 })).toEqual({ ok: false, reason: 'unknown_version' });
  });
});
