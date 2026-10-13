import { validateContent } from '../domain/content/validate';
import type { ContentIssue, GameContent, NpcDefinition } from '../domain/content/types';
import { createTranslator } from '../shared/i18n/translator';
import dialoguesJson from './dialogues.json';
import enLocale from './locales/en.json';
import viLocale from './locales/vi.json';
import npcsJson from './npcs.json';

const LOCALES = { vi: viLocale, en: enLocale };
const PRIMARY_LOCALE = 'vi';
const FALLBACK_LOCALE = 'en';

const validated = validateContent({
  npcs: npcsJson,
  dialogues: dialoguesJson,
  locales: LOCALES,
  primaryLocale: PRIMARY_LOCALE,
});

/** Validated game content. Invalid entries were dropped, and `CONTENT_ISSUES` says why. */
export const GAME_CONTENT: GameContent = validated.content;

/** Problems found while loading content. The game still starts, so log them and fix the JSON. */
export const CONTENT_ISSUES: readonly ContentIssue[] = validated.issues;

const translator = createTranslator(LOCALES, PRIMARY_LOCALE, FALLBACK_LOCALE);

/** Translates a locale key for display. Only the UI layer should call this. */
export function t(key: string, params?: Readonly<Record<string, string>>): string {
  return translator.t(key, params);
}

export function findNpc(npcId: string): NpcDefinition | undefined {
  return GAME_CONTENT.npcs.find((npc) => npc.id === npcId);
}

/** Display name for a speaker. Falls back to the raw ID when the NPC is unknown. */
export function speakerName(npcId: string): string {
  const npc = findNpc(npcId);
  return npc ? t(npc.nameKey) : npcId;
}
