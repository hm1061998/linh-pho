import type { Quality } from '../content/gameplayTypes';
import { cleanKeyMap, DEFAULT_KEY_MAP, type KeyMap } from '../input/keyMap';
import { type SessionProgress } from './SessionProgress';

/**
 * The save file: one playthrough and the player's settings. Every field is checked on load. Progress that fails the
 * check is not trusted, and the game starts fresh, keeping the bad text as a backup, so nothing is lost silently.
 * Settings that fail the check fall back to their defaults, and the progress is kept.
 */

export const SAVE_VERSION = 1;

export type Language = 'vi' | 'en';

/** `auto` picks a preset from the device: mobile for touch screens, high otherwise. */
export type QualityChoice = 'auto' | 'low' | 'mobile' | 'high';

export interface Settings {
  readonly language: Language;
  readonly reducedEffects: boolean;
  readonly soundOn: boolean;
  readonly quality: QualityChoice;
  /** `large` scales the whole HUD up, for players who need bigger text and buttons. */
  readonly largeText: boolean;
  /** The player's keys. A save from before this field existed loads with the defaults. */
  readonly keys: KeyMap;
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'vi',
  reducedEffects: false,
  soundOn: true,
  quality: 'auto',
  largeText: false,
  keys: DEFAULT_KEY_MAP,
};

const QUALITY_CHOICES: readonly QualityChoice[] = ['auto', 'low', 'mobile', 'high'];

export interface SaveDocument {
  readonly version: number;
  readonly savedAt: string;
  readonly progress: SessionProgress;
  readonly settings: Settings;
}

export type ParseResult = { readonly ok: true; readonly document: SaveDocument } | { readonly ok: false; readonly reason: string };

/** One step: takes a save of one version and returns the next version's shape. */
export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/**
 * One step per old version: `MIGRATIONS[n]` turns a version-n save into a version-(n+1) save. Version 1 is the first
 * format, so the table is empty. Add an entry here, never edit an old one, when the format changes.
 */
const MIGRATIONS: Readonly<Record<number, Migration>> = {};

const QUALITIES: readonly (Quality | null)[] = [null, 'normal', 'good', 'perfect'];
const QUEST_STATUSES = ['locked', 'active', 'completed'] as const;
const LANGUAGES: readonly Language[] = ['vi', 'en'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

/** A record whose every value passes `check`. An empty record is fine. */
function recordOf<T>(value: unknown, check: (entry: unknown) => entry is T): value is Record<string, T> {
  return isRecord(value) && Object.values(value).every(check);
}

function parseInventory(value: unknown): SessionProgress['inventory'] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const stacks: { itemId: string; quality: Quality | null; count: number }[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.itemId !== 'string' || !QUALITIES.includes(entry.quality as Quality | null)) {
      return null;
    }
    if (typeof entry.count !== 'number' || !Number.isInteger(entry.count) || entry.count < 1) {
      return null;
    }
    stacks.push({ itemId: entry.itemId, quality: entry.quality as Quality | null, count: entry.count });
  }
  return stacks;
}

function parseQuests(value: unknown): SessionProgress['quests'] | null {
  if (!isRecord(value)) {
    return null;
  }
  const quests: Record<string, { status: (typeof QUEST_STATUSES)[number]; progress: Record<string, string[]> }> = {};
  for (const [questId, entry] of Object.entries(value)) {
    if (!isRecord(entry) || !QUEST_STATUSES.includes(entry.status as (typeof QUEST_STATUSES)[number])) {
      return null;
    }
    if (!recordOf(entry.progress, isStringList)) {
      return null;
    }
    quests[questId] = { status: entry.status as (typeof QUEST_STATUSES)[number], progress: entry.progress };
  }
  return quests;
}

function parseShop(value: unknown): SessionProgress['shop'] | null {
  if (!isRecord(value) || !recordOf(value.stock, isCount) || !recordOf(value.sockets, isNullableString)) {
    return null;
  }
  if (!isCount(value.purchases)) {
    return null;
  }
  return { stock: value.stock, sockets: value.sockets, purchases: value.purchases };
}

function isNullableString(entry: unknown): entry is string | null {
  return entry === null || typeof entry === 'string';
}

function parseOrders(value: unknown): SessionProgress['orders'] | null {
  if (!isRecord(value) || !isStringList(value.accepted) || !isStringList(value.delivered)) {
    return null;
  }
  return { accepted: value.accepted, delivered: value.delivered };
}

