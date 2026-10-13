/**
 * Content schema for NPCs and dialogues. These types describe the JSON in `src/content/`.
 * Text is never stored here. Every text field is a locale key, so domain code stays language-neutral.
 */

export interface ContentIssue {
  readonly level: 'error' | 'warning';
  /** Where the problem is, for example `dialogues.dlg_ba_nghiem.nodes.greet`. */
  readonly source: string;
  readonly message: string;
}

/** Flag must equal `equals`. A flag that was never set counts as false. */
export interface FlagCondition {
  readonly flag: string;
  readonly equals: boolean;
}

/** Sets a flag when the node is shown or the choice is taken. */
export interface FlagEffect {
  readonly setFlag: string;
  readonly value: boolean;
}

export type NpcKind = 'human' | 'spirit';

export interface NpcDefinition {
  /** Stable ID, for example `npc_ba_nghiem`. Interaction targets and speakers use it. */
  readonly id: string;
  readonly kind: NpcKind;
  readonly nameKey: string;
  readonly dialogueId: string;
  readonly position: { readonly x: number; readonly z: number };
  /** Height above the walking surface, for floating NPCs such as spirits. */
  readonly hoverHeight: number;
  /** Placeholder body color as `#RRGGBB`. Replaced by GLB models in Module 09. */
  readonly color: string;
}

/**
 * The first entry whose `when` conditions all hold is used. An entry with no `when` always matches,
 * so put it last as a fallback.
 */
export interface DialogueEntry {
  readonly when: readonly FlagCondition[];
  readonly node: string;
}

export interface DialogueChoice {
  readonly textKey: string;
  /** The choice is only offered while these conditions hold. */
  readonly when: readonly FlagCondition[];
  readonly effects: readonly FlagEffect[];
  /** Next node, or `null` to end the dialogue. */
  readonly next: string | null;
}

export interface DialogueNode {
  readonly speaker: string;
  readonly textKey: string;
  readonly effects: readonly FlagEffect[];
  /** When present and at least one choice is visible, the player must pick one. */
  readonly choices: readonly DialogueChoice[];
  /** Used when there are no visible choices. `null` ends the dialogue. */
  readonly next: string | null;
}

export interface DialogueDefinition {
  readonly entries: readonly DialogueEntry[];
  readonly nodes: Readonly<Record<string, DialogueNode>>;
}

export type DialogueFile = Readonly<Record<string, DialogueDefinition>>;

export interface GameContent {
  readonly npcs: readonly NpcDefinition[];
  readonly dialogues: DialogueFile;
}
