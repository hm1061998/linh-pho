import { afterEach, describe, expect, it, vi } from 'vitest';
import { DialogueSystem, type DialogueEvent } from '../domain/dialogue/DialogueSystem';
import type { DialogueFile } from '../domain/content/types';
import { FlagStore } from '../domain/flags/FlagStore';

/** Small fixture covering entries, conditions, choices, effects, and loops. */
const FIXTURE: DialogueFile = {
  dlg_test: {
    entries: [
      { when: [{ flag: 'met', equals: true }], node: 'return' },
      { when: [], node: 'greet' },
    ],
    nodes: {
      greet: {
        speaker: 'npc_a',
        textKey: 'k.greet',
        effects: [{ setFlag: 'met', value: true }],
        choices: [],
        next: 'ask',
      },
      ask: {
        speaker: 'npc_a',
        textKey: 'k.ask',
        effects: [],
        choices: [
          {
            textKey: 'k.choice.first_time',
            when: [{ flag: 'asked', equals: false }],
            effects: [{ setFlag: 'asked', value: true }],
            next: 'answer',
          },
          { textKey: 'k.choice.bye', when: [], effects: [], next: null },
        ],
        next: null,
      },
      answer: { speaker: 'npc_a', textKey: 'k.answer', effects: [], choices: [], next: 'ask' },
      return: { speaker: 'npc_a', textKey: 'k.return', effects: [], choices: [], next: null },
      // A node with choices that are all hidden must fall through to `next`, not dead-end.
      hidden_only: {
        speaker: 'npc_a',
        textKey: 'k.hidden',
        effects: [],
        choices: [{ textKey: 'k.never', when: [{ flag: 'never', equals: true }], effects: [], next: null }],
        next: null,
      },
    },
  },
  dlg_fallthrough: {
    entries: [{ when: [], node: 'hidden_only' }],
    nodes: {
      hidden_only: {
        speaker: 'npc_a',
        textKey: 'k.hidden',
        effects: [],
        choices: [{ textKey: 'k.never', when: [{ flag: 'never', equals: true }], effects: [], next: null }],
        next: null,
      },
    },
  },
  dlg_no_entry: {
    entries: [{ when: [{ flag: 'locked', equals: true }], node: 'greet' }],
    nodes: {
      greet: { speaker: 'npc_a', textKey: 'k.greet', effects: [], choices: [], next: null },
    },
  },
};

function setup(): { system: DialogueSystem; flags: FlagStore; events: DialogueEvent[] } {
  const flags = new FlagStore();
  const system = new DialogueSystem(FIXTURE, flags);
  const events: DialogueEvent[] = [];
  for (const type of ['dialogue.opened', 'dialogue.changed', 'dialogue.closed', 'dialogue.error'] as const) {
    system.events.on(type, (event) => events.push(event));
  }
  return { system, flags, events };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DialogueSystem start', () => {
  it('opens the first entry whose conditions hold and applies the node effects', () => {
    const { system, flags, events } = setup();

    expect(system.start('dlg_test')).toEqual({ ok: true });

    expect(system.view).toMatchObject({ dialogueId: 'dlg_test', nodeId: 'greet', speakerId: 'npc_a' });
    expect(flags.get('met')).toBe(true);
    expect(events[0]).toMatchObject({ type: 'dialogue.opened' });
  });

  it('picks the conditional entry on a later visit', () => {
    const { system, flags } = setup();
    flags.set('met', true);

    system.start('dlg_test');

    expect(system.view?.nodeId).toBe('return');
  });

  it('rejects an unknown dialogue ID with an error and no crash', () => {
    const { system, events } = setup();

    expect(system.start('dlg_missing')).toEqual({ ok: false, reason: 'unknown_dialogue' });
    expect(system.isOpen).toBe(false);
    expect(events).toEqual([
      { type: 'dialogue.error', dialogueId: 'dlg_missing', reason: 'unknown_dialogue', nodeId: undefined },
    ]);
  });

  it('reports no matching entry when no condition holds', () => {
    const { system } = setup();
    expect(system.start('dlg_no_entry')).toEqual({ ok: false, reason: 'no_matching_entry' });
  });

  it('refuses a second dialogue while one is open', () => {
    const { system } = setup();
    system.start('dlg_test');
    expect(system.start('dlg_test')).toEqual({ ok: false, reason: 'already_open' });
  });

  it('treats inherited names such as "constructor" as unknown dialogues', () => {
    const { system } = setup();
    expect(system.start('constructor')).toEqual({ ok: false, reason: 'unknown_dialogue' });
  });
});