function isBoolean(entry: unknown): entry is boolean {
  return typeof entry === 'boolean';
}

/** Checks a whole playthrough. Returns null when any part is the wrong shape. Unknown extra fields are ignored. */
export function parseProgress(value: unknown): SessionProgress | null {
  if (!isRecord(value)) {
    return null;
  }
  const inventory = parseInventory(value.inventory);
  const quests = parseQuests(value.quests);
  const shop = parseShop(value.shop);
  const orders = parseOrders(value.orders);
  const puzzlesOk = recordOf(value.puzzles, (entry): entry is { solved: boolean; attempts: number } => {
    return isRecord(entry) && isBoolean(entry.solved) && isCount(entry.attempts);
  });
  if (
    !isCount(value.coins) ||
    !isCount(value.reputation) ||
    !isCount(value.shopLevel) ||
    !recordOf(value.flags, isBoolean) ||
    !inventory ||
    !isStringList(value.collectedPickups) ||
    !isStringList(value.placed) ||
    !quests ||
    !isBoolean(value.lanternSpirit) ||
    !puzzlesOk ||
    !shop ||
    !orders
  ) {
    return null;
  }
  return {
    coins: value.coins,
    reputation: value.reputation,
    shopLevel: value.shopLevel,
    flags: value.flags as Record<string, boolean>,
    inventory,
    collectedPickups: value.collectedPickups,
    placed: value.placed,
    quests,
    lanternSpirit: value.lanternSpirit,
    puzzles: value.puzzles as Record<string, { solved: boolean; attempts: number }>,
    shop,
    orders,
  };
}

/** Settings are small and easy to recover, so a bad field falls back to its default instead of failing the save. */
export function parseSettings(value: unknown): Settings {
  if (!isRecord(value)) {
    return DEFAULT_SETTINGS;
  }
  return {
    language: LANGUAGES.includes(value.language as Language) ? (value.language as Language) : DEFAULT_SETTINGS.language,
    reducedEffects: isBoolean(value.reducedEffects) ? value.reducedEffects : DEFAULT_SETTINGS.reducedEffects,
    soundOn: isBoolean(value.soundOn) ? value.soundOn : DEFAULT_SETTINGS.soundOn,
    quality: QUALITY_CHOICES.includes(value.quality as QualityChoice) ? (value.quality as QualityChoice) : DEFAULT_SETTINGS.quality,
    largeText: isBoolean(value.largeText) ? value.largeText : DEFAULT_SETTINGS.largeText,
    keys: cleanKeyMap(value.keys),
  };
}

/** Parses saved text into a checked document, running the shipped migrations first. */
export function parseSaveDocument(raw: unknown): ParseResult {
  return parseSaveDocumentWith(raw, MIGRATIONS);
}

/**
 * The same as `parseSaveDocument`, with the migration table passed in. The shipped game uses its own table. Tests pass
 * their own, so every migration step can be checked before a real format change needs it.
 */
export function parseSaveDocumentWith(raw: unknown, migrations: Readonly<Record<number, Migration>>): ParseResult {
  if (!isRecord(raw)) {
    return { ok: false, reason: 'not_an_object' };
  }
  let current: Record<string, unknown> = raw;
  const savedVersion = raw.version;
  // Versions below the current one are passed to the migration table. Versions above it are from a newer game.
  if (typeof savedVersion !== 'number' || !Number.isInteger(savedVersion) || savedVersion < 0 || savedVersion > SAVE_VERSION) {
    return { ok: false, reason: 'unknown_version' };
  }
  let version: number = savedVersion;
  while (version < SAVE_VERSION) {
    const migrate = migrations[version];
    if (!migrate) {
      return { ok: false, reason: 'no_migration' };
    }
    current = migrate(current);
    version = typeof current.version === 'number' ? current.version : version + 1;
  }
  const progress = parseProgress(current.progress);
  if (!progress) {
    return { ok: false, reason: 'invalid_progress' };
  }
  return {
    ok: true,
    document: {
      version: SAVE_VERSION,
      savedAt: typeof current.savedAt === 'string' ? current.savedAt : '',
      progress,
      settings: parseSettings(current.settings),
    },
  };
}

/** The text written to storage. Stable field order, so a save can be compared by eye. */
export function serializeSaveDocument(progress: SessionProgress, settings: Settings, savedAt: Date): string {
  const document: SaveDocument = { version: SAVE_VERSION, savedAt: savedAt.toISOString(), progress, settings };
  return JSON.stringify(document);
}
