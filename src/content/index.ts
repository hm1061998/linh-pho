import { validateContent } from '../domain/content/validate';
import { validateGameplay } from '../domain/content/validateGameplay';
import type { ObjectiveType } from '../domain/content/gameplayTypes';
import type { ContentIssue, NpcDefinition } from '../domain/content/types';
import type { SessionContent } from '../domain/GameSession';
import { createTranslator } from '../shared/i18n/translator';
import dialoguesJson from './dialogues.json';
import enLocale from './locales/en.json';
import viLocale from './locales/vi.json';
import itemsJson from './items.json';
import npcsJson from './npcs.json';
import questsJson from './quests.json';
import recipesJson from './recipes.json';
import worldJson from './world.json';

const LOCALES = { vi: viLocale, en: enLocale };
const PRIMARY_LOCALE = 'vi';
const FALLBACK_LOCALE = 'en';
const hasTextKey = (key: string) => Object.hasOwn(viLocale, key);

const npcResult = validateContent({
  npcs: npcsJson,
  dialogues: dialoguesJson,
  locales: LOCALES,
  primaryLocale: PRIMARY_LOCALE,
});
const npcIds = new Set(npcResult.content.npcs.map((npc) => npc.id));
const placementIds = new Set(worldJson.placements.map((placement) => placement.id));

const gameplayResult = validateGameplay(
  { items: itemsJson, recipes: recipesJson, quests: questsJson, world: worldJson },
  {
    npcIds,
    hasTextKey,
    targetExists: (type: ObjectiveType, targetId: string) => {
      if (type === 'talk') {
        return npcIds.has(targetId);
      }
      if (type === 'place') {
        return placementIds.has(targetId);
      }
      // Other objective types get targets in later modules. Until then, quests that use them are reported.
      return false;
    },
  },
);

/** Everything the game needs, validated. Invalid entries were dropped, and `CONTENT_ISSUES` says why. */
export const GAME_CONTENT: SessionContent = {
  npcs: npcResult.content.npcs,
  dialogues: npcResult.content.dialogues,
  ...gameplayResult.content,
};

/** Problems found while loading content. The game still starts, so log them and fix the JSON. */
export const CONTENT_ISSUES: readonly ContentIssue[] = [...npcResult.issues, ...gameplayResult.issues];

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