describe('DialogueSystem flow', () => {
  it('advances a line with no choices and ends at next: null', () => {
    const { system, events } = setup();
    system.start('dlg_test');

    system.advance();
    expect(system.view?.nodeId).toBe('ask');

    system.choose(1); // "bye" ends the dialogue
    expect(system.isOpen).toBe(false);
    expect(events.at(-1)).toEqual({ type: 'dialogue.closed', dialogueId: 'dlg_test', reason: 'finished' });
  });

  it('does not advance past a line that still has visible choices', () => {
    const { system } = setup();
    system.start('dlg_test');
    system.advance();

    system.advance();

    expect(system.view?.nodeId).toBe('ask');
    expect(system.view?.canContinue).toBe(false);
  });

  it('hides a choice whose condition fails and keeps the original index', () => {
    const { system, flags } = setup();
    flags.set('asked', true);
    system.start('dlg_test');
    system.advance();

    expect(system.view?.choices).toEqual([{ index: 1, textKey: 'k.choice.bye' }]);
  });

  it('refuses a choice that is not visible', () => {
    const { system, flags } = setup();
    flags.set('asked', true);
    system.start('dlg_test');
    system.advance();

    expect(system.choose(0)).toBe(false);
    expect(system.view?.nodeId).toBe('ask');
  });

  it('applies choice effects and moves to the chosen node', () => {
    const { system, flags } = setup();
    system.start('dlg_test');
    system.advance();

    expect(system.choose(0)).toBe(true);

    expect(flags.get('asked')).toBe(true);
    expect(system.view?.nodeId).toBe('answer');
  });

  it('returns false for an out-of-range or negative choice index', () => {
    const { system } = setup();
    system.start('dlg_test');
    system.advance();

    expect(system.choose(99)).toBe(false);
    expect(system.choose(-1)).toBe(false);
  });

  it('falls through to next when every choice is hidden, so the dialogue cannot dead-end', () => {
    const { system } = setup();
    system.start('dlg_fallthrough');

    expect(system.view?.canContinue).toBe(true);
    system.advance();
    expect(system.isOpen).toBe(false);
  });

  it('closes with reason "dismissed" when the player leaves early', () => {
    const { system, events } = setup();
    system.start('dlg_test');

    system.close();

    expect(system.isOpen).toBe(false);
    expect(events.at(-1)).toEqual({ type: 'dialogue.closed', dialogueId: 'dlg_test', reason: 'dismissed' });
  });

  it('ignores advance, choose, and close when nothing is open', () => {
    const { system, events } = setup();

    system.advance();
    expect(system.choose(0)).toBe(false);
    system.close();

    expect(events).toEqual([]);
  });
});

describe('DialogueSystem broken content', () => {
  it('closes safely with an error when a transition points at a missing node', () => {
    const broken: DialogueFile = {
      dlg_broken: {
        entries: [{ when: [], node: 'start' }],
        nodes: {
          start: { speaker: 'npc_a', textKey: 'k', effects: [], choices: [], next: 'gone' },
        },
      },
    };
    const system = new DialogueSystem(broken, new FlagStore());
    const events: DialogueEvent[] = [];
    system.events.on('dialogue.error', (event) => events.push(event));
    system.events.on('dialogue.closed', (event) => events.push(event));
    system.start('dlg_broken');

    system.advance();

    expect(system.isOpen).toBe(false);
    expect(events).toEqual([
      { type: 'dialogue.error', dialogueId: 'dlg_broken', reason: 'unknown_node', nodeId: 'gone' },
      { type: 'dialogue.closed', dialogueId: 'dlg_broken', reason: 'error' },
    ]);
  });
});

describe('FlagStore', () => {
  it('treats a flag that was never set as false', () => {
    const flags = new FlagStore();
    expect(flags.get('anything')).toBe(false);
    expect(flags.matches([{ flag: 'anything', equals: false }])).toBe(true);
    expect(flags.matches([{ flag: 'anything', equals: true }])).toBe(false);
  });

  it('returns a snapshot copy that does not change the store', () => {
    const flags = new FlagStore();
    flags.set('met', true);
    const snapshot = flags.snapshot();
    snapshot.met = false;
    expect(flags.get('met')).toBe(true);
  });
});
