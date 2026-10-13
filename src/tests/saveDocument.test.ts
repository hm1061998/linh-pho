import { describe, expect, it } from 'vitest';
import { BLANK_PROGRESS, type SessionProgress } from '../domain/save/SessionProgress';
import {
  DEFAULT_SETTINGS,
  parseSaveDocument,
  parseSettings,
  serializeSaveDocument,
} from '../domain/save/SaveDocument';

/** A valid save document, built the same way the game builds one. Tests break one field at a time from here. */
function validDocument(): Record<string, unknown> {
  return JSON.parse(serializeSaveDocument(BLANK_PROGRESS, DEFAULT_SETTINGS, new Date('2026-10-13T00:00:00Z'))) as Record<string, unknown>;
}

function progressOf(document: Record<string, unknown>): Record<string, unknown> {
  return document.progress as Record<string, unknown>;
}

describe('save document: versions and shape', () => {
  it('accepts a document the game wrote itself, and reads it back unchanged', () => {
    const result = parseSaveDocument(validDocument());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.progress).toEqual(BLANK_PROGRESS);
      expect(result.document.settings).toEqual(DEFAULT_SETTINGS);
      expect(result.document.savedAt).toBe('2026-10-13T00:00:00.000Z');
    }
  });

  it('refuses something that is not an object', () => {
    expect(parseSaveDocument('not a save')).toEqual({ ok: false, reason: 'not_an_object' });
    expect(parseSaveDocument(null)).toEqual({ ok: false, reason: 'not_an_object' });
    expect(parseSaveDocument([1, 2])).toEqual({ ok: false, reason: 'not_an_object' });
  });

  it('refuses a missing version, a version from the future, and a version that is not a whole number', () => {
    const missing = validDocument();
    delete missing.version;
    expect(parseSaveDocument(missing)).toEqual({ ok: false, reason: 'unknown_version' });
    expect(parseSaveDocument({ ...validDocument(), version: 99 })).toEqual({ ok: false, reason: 'unknown_version' });
    expect(parseSaveDocument({ ...validDocument(), version: 1.5 })).toEqual({ ok: false, reason: 'unknown_version' });
  });

  it('refuses progress whose coins are not a whole number, and keeps nothing from it', () => {
    const document = validDocument();
    document.progress = { ...progressOf(document), coins: '30' };
    expect(parseSaveDocument(document)).toEqual({ ok: false, reason: 'invalid_progress' });
  });

  it('refuses an inventory stack whose quality is not a known quality', () => {
    const document = validDocument();
    document.progress = { ...progressOf(document), inventory: [{ itemId: 'wooden_lantern', quality: 'mythic', count: 1 }] };
    expect(parseSaveDocument(document)).toEqual({ ok: false, reason: 'invalid_progress' });
  });

  it('refuses a quest whose status is not one of the three known states', () => {
    const document = validDocument();
    document.progress = { ...progressOf(document), quests: { q00: { status: 'winning', progress: {} } } };
    expect(parseSaveDocument(document)).toEqual({ ok: false, reason: 'invalid_progress' });
  });

  it('ignores fields it does not know, so a newer save still loads its known parts', () => {
    const document = validDocument();
    document.progress = { ...progressOf(document), coins: 12, somethingNew: { anything: true } };
    document.extraAtTheTop = 'ignored';
    const result = parseSaveDocument(document);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.progress.coins).toBe(12);
    }
  });
});

describe('save document: settings fall back, progress does not', () => {
  it('replaces a bad setting with its default and keeps the progress', () => {
    const document = validDocument();
    document.settings = { language: 'fr', reducedEffects: 'yes', soundOn: false };
    const result = parseSaveDocument(document);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.settings).toEqual({ language: 'vi', reducedEffects: false, soundOn: false });
    }
  });

  it('uses the defaults for settings that are missing altogether', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips a non-default setting', () => {
    const settings = { language: 'en', reducedEffects: true, soundOn: false } as const;
    const text = serializeSaveDocument(BLANK_PROGRESS, settings, new Date(0));
    const result = parseSaveDocument(JSON.parse(text));
    expect(result.ok && result.document.settings).toEqual(settings);
  });
});

describe('save document: a progress object survives the round trip', () => {
  it('keeps every field of a playthrough through serialise and parse', () => {
    const progress: SessionProgress = {
      ...BLANK_PROGRESS,
      coins: 55,
      reputation: 12,
      shopLevel: 2,
      flags: { q00_complete: true, mvp_complete: true },
      inventory: [{ itemId: 'wooden_lantern', quality: 'perfect', count: 1 }, { itemId: 'bamboo', quality: null, count: 2 }],
      collectedPickups: ['pk_bamboo_1'],
      placed: ['shop_lamp'],
      quests: { q00_dem_mo_cho: { status: 'completed', progress: { gather_bamboo: ['pk_bamboo_1'] } } },
      lanternSpirit: true,
      puzzles: { puzzle_glyph_order: { solved: true, attempts: 2 } },
      shop: { stock: { bamboo_vase: 1 }, sockets: { shop_slot_1: 'lantern_shelf', shop_slot_2: null }, purchases: 3 },
      orders: { accepted: ['order_wood_lantern'], delivered: ['order_paper_rope'] },
    };
    const parsed = parseSaveDocument(JSON.parse(serializeSaveDocument(progress, DEFAULT_SETTINGS, new Date(0))));
    expect(parsed.ok && parsed.document.progress).toEqual(progress);
  });
});
