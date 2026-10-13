import { EventBus } from '../../shared/events/EventBus';
import type { DialogueDefinition, DialogueFile, DialogueNode, FlagEffect } from '../content/types';
import type { FlagStore } from '../flags/FlagStore';

export type DialogueErrorReason =
  | 'already_open'
  | 'unknown_dialogue'
  | 'no_matching_entry'
  | 'unknown_node';

export type DialogueCloseReason = 'finished' | 'dismissed' | 'error';

export interface DialogueChoiceView {
  /** Index into the node's full `choices` array. Pass this to `choose()`. */
  readonly index: number;
  readonly textKey: string;
}

/** Everything the UI needs to show the current line. Holds keys only, never translated text. */
export interface DialogueView {
  readonly dialogueId: string;
  readonly nodeId: string;
  readonly speakerId: string;
  readonly textKey: string;
  /** Choices visible right now. Empty when the player can just continue. */
  readonly choices: readonly DialogueChoiceView[];
  /** True when there are no visible choices, so `advance()` moves on. */
  readonly canContinue: boolean;
}

export type DialogueEvent =
  | { readonly type: 'dialogue.opened'; readonly view: DialogueView }
  | { readonly type: 'dialogue.changed'; readonly view: DialogueView }
  | { readonly type: 'dialogue.closed'; readonly dialogueId: string; readonly reason: DialogueCloseReason }
  | {
      readonly type: 'dialogue.error';
      readonly dialogueId: string;
      readonly reason: DialogueErrorReason;
      readonly nodeId?: string;
    };

export type StartResult = { readonly ok: true } | { readonly ok: false; readonly reason: DialogueErrorReason };

/**
 * Runs branching dialogue from validated content. It owns no rendering: the UI reads `view`, calls
 * `advance`, `choose`, or `close`, and listens to `events`. Every bad state (unknown ID, missing node,
 * no matching entry) produces a `dialogue.error` event and a clean close, never an exception.
 */
export class DialogueSystem {
  readonly events = new EventBus<DialogueEvent>();
  private readonly dialogues: ReadonlyMap<string, DialogueDefinition>;
  private readonly flags: FlagStore;
  private activeId: string | null = null;
  private nodeId: string | null = null;

  constructor(dialogues: DialogueFile, flags: FlagStore) {
    this.dialogues = new Map(Object.entries(dialogues));
    this.flags = flags;
  }

  get isOpen(): boolean {
    return this.activeId !== null;
  }

  /** The line on screen, or `null` when no dialogue is open. */
  get view(): DialogueView | null {
    if (this.activeId === null || this.nodeId === null) {
      return null;
    }
    const node = this.currentNode();
    if (!node) {
      return null;
    }
    const choices = this.visibleChoices(node);
    return {
      dialogueId: this.activeId,
      nodeId: this.nodeId,
      speakerId: node.speaker,
      textKey: node.textKey,
      choices,
      canContinue: choices.length === 0,
    };
  }

  /** Opens a dialogue at the first entry whose conditions hold. */
  start(dialogueId: string): StartResult {
    if (this.isOpen) {
      return this.fail('already_open', dialogueId);
    }
    const definition = this.dialogues.get(dialogueId);
    if (!definition) {
      return this.fail('unknown_dialogue', dialogueId);
    }
    const entry = definition.entries.find((candidate) => this.flags.matches(candidate.when));
    if (!entry) {
      return this.fail('no_matching_entry', dialogueId);
    }
    if (!definition.nodes[entry.node]) {
      return this.fail('unknown_node', dialogueId, entry.node);
    }

    this.activeId = dialogueId;
    this.enter(entry.node);
    const view = this.view;
    if (view) {
      this.events.emit({ type: 'dialogue.opened', view });
    }
    return { ok: true };
  }

  /**
   * Moves past a line that has no visible choices. Does nothing while choices are visible, because the
   * player has to pick one. Ends the dialogue when the node's `next` is `null`.
   */
  advance(): void {
    const view = this.view;
    if (!view || !view.canContinue) {
      return;
    }
    const node = this.currentNode();
    this.moveTo(node?.next ?? null);
  }

  /** Takes a visible choice by its index in the node's `choices` array. Returns false if it is not offered. */
  choose(index: number): boolean {
    const node = this.currentNode();
    if (!node || !this.isOpen) {
      return false;
    }
    const choice = node.choices[index];
    if (!choice || !this.flags.matches(choice.when)) {
      return false;
    }
    this.applyEffects(choice.effects);
    this.moveTo(choice.next);
    return true;
  }

  /** Closes the dialogue without finishing it, for example on Escape or the close button. */
  close(reason: DialogueCloseReason = 'dismissed'): void {
    if (this.activeId === null) {
      return;
    }
    const dialogueId = this.activeId;
    this.activeId = null;
    this.nodeId = null;
    this.events.emit({ type: 'dialogue.closed', dialogueId, reason });
  }

  private moveTo(nextId: string | null): void {
    if (nextId === null) {
      this.close('finished');
      return;
    }
    const dialogueId = this.activeId;
    if (!this.hasNode(nextId)) {
      this.fail('unknown_node', dialogueId ?? '', nextId);
      this.close('error');
      return;
    }
    this.enter(nextId);
    const view = this.view;
    if (view) {
      this.events.emit({ type: 'dialogue.changed', view });
    }
  }

  /** Moves to a node and applies its effects. The caller has checked that the node exists. */
  private enter(nodeId: string): void {
    this.nodeId = nodeId;
    const node = this.currentNode();
    if (node) {
      this.applyEffects(node.effects);
    }
  }

  private applyEffects(effects: readonly FlagEffect[]): void {
    for (const effect of effects) {
      this.flags.set(effect.setFlag, effect.value);
    }
  }

  private visibleChoices(node: DialogueNode): DialogueChoiceView[] {
    return node.choices
      .map((choice, index) => ({ choice, index }))
      .filter(({ choice }) => this.flags.matches(choice.when))
      .map(({ choice, index }) => ({ index, textKey: choice.textKey }));
  }

  private currentDefinition(): DialogueDefinition | undefined {
    return this.activeId === null ? undefined : this.dialogues.get(this.activeId);
  }

  private currentNode(): DialogueNode | undefined {
    if (this.nodeId === null) {
      return undefined;
    }
    return this.currentDefinition()?.nodes[this.nodeId];
  }

  private hasNode(nodeId: string): boolean {
    return this.currentDefinition()?.nodes[nodeId] !== undefined;
  }

  private fail(reason: DialogueErrorReason, dialogueId: string, nodeId?: string): StartResult {
    this.events.emit({ type: 'dialogue.error', dialogueId, reason, nodeId });
    return { ok: false, reason };
  }
}
