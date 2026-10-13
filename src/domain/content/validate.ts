import type {
  ContentIssue,
  DialogueChoice,
  DialogueDefinition,
  DialogueEntry,
  DialogueFile,
  DialogueNode,
  FlagCondition,
  FlagEffect,
  GameContent,
  NpcDefinition,
  NpcKind,
} from './types';

/**
 * Checks raw JSON content before the game uses it. Bad content never crashes the game:
 * a broken NPC is dropped, a broken dialogue is dropped, and each problem is reported as an issue.
 * An NPC whose dialogue is missing is kept, and interacting with it fails safely at runtime.
 */

export interface RawContent {
  readonly npcs: unknown;
  readonly dialogues: unknown;
  readonly locales: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly primaryLocale: string;
}

export interface ValidatedContent {
  readonly content: GameContent;
  readonly issues: ContentIssue[];
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function error(source: string, message: string): ContentIssue {
  return { level: 'error', source, message };
}

function warning(source: string, message: string): ContentIssue {
  return { level: 'warning', source, message };
}

export function validateContent(raw: RawContent): ValidatedContent {
  const issues: ContentIssue[] = [];
  const primary = raw.locales[raw.primaryLocale] ?? {};
  const hasTextKey = (key: string) => Object.hasOwn(primary, key);

  const npcs = parseNpcs(raw.npcs, hasTextKey, issues);
  const dialogues = parseDialogues(
    raw.dialogues,
    { speakers: new Set(npcs.map((npc) => npc.id)), hasTextKey },
    issues,
  );

  for (const npc of npcs) {
    if (!Object.hasOwn(dialogues, npc.dialogueId)) {
      issues.push(
        error(
          `npcs.${npc.id}`,
          `dialogueId "${npc.dialogueId}" does not exist; talking to this NPC will fail safely`,
        ),
      );
    }
  }

  return { content: { npcs, dialogues }, issues };
}

// ---------- NPCs ----------

function parseNpcs(
  raw: unknown,
  hasTextKey: (key: string) => boolean,
  issues: ContentIssue[],
): NpcDefinition[] {
  if (!isRecord(raw) || !Array.isArray(raw.npcs)) {
    issues.push(error('npcs', 'expected { "npcs": [ ... ] }'));
    return [];
  }

  const npcs: NpcDefinition[] = [];
  const seen = new Set<string>();

  raw.npcs.forEach((item: unknown, index: number) => {
    const source = `npcs[${index}]`;
    if (!isRecord(item) || !isNonEmptyString(item.id)) {
      issues.push(error(source, 'expected an object with a non-empty "id"'));
      return;
    }
    const id = item.id;
    const where = `npcs.${id}`;
    if (seen.has(id)) {
      issues.push(error(where, 'duplicate id; the later entry is ignored'));
      return;
    }

    const problems: string[] = [];
    const kind = item.kind;
    if (kind !== 'human' && kind !== 'spirit') {
      problems.push('kind must be "human" or "spirit"');
    }
    if (!isNonEmptyString(item.nameKey)) {
      problems.push('nameKey must be a non-empty string');
    }
    if (!isNonEmptyString(item.dialogueId)) {
      problems.push('dialogueId must be a non-empty string');
    }
    const position = item.position;
    if (!isRecord(position) || !isFiniteNumber(position.x) || !isFiniteNumber(position.z)) {
      problems.push('position must be { "x": number, "z": number }');
    }
    const hoverHeight = item.hoverHeight ?? 0;
    if (!isFiniteNumber(hoverHeight) || hoverHeight < 0) {
      problems.push('hoverHeight must be a number >= 0');
    }
    if (typeof item.color !== 'string' || !HEX_COLOR.test(item.color)) {
      problems.push('color must look like #RRGGBB');
    }

    if (problems.length > 0) {
      for (const problem of problems) {
        issues.push(error(where, problem));
      }
      return;
    }

    // Every check above has passed, so the narrowed types are safe to assert here.
    const nameKey = item.nameKey as string;
    if (!hasTextKey(nameKey)) {
      issues.push(warning(where, `nameKey "${nameKey}" is missing from the primary locale`));
    }
    seen.add(id);
    npcs.push({
      id,
      kind: kind as NpcKind,
      nameKey,
      dialogueId: item.dialogueId as string,
      position: { x: (position as { x: number }).x, z: (position as { z: number }).z },
      hoverHeight: hoverHeight as number,
      color: item.color as string,
    });
  });

  return npcs;
}

// ---------- Dialogues ----------

interface DialogueContext {
  readonly speakers: ReadonlySet<string>;
  readonly hasTextKey: (key: string) => boolean;
}

function parseDialogues(raw: unknown, ctx: DialogueContext, issues: ContentIssue[]): DialogueFile {
  if (!isRecord(raw) || !isRecord(raw.dialogues)) {
    issues.push(error('dialogues', 'expected { "dialogues": { ... } }'));
    return {};
  }

  const result: Record<string, DialogueDefinition> = {};
  for (const [id, value] of Object.entries(raw.dialogues)) {
    const local: ContentIssue[] = [];
    const definition = parseDialogue(id, value, ctx, local);
    issues.push(...local);
    const hasError = local.some((issue) => issue.level === 'error');
    if (definition && !hasError) {
      result[id] = definition;
    }
  }
  return result;
}

function parseDialogue(
  id: string,
  raw: unknown,
  ctx: DialogueContext,
  issues: ContentIssue[],
): DialogueDefinition | null {
  const source = `dialogues.${id}`;
  if (!isRecord(raw)) {
    issues.push(error(source, 'expected an object with "entries" and "nodes"'));
    return null;
  }
  if (!Array.isArray(raw.entries) || raw.entries.length === 0) {
    issues.push(error(source, '"entries" must be a non-empty array'));
    return null;
  }
  if (!isRecord(raw.nodes)) {
    issues.push(error(source, '"nodes" must be an object'));
    return null;
  }

  const before = issues.length;
  const entries: DialogueEntry[] = [];
  raw.entries.forEach((entry: unknown, index: number) => {
    const entrySource = `${source}.entries[${index}]`;
    if (!isRecord(entry) || !isNonEmptyString(entry.node)) {
      issues.push(error(entrySource, 'expected { "node": string, "when"?: [...] }'));
      return;
    }
    const when = parseConditions(entry.when, `${entrySource}.when`, issues);
    if (when) {
      entries.push({ when, node: entry.node });
    }
  });

  const nodes: Record<string, DialogueNode> = {};
  for (const [nodeId, nodeRaw] of Object.entries(raw.nodes)) {
    const node = parseNode(`${source}.nodes.${nodeId}`, nodeRaw, ctx, issues);
    if (node) {
      nodes[nodeId] = node;
    }
  }

  // References must point at real nodes. Dangling references are errors, so the dialogue is dropped.
  for (const entry of entries) {
    if (!Object.hasOwn(nodes, entry.node)) {
      issues.push(error(source, `entry points at unknown node "${entry.node}"`));
    }
  }
  for (const [nodeId, node] of Object.entries(nodes)) {
    const nodeSource = `${source}.nodes.${nodeId}`;
    if (node.next !== null && !Object.hasOwn(nodes, node.next)) {
      issues.push(error(nodeSource, `next points at unknown node "${node.next}"`));
    }
    for (const choice of node.choices) {
      if (choice.next !== null && !Object.hasOwn(nodes, choice.next)) {
        issues.push(error(nodeSource, `choice points at unknown node "${choice.next}"`));
      }
    }
  }

  const hasFallback = entries.some((entry) => entry.when.length === 0);
  if (!hasFallback) {
    issues.push(
      warning(source, 'no entry without conditions; the dialogue will not start if no condition holds'),
    );
  }

  const hasError = issues.slice(before).some((issue) => issue.level === 'error');
  if (hasError) {
    return null;
  }
  return { entries, nodes };
}

function parseNode(
  source: string,
  raw: unknown,
  ctx: DialogueContext,
  issues: ContentIssue[],
): DialogueNode | null {
  if (!isRecord(raw)) {
    issues.push(error(source, 'expected an object'));
    return null;
  }
  const before = issues.length;

  if (!isNonEmptyString(raw.speaker) || !ctx.speakers.has(raw.speaker)) {
    issues.push(error(source, `speaker "${String(raw.speaker)}" is not a known NPC id`));
  }
  if (!isNonEmptyString(raw.textKey) || !ctx.hasTextKey(raw.textKey)) {
    issues.push(error(source, `textKey "${String(raw.textKey)}" is missing from the primary locale`));
  }
  const next = parseNext(raw.next, `${source}.next`, issues);
  const effects = parseEffects(raw.effects, `${source}.effects`, issues);

  const choices: DialogueChoice[] = [];
  if (raw.choices !== undefined) {
    if (!Array.isArray(raw.choices)) {
      issues.push(error(source, '"choices" must be an array'));
    } else {
      raw.choices.forEach((choiceRaw: unknown, index: number) => {
        const choice = parseChoice(`${source}.choices[${index}]`, choiceRaw, ctx, issues);
        if (choice) {
          choices.push(choice);
        }
      });
    }
  }

  if (issues.slice(before).some((issue) => issue.level === 'error')) {
    return null;
  }
  return {
    speaker: raw.speaker as string,
    textKey: raw.textKey as string,
    effects: effects ?? [],
    choices,
    next,
  };
}

function parseChoice(
  source: string,
  raw: unknown,
  ctx: DialogueContext,
  issues: ContentIssue[],
): DialogueChoice | null {
  if (!isRecord(raw)) {
    issues.push(error(source, 'expected an object'));
    return null;
  }
  const before = issues.length;
  if (!isNonEmptyString(raw.textKey) || !ctx.hasTextKey(raw.textKey)) {
    issues.push(error(source, `textKey "${String(raw.textKey)}" is missing from the primary locale`));
  }
  const when = parseConditions(raw.when, `${source}.when`, issues);
  const effects = parseEffects(raw.effects, `${source}.effects`, issues);
  const next = parseNext(raw.next, `${source}.next`, issues);

  if (issues.slice(before).some((issue) => issue.level === 'error')) {
    return null;
  }
  return {
    textKey: raw.textKey as string,
    when: when ?? [],
    effects: effects ?? [],
    next,
  };
}

/** A missing value means "end the dialogue" (null). Any other non-string value is an error. */
function parseNext(raw: unknown, source: string, issues: ContentIssue[]): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (!isNonEmptyString(raw)) {
    issues.push(error(source, '"next" must be a node id string, or null to end the dialogue'));
    return null;
  }
  return raw;
}

