import { validateContent } from '../domain/content/validate';
import { validateGameplay } from '../domain/content/validateGameplay';
import { validateShop } from '../domain/content/validateShop';
import { validateStoryCards } from '../domain/content/validateStoryCards';
import type { ItemDef, ObjectiveType } from '../domain/content/gameplayTypes';
import type { ContentIssue, NpcDefinition } from '../domain/content/types';
import type { SessionContent } from '../domain/GameSession';
import type { Language } from '../domain/save/SaveDocument';
import { createTranslator } from '../shared/i18n/translator';
import dialoguesJson from './dialogues.json';
import enLocale from './locales/en.json';
import viLocale from './locales/vi.json';
import itemsJson from './items.json';
import npcsJson from './npcs.json';
import ordersJson from './orders.json';
import puzzlesJson from './puzzles.json';
import questsJson from './quests.json';
import recipesJson from './recipes.json';
import shopJson from './shop.json';
import storyCardsJson from './story_cards.json';
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
const glyphIds = new Set(worldJson.glyphs.map((glyph) => glyph.id));
const puzzleIds = new Set(puzzlesJson.puzzles.map((puzzle) => puzzle.id));

// Items first: the shop's orders refer to them. The shop's furniture and orders are then known to the quests.
const itemsById = new Map<string, ItemDef>();
for (const item of itemsJson.items) {
  itemsById.set(item.id, item as ItemDef);
}
const shopResult = validateShop({ shop: shopJson, orders: ordersJson }, { items: itemsById, hasTextKey });
const orderIds = new Set(shopResult.content.orders.map((order) => order.id));
const furnitureIds = new Set(shopResult.content.furniture.map((furniture) => furniture.id));

const gameplayResult = validateGameplay(
  { items: itemsJson, recipes: recipesJson, quests: questsJson, world: worldJson, puzzles: puzzlesJson },
  {
    npcIds,
    hasTextKey,
    targetExists: (type: ObjectiveType, targetId: string) => {
      switch (type) {
        case 'talk':
          return npcIds.has(targetId);
        case 'place':
          // A placement takes an item, and a shop socket takes furniture. Both are valid targets for place.
          return placementIds.has(targetId) || furnitureIds.has(targetId);
        case 'scan':
          return glyphIds.has(targetId);
        case 'puzzle':
          return puzzleIds.has(targetId);
        case 'accept':
        case 'deliver':
          return orderIds.has(targetId);
        case 'buy':
          return furnitureIds.has(targetId);
        default:
          return false;
      }
    },
  },
);

// Story cards need the locale keys, so they are checked last. Only the cards with `unlockedBy` are shown in the game.
const storyResult = validateStoryCards(storyCardsJson, hasTextKey);

/** Everything the game needs, validated. Invalid entries were dropped, and `CONTENT_ISSUES` says why. */
export const GAME_CONTENT: SessionContent = {
  npcs: npcResult.content.npcs,
  dialogues: npcResult.content.dialogues,
  ...gameplayResult.content,
  shop: shopResult.content,
  storyCards: storyResult.cards,
};

/** Problems found while loading content. The game still starts, so log them and fix the JSON. */
export const CONTENT_ISSUES: readonly ContentIssue[] = [
  ...npcResult.issues,
  ...gameplayResult.issues,
  ...shopResult.issues,
  ...storyResult.issues,
];

let activeLanguage: Language = PRIMARY_LOCALE;
let translator = createTranslator(LOCALES, activeLanguage, FALLBACK_LOCALE);
const languageListeners = new Set<() => void>();

/** Translates a locale key for display. Only the UI layer should call this. */
export function t(key: string, params?: Readonly<Record<string, string>>): string {
  return translator.t(key, params);
}

export function getLanguage(): Language {
  return activeLanguage;
}

/**
 * Switches the language. The other language stays as the fallback, so a key missing from one locale still shows.
 * Listeners run after the switch, so the HUD can re-render in the new language.
 */
export function setLanguage(language: Language): void {
  if (language === activeLanguage) {
    return;
  }
  activeLanguage = language;
  translator = createTranslator(LOCALES, language, language === 'vi' ? FALLBACK_LOCALE : PRIMARY_LOCALE);
  for (const listener of languageListeners) {
    listener();
  }
}

/** Subscribes to language changes. Returns the unsubscribe function. */
export function subscribeLanguage(listener: () => void): () => void {
  languageListeners.add(listener);
  return () => {
    languageListeners.delete(listener);
  };
}

export function findNpc(npcId: string): NpcDefinition | undefined {
  return GAME_CONTENT.npcs.find((npc) => npc.id === npcId);
}

/** Display name for a speaker. Falls back to the raw ID when the NPC is unknown. */
export function speakerName(npcId: string): string {
  const npc = findNpc(npcId);
  return npc ? t(npc.nameKey) : npcId;
}
