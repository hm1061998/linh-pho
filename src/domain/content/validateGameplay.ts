import type { ContentIssue } from './types';
import type {
  GlyphDef,
  ItemAmount,
  ItemDef,
  MiniGameKind,
  ObjectiveDef,
  ObjectiveType,
  PickupDef,
  PlacementDef,
  PuzzleDef,
  PuzzleHint,
  QuestDef,
  Quality,
  RecipeDef,
  StationDef,
  GameplayContent,
} from './gameplayTypes';

/**
 * Validates items, recipes, quests, and world interactables. Like the NPC and dialogue validation, bad
 * entries are dropped and reported, and the rest still loads. Cross-references are checked too, so a
 * quest that points at a missing item or recipe is dropped instead of breaking at runtime.
 */

export interface GameplayRaw {
  readonly items: unknown;
  readonly recipes: unknown;
  readonly quests: unknown;
  readonly world: unknown;
  readonly puzzles: unknown;
}

export interface GameplayContext {
  readonly npcIds: ReadonlySet<string>;
  readonly hasTextKey: (key: string) => boolean;
  /**
   * Whether a quest objective's target exists. Only the objective types that have content in the
   * current build are accepted, so an objective type that is not implemented yet is reported.
   */
  readonly targetExists: (type: ObjectiveType, targetId: string) => boolean;
}

export interface ValidatedGameplay {
  readonly content: GameplayContent;
  readonly issues: ContentIssue[];
}