function parseConditions(raw: unknown, source: string, issues: ContentIssue[]): FlagCondition[] | null {
  if (raw === undefined) {
    return [];
  }
  if (!Array.isArray(raw)) {
    issues.push(error(source, '"when" must be an array of { "flag", "equals" }'));
    return null;
  }
  const conditions: FlagCondition[] = [];
  for (const [index, item] of raw.entries()) {
    if (!isRecord(item) || !isNonEmptyString(item.flag) || typeof item.equals !== 'boolean') {
      issues.push(error(`${source}[${index}]`, 'expected { "flag": string, "equals": boolean }'));
      return null;
    }
    conditions.push({ flag: item.flag, equals: item.equals });
  }
  return conditions;
}

function parseEffects(raw: unknown, source: string, issues: ContentIssue[]): FlagEffect[] | null {
  if (raw === undefined) {
    return [];
  }
  if (!Array.isArray(raw)) {
    issues.push(error(source, '"effects" must be an array of { "setFlag", "value" }'));
    return null;
  }
  const effects: FlagEffect[] = [];
  for (const [index, item] of raw.entries()) {
    if (!isRecord(item) || !isNonEmptyString(item.setFlag) || typeof item.value !== 'boolean') {
      issues.push(error(`${source}[${index}]`, 'expected { "setFlag": string, "value": boolean }'));
      return null;
    }
    effects.push({ setFlag: item.setFlag, value: item.value });
  }
  return effects;
}