const OBJECTIVE_TYPES: readonly ObjectiveType[] = [
  'talk',
  'collect',
  'craft',
  'place',
  'scan',
  'puzzle',
  'accept',
  'deliver',
  'buy',
];
const MINI_GAMES: readonly MiniGameKind[] = ['confirm', 'assembly', 'engraving'];
const QUALITIES: readonly Quality[] = ['normal', 'good', 'perfect'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function error(source: string, message: string): ContentIssue {
  return { level: 'error', source, message };
}

function readList(root: unknown, key: string, issues: ContentIssue[]): unknown[] {
  if (!isRecord(root) || !Array.isArray(root[key])) {
    issues.push(error(key, `expected { "${key}": [ ... ] }`));
    return [];
  }
  return root[key] as unknown[];
}

/** Parses each entry, drops ones that fail, and drops later duplicates of an ID. */
function parseAll<T extends { readonly id: string }>(
  list: readonly unknown[],
  label: string,
  parse: (raw: unknown, source: string, issues: ContentIssue[]) => T | null,
  issues: ContentIssue[],
): T[] {
  const result: T[] = [];
  const seen = new Set<string>();
  list.forEach((raw, index) => {
    const local: ContentIssue[] = [];
    const parsed = parse(raw, `${label}[${index}]`, local);
    issues.push(...local);
    if (!parsed) {
      return;
    }
    if (seen.has(parsed.id)) {
      issues.push(error(`${label}.${parsed.id}`, 'duplicate id; the later entry is ignored'));
      return;
    }
    seen.add(parsed.id);
    result.push(parsed);
  });
  return result;
}

// ---------- items ----------

function parseItem(raw: unknown, source: string, issues: ContentIssue[], ctx: GameplayContext): ItemDef | null {
  if (!isRecord(raw) || !isNonEmptyString(raw.id)) {
    issues.push(error(source, 'expected an object with a non-empty "id"'));
    return null;
  }
  const where = `items.${raw.id}`;
  const before = issues.length;
  if (!isNonEmptyString(raw.nameKey) || !ctx.hasTextKey(raw.nameKey)) {
    issues.push(error(where, `nameKey "${String(raw.nameKey)}" is missing from the primary locale`));
  }
  if (!isPositiveInteger(raw.stackLimit)) {
    issues.push(error(where, '"stackLimit" must be a whole number >= 1'));
  }
  if (typeof raw.qualifiable !== 'boolean') {
    issues.push(error(where, '"qualifiable" must be true or false'));
  }
  if (issues.length > before) {
    return null;
  }
  return {
    id: raw.id,
    nameKey: raw.nameKey as string,
    stackLimit: raw.stackLimit as number,
    qualifiable: raw.qualifiable as boolean,
  };
}

// ---------- recipes ----------

function parseAmount(
  raw: unknown,
  source: string,
  items: ReadonlyMap<string, ItemDef>,
  issues: ContentIssue[],
): ItemAmount | null {
  if (!isRecord(raw) || !isNonEmptyString(raw.itemId) || !isPositiveInteger(raw.count)) {
    issues.push(error(source, 'expected { "itemId": string, "count": whole number >= 1, "quality"?: ... }'));
    return null;
  }
  const item = items.get(raw.itemId);
  if (!item) {
    issues.push(error(source, `itemId "${raw.itemId}" does not exist`));
    return null;
  }
  if (raw.quality !== undefined) {
    if (!item.qualifiable || typeof raw.quality !== 'string' || !QUALITIES.includes(raw.quality as Quality)) {
      issues.push(error(source, '"quality" is only allowed on qualifiable items, and must be normal, good, or perfect'));
      return null;
    }
    return { itemId: raw.itemId, count: raw.count, quality: raw.quality as Quality };
  }
  return { itemId: raw.itemId, count: raw.count };
}

function parseRecipe(
  raw: unknown,
  source: string,
  items: ReadonlyMap<string, ItemDef>,
  stations: ReadonlySet<string>,
  ctx: GameplayContext,
  issues: ContentIssue[],
): RecipeDef | null {
  if (!isRecord(raw) || !isNonEmptyString(raw.id)) {
    issues.push(error(source, 'expected an object with a non-empty "id"'));
    return null;
  }
  const where = `recipes.${raw.id}`;
  const before = issues.length;
  if (!isNonEmptyString(raw.nameKey) || !ctx.hasTextKey(raw.nameKey)) {
    issues.push(error(where, `nameKey "${String(raw.nameKey)}" is missing from the primary locale`));
  }
  const inputs: ItemAmount[] = [];
  if (!Array.isArray(raw.inputs) || raw.inputs.length === 0) {
    issues.push(error(where, '"inputs" must be a non-empty array'));
  } else {
    for (const [index, input] of raw.inputs.entries()) {
      const amount = parseAmount(input, `${where}.inputs[${index}]`, items, issues);
      if (amount) {
        inputs.push(amount);
      }
    }
  }
  const output = parseAmount(raw.output, `${where}.output`, items, issues);
  if (!isNonEmptyString(raw.stationId) || !stations.has(raw.stationId)) {
    issues.push(error(where, `stationId "${String(raw.stationId)}" does not exist`));
  }
  if (typeof raw.miniGame !== 'string' || !MINI_GAMES.includes(raw.miniGame as MiniGameKind)) {
    issues.push(error(where, '"miniGame" must be confirm, assembly, or engraving'));
  }
  const unlockFlag = raw.unlockFlag ?? null;
  if (unlockFlag !== null && !isNonEmptyString(unlockFlag)) {
    issues.push(error(where, '"unlockFlag" must be a flag name or null'));
  }
  if (issues.length > before || !output) {
    return null;
  }
  return {
    id: raw.id,
    nameKey: raw.nameKey as string,
    inputs,
    output,
    stationId: raw.stationId as string,
    miniGame: raw.miniGame as MiniGameKind,
    unlockFlag: unlockFlag as string | null,
  };
}

// ---------- quests ----------

function parseObjective(
  raw: unknown,
  source: string,
  ctx: GameplayContext,
  items: ReadonlyMap<string, ItemDef>,
  recipeIds: ReadonlySet<string>,
  issues: ContentIssue[],
): ObjectiveDef | null {
  if (!isRecord(raw) || !isNonEmptyString(raw.id)) {
    issues.push(error(source, 'expected an object with a non-empty "id"'));
    return null;
  }
  const before = issues.length;
  const type = raw.type;
  if (typeof type !== 'string' || !OBJECTIVE_TYPES.includes(type as ObjectiveType)) {
    issues.push(error(`${source} (${raw.id})`, `unknown objective type "${String(type)}"`));
    return null;
  }
  if (!isNonEmptyString(raw.targetId)) {
    issues.push(error(`${source} (${raw.id})`, '"targetId" must be a non-empty string'));
  } else if (type === 'collect') {
    if (!items.has(raw.targetId)) {
      issues.push(error(`${source} (${raw.id})`, `collect target "${raw.targetId}" is not an item`));
    }
  } else if (type === 'craft') {
    if (!recipeIds.has(raw.targetId)) {
      issues.push(error(`${source} (${raw.id})`, `craft target "${raw.targetId}" is not a recipe`));
    }
  } else if (!ctx.targetExists(type as ObjectiveType, raw.targetId)) {
    issues.push(error(`${source} (${raw.id})`, `${type} target "${raw.targetId}" does not exist`));
  }
  if (!isPositiveInteger(raw.count)) {
    issues.push(error(`${source} (${raw.id})`, '"count" must be a whole number >= 1'));
  }
  if (!isNonEmptyString(raw.textKey) || !ctx.hasTextKey(raw.textKey)) {
    issues.push(error(`${source} (${raw.id})`, `textKey "${String(raw.textKey)}" is missing from the primary locale`));
  }
  if (issues.length > before) {
    return null;
  }
  return {
    id: raw.id,
    type: type as ObjectiveType,
    targetId: raw.targetId as string,
    count: raw.count as number,
    textKey: raw.textKey as string,
  };
}

function parseQuest(
  raw: unknown,
  source: string,
  ctx: GameplayContext,
  items: ReadonlyMap<string, ItemDef>,
  recipeIds: ReadonlySet<string>,
  issues: ContentIssue[],
): QuestDef | null {
  if (!isRecord(raw) || !isNonEmptyString(raw.id)) {
    issues.push(error(source, 'expected an object with a non-empty "id"'));
    return null;
  }
  const where = `quests.${raw.id}`;
  const before = issues.length;
  if (!isNonEmptyString(raw.titleKey) || !ctx.hasTextKey(raw.titleKey)) {
    issues.push(error(where, `titleKey "${String(raw.titleKey)}" is missing from the primary locale`));
  }
  if (typeof raw.autoStart !== 'boolean') {
    issues.push(error(where, '"autoStart" must be true or false'));
  }
  const prerequisites = Array.isArray(raw.prerequisites) ? raw.prerequisites : null;
  if (!prerequisites || !prerequisites.every(isNonEmptyString)) {
    issues.push(error(where, '"prerequisites" must be an array of quest ids'));
  }
  const objectives: ObjectiveDef[] = [];
  if (!Array.isArray(raw.objectives) || raw.objectives.length === 0) {
    issues.push(error(where, '"objectives" must be a non-empty array'));
  } else {
    const seen = new Set<string>();
    for (const [index, item] of raw.objectives.entries()) {
      const objective = parseObjective(item, `${where}.objectives[${index}]`, ctx, items, recipeIds, issues);
      if (!objective) {
        continue;
      }
      if (seen.has(objective.id)) {
        issues.push(error(where, `objective id "${objective.id}" appears twice`));
        continue;
      }
      seen.add(objective.id);
      objectives.push(objective);
    }
  }
  const rewards = isRecord(raw.rewards) ? raw.rewards : {};
  if (!isNonNegativeInteger(rewards.coins) || !isNonNegativeInteger(rewards.reputation)) {
    issues.push(error(where, '"rewards" needs whole numbers "coins" and "reputation" >= 0'));
  }
  const unlocks = isRecord(raw.unlocks) ? raw.unlocks : {};
  const flags = Array.isArray(unlocks.flags) ? unlocks.flags : [];
  if (!flags.every(isNonEmptyString)) {
    issues.push(error(where, '"unlocks.flags" must be an array of flag names'));
  }
  const shopLevel = unlocks.shopLevel ?? null;
  if (shopLevel !== null && !isNonNegativeInteger(shopLevel)) {
    issues.push(error(where, '"unlocks.shopLevel" must be a whole number or null'));
  }
  if (issues.length > before) {
    return null;
  }
  return {
    id: raw.id,
    titleKey: raw.titleKey as string,
    autoStart: raw.autoStart as boolean,
    prerequisites: (prerequisites ?? []) as string[],
    objectives,
    rewards: { coins: rewards.coins as number, reputation: rewards.reputation as number },
    unlocks: { flags: flags as string[], shopLevel: shopLevel as number | null },
  };
}

// ---------- world ----------

function parsePosition(raw: unknown): { x: number; z: number } | null {
  if (!isRecord(raw) || !isFiniteNumber(raw.x) || !isFiniteNumber(raw.z)) {
    return null;
  }
  return { x: raw.x, z: raw.z };
}

function parsePickup(raw: unknown, source: string, items: ReadonlyMap<string, ItemDef>, issues: ContentIssue[]): PickupDef | null {
  if (!isRecord(raw) || !isNonEmptyString(raw.id)) {
    issues.push(error(source, 'expected an object with a non-empty "id"'));
    return null;
  }
  const position = parsePosition(raw.position);
  if (!isNonEmptyString(raw.itemId) || !items.has(raw.itemId)) {
    issues.push(error(`pickups.${raw.id}`, `itemId "${String(raw.itemId)}" does not exist`));
    return null;
  }
  if (!position) {
    issues.push(error(`pickups.${raw.id}`, 'position must be { "x": number, "z": number }'));
    return null;
  }
  return { id: raw.id, itemId: raw.itemId, position };
}

function parseStation(raw: unknown, source: string, ctx: GameplayContext, issues: ContentIssue[]): StationDef | null {
  if (!isRecord(raw) || !isNonEmptyString(raw.id)) {
    issues.push(error(source, 'expected an object with a non-empty "id"'));
    return null;
  }
  const where = `stations.${raw.id}`;
  const position = parsePosition(raw.position);
  const kindOk = raw.kind === 'workbench' || raw.kind === 'engraving';
  if (!kindOk) {
    issues.push(error(where, '"kind" must be workbench or engraving'));
  }
  if (!isNonEmptyString(raw.labelKey) || !ctx.hasTextKey(raw.labelKey)) {
    issues.push(error(where, `labelKey "${String(raw.labelKey)}" is missing from the primary locale`));
  }
  if (!position) {
    issues.push(error(where, 'position must be { "x": number, "z": number }'));
  }
  if (!kindOk || !position || !isNonEmptyString(raw.labelKey) || !ctx.hasTextKey(raw.labelKey)) {
    return null;
  }
  return { id: raw.id, kind: raw.kind as 'workbench' | 'engraving', labelKey: raw.labelKey, position };
}

function parsePlacement(
  raw: unknown,
  source: string,
  ctx: GameplayContext,
  items: ReadonlyMap<string, ItemDef>,
  issues: ContentIssue[],
): PlacementDef | null {
  if (!isRecord(raw) || !isNonEmptyString(raw.id)) {
    issues.push(error(source, 'expected an object with a non-empty "id"'));
    return null;
  }
  const where = `placements.${raw.id}`;
  const before = issues.length;
  const position = parsePosition(raw.position);
  if (!isNonEmptyString(raw.labelKey) || !ctx.hasTextKey(raw.labelKey)) {
    issues.push(error(where, `labelKey "${String(raw.labelKey)}" is missing from the primary locale`));
  }
  if (!position) {
    issues.push(error(where, 'position must be { "x": number, "z": number }'));
  }
  if (!isNonEmptyString(raw.acceptsItemId) || !items.has(raw.acceptsItemId)) {
    issues.push(error(where, `acceptsItemId "${String(raw.acceptsItemId)}" does not exist`));
  }
  if (issues.length > before || !position) {
    return null;
  }
  return { id: raw.id, labelKey: raw.labelKey as string, position, acceptsItemId: raw.acceptsItemId as string };
}

function parseGlyph(raw: unknown, source: string, ctx: GameplayContext, issues: ContentIssue[]): GlyphDef | null {
  if (!isRecord(raw) || !isNonEmptyString(raw.id)) {
    issues.push(error(source, 'expected an object with a non-empty "id"'));
    return null;
  }
  const where = `glyphs.${raw.id}`;
  const before = issues.length;
  const position = parsePosition(raw.position);
  if (!isNonEmptyString(raw.symbolKey) || !ctx.hasTextKey(raw.symbolKey)) {
    issues.push(error(where, `symbolKey "${String(raw.symbolKey)}" is missing from the primary locale`));
  }
  if (!isNonEmptyString(raw.labelKey) || !ctx.hasTextKey(raw.labelKey)) {
    issues.push(error(where, `labelKey "${String(raw.labelKey)}" is missing from the primary locale`));
  }
  if (!position) {
    issues.push(error(where, 'position must be { "x": number, "z": number }'));
  }
  if (issues.length > before || !position) {
    return null;
  }
  return {
    id: raw.id,
    symbolKey: raw.symbolKey as string,
    labelKey: raw.labelKey as string,
    position,
  };
}

function parsePuzzle(
  raw: unknown,
  source: string,
  stations: ReadonlyMap<string, StationDef>,
  glyphIds: ReadonlySet<string>,
  ctx: GameplayContext,
  issues: ContentIssue[],
): PuzzleDef | null {
  if (!isRecord(raw) || !isNonEmptyString(raw.id)) {
    issues.push(error(source, 'expected an object with a non-empty "id"'));
    return null;
  }
  const where = `puzzles.${raw.id}`;
  const before = issues.length;
  const station = isNonEmptyString(raw.stationId) ? stations.get(raw.stationId) : undefined;
  if (!station || station.kind !== 'engraving') {
    issues.push(error(where, '"stationId" must name an engraving station'));
  }
  const glyphs = Array.isArray(raw.glyphs) ? raw.glyphs : [];
  if (glyphs.length < 2 || !glyphs.every((id) => isNonEmptyString(id) && glyphIds.has(id))) {
    issues.push(error(where, '"glyphs" must list at least two existing glyph ids'));
  }
  const solution = Array.isArray(raw.solution) ? raw.solution : [];
  const isPermutation =
    solution.length === glyphs.length &&
    glyphs.every((id) => solution.includes(id)) &&
    new Set(solution).size === solution.length;
  if (!isPermutation) {
    issues.push(error(where, '"solution" must use each glyph in "glyphs" exactly once'));
  }
  if (!isNonEmptyString(raw.unlockFlag)) {
    issues.push(error(where, '"unlockFlag" must be a flag name'));
  }
  const hints: PuzzleHint[] = [];
  if (!Array.isArray(raw.hints)) {
    issues.push(error(where, '"hints" must be an array'));
  } else {
    for (const [index, hint] of raw.hints.entries()) {
      if (!isRecord(hint) || !isNonNegativeInteger(hint.afterAttempts) || !isNonEmptyString(hint.textKey) || !ctx.hasTextKey(hint.textKey)) {
        issues.push(error(`${where}.hints[${index}]`, 'expected { "afterAttempts": whole number >= 0, "textKey": known key }'));
        continue;
      }
      hints.push({ afterAttempts: hint.afterAttempts, textKey: hint.textKey });
    }
  }
  if (issues.length > before) {
    return null;
  }
  return {
    id: raw.id,
    stationId: raw.stationId as string,
    glyphs: glyphs as string[],
    solution: solution as string[],
    unlockFlag: raw.unlockFlag as string,
    hints,
  };
}

export function validateGameplay(raw: GameplayRaw, ctx: GameplayContext): ValidatedGameplay {
  const issues: ContentIssue[] = [];

  const items = parseAll(readList(raw.items, 'items', issues), 'items', (item, source, local) =>
    parseItem(item, source, local, ctx),
  issues);
  const itemMap = new Map(items.map((item) => [item.id, item]));

  const worldRaw = raw.world;
  const pickupsRaw = readList(worldRaw, 'pickups', issues);
  const stationsRaw = readList(worldRaw, 'stations', issues);
  const placementsRaw = readList(worldRaw, 'placements', issues);

  const stations = parseAll(stationsRaw, 'stations', (item, source, local) =>
    parseStation(item, source, ctx, local),
  issues);
  const stationIds = new Set(stations.map((station) => station.id));
  const pickups = parseAll(pickupsRaw, 'pickups', (item, source, local) =>
    parsePickup(item, source, itemMap, local),
  issues);
  const placements = parseAll(placementsRaw, 'placements', (item, source, local) =>
    parsePlacement(item, source, ctx, itemMap, local),
  issues);
  const glyphs = parseAll(readList(worldRaw, 'glyphs', issues), 'glyphs', (item, source, local) =>
    parseGlyph(item, source, ctx, local),
  issues);
  const glyphIds = new Set(glyphs.map((glyph) => glyph.id));
  const stationMap = new Map(stations.map((station) => [station.id, station]));
  const puzzles = parseAll(readList(raw.puzzles, 'puzzles', issues), 'puzzles', (item, source, local) =>
    parsePuzzle(item, source, stationMap, glyphIds, ctx, local),
  issues);

  // Interactable IDs share one namespace, so a pickup cannot have the same ID as a station.
  const interactableIds = new Set<string>();
  for (const id of [...pickups, ...stations, ...placements, ...glyphs].map((entry) => entry.id)) {
    if (interactableIds.has(id)) {
      issues.push(error(`world.${id}`, 'interactable id is used more than once'));
    }
    interactableIds.add(id);
  }

  const recipes = parseAll(readList(raw.recipes, 'recipes', issues), 'recipes', (item, source, local) =>
    parseRecipe(item, source, itemMap, stationIds, ctx, local),
  issues);
  const recipeIds = new Set(recipes.map((recipe) => recipe.id));

  const parsedQuests = parseAll(readList(raw.quests, 'quests', issues), 'quests', (item, source, local) =>
    parseQuest(item, source, ctx, itemMap, recipeIds, local),
  issues);
  const questIds = new Set(parsedQuests.map((quest) => quest.id));
  // A quest whose prerequisite does not exist would never start. Drop it and say why.
  const quests = parsedQuests.filter((quest) => {
    const missing = quest.prerequisites.filter((id) => !questIds.has(id));
    for (const id of missing) {
      issues.push(error(`quests.${quest.id}`, `prerequisite "${id}" does not exist; the quest is ignored`));
    }
    return missing.length === 0;
  });

  return {
    content: { items, recipes, quests, pickups, stations, placements, glyphs, puzzles },
    issues,
  };
}
