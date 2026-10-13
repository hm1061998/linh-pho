import { describe, expect, it } from 'vitest';
import { validateContent, type RawContent } from '../domain/content/validate';
import dialoguesJson from '../content/dialogues.json';
import enLocale from '../content/locales/en.json';
import viLocale from '../content/locales/vi.json';
import npcsJson from '../content/npcs.json';

const LOCALES = { vi: viLocale, en: enLocale };

function validate(overrides: Partial<RawContent> = {}) {
  return validateContent({
    npcs: npcsJson,
    dialogues: dialoguesJson,
    locales: LOCALES,
    primaryLocale: 'vi',
    ...overrides,
  });
}

/** A minimal valid file, used as a base for the broken cases below. */
const VALID_NPCS = {
  npcs: [
    {
      id: 'npc_a',
      kind: 'human',
      nameKey: 'npc.ba_nghiem.name',
      dialogueId: 'dlg_a',
      position: { x: 0, z: 0 },
      color: '#7A4E3A',
    },
  ],
};

const VALID_DIALOGUES = {
  dialogues: {
    dlg_a: {
      entries: [{ when: [], node: 'start' }],
      nodes: {
        start: {
          speaker: 'npc_a',
          textKey: 'dlg.ba_nghiem.greet',
          choices: [{ textKey: 'dlg.choice.bye', next: null }],
        },
      },
    },
  },
};

describe('shipped content', () => {
  const result = validate();

  it('loads with no errors or warnings', () => {
    expect(result.issues).toEqual([]);
  });

  it('contains the four Module 03 placeholder NPCs', () => {
    expect(result.content.npcs.map((npc) => npc.id).sort()).toEqual([
      'npc_ba_nghiem',
      'npc_bac',
      'npc_co_lam',
      'npc_ong_do',
    ]);
  });

  it('gives every NPC a dialogue that exists', () => {
    for (const npc of result.content.npcs) {
      expect(result.content.dialogues, npc.id).toHaveProperty([npc.dialogueId]);
    }
  });

  it('has an English translation for every Vietnamese key', () => {
    for (const key of Object.keys(viLocale)) {
      expect(Object.hasOwn(enLocale, key), key).toBe(true);
    }
  });
});

describe('content validation: broken input is dropped with a clear issue', () => {
  it('accepts a minimal valid file', () => {
    const result = validate({ npcs: VALID_NPCS, dialogues: VALID_DIALOGUES });
    expect(result.issues).toEqual([]);
    expect(result.content.npcs).toHaveLength(1);
    expect(result.content.dialogues).toHaveProperty(['dlg_a']);
  });

  it('drops an NPC with an unknown kind', () => {
    const npcs = { npcs: [{ ...VALID_NPCS.npcs[0], kind: 'dragon' }] };
    const result = validate({ npcs, dialogues: VALID_DIALOGUES });
    expect(result.content.npcs).toHaveLength(0);
    expect(result.issues.some((issue) => issue.level === 'error' && issue.message.includes('kind'))).toBe(true);
  });

  it('drops an NPC with a malformed color', () => {
    const npcs = { npcs: [{ ...VALID_NPCS.npcs[0], color: 'red' }] };
    const result = validate({ npcs, dialogues: VALID_DIALOGUES });
    expect(result.content.npcs).toHaveLength(0);
  });

  it('drops a duplicate NPC ID and keeps the first entry', () => {
    const npcs = { npcs: [VALID_NPCS.npcs[0], { ...VALID_NPCS.npcs[0], nameKey: 'npc.co_lam.name' }] };
    const result = validate({ npcs, dialogues: VALID_DIALOGUES });
    expect(result.content.npcs).toHaveLength(1);
    expect(result.content.npcs[0]?.nameKey).toBe('npc.ba_nghiem.name');
  });

  it('keeps an NPC whose dialogue is missing, and reports it as an error', () => {
    const npcs = { npcs: [{ ...VALID_NPCS.npcs[0], dialogueId: 'dlg_missing' }] };
    const result = validate({ npcs, dialogues: VALID_DIALOGUES });
    expect(result.content.npcs).toHaveLength(1);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: 'error', source: 'npcs.npc_a' }),
    );
  });

  it('drops a dialogue with a dangling next node', () => {
    const dialogues = {
      dialogues: {
        dlg_a: {
          entries: [{ when: [], node: 'start' }],
          nodes: {
            start: { speaker: 'npc_a', textKey: 'dlg.ba_nghiem.greet', next: 'gone' },
          },
        },
      },
    };
    const result = validate({ npcs: VALID_NPCS, dialogues });
    expect(result.content.dialogues).not.toHaveProperty(['dlg_a']);
    expect(result.issues.some((issue) => issue.message.includes('"gone"'))).toBe(true);
  });

  it('drops a dialogue whose speaker is not a known NPC', () => {
    const dialogues = {
      dialogues: {
        dlg_a: {
          entries: [{ when: [], node: 'start' }],
          nodes: { start: { speaker: 'npc_nobody', textKey: 'dlg.ba_nghiem.greet', next: null } },
        },
      },
    };
    const result = validate({ npcs: VALID_NPCS, dialogues });
    expect(result.content.dialogues).not.toHaveProperty(['dlg_a']);
  });

  it('drops a dialogue whose text key is missing from the primary locale', () => {
    const dialogues = {
      dialogues: {
        dlg_a: {
          entries: [{ when: [], node: 'start' }],
          nodes: { start: { speaker: 'npc_a', textKey: 'dlg.does_not_exist', next: null } },
        },
      },
    };
    const result = validate({ npcs: VALID_NPCS, dialogues });
    expect(result.content.dialogues).not.toHaveProperty(['dlg_a']);
    expect(result.issues.some((issue) => issue.message.includes('dlg.does_not_exist'))).toBe(true);
  });

  it('drops a dialogue with malformed flag conditions', () => {
    const dialogues = {
      dialogues: {
        dlg_a: {
          entries: [{ when: [{ flag: 'met', equals: 'yes' }], node: 'start' }],
          nodes: { start: { speaker: 'npc_a', textKey: 'dlg.ba_nghiem.greet', next: null } },
        },
      },
    };
    const result = validate({ npcs: VALID_NPCS, dialogues });
    expect(result.content.dialogues).not.toHaveProperty(['dlg_a']);
  });

  it('warns, but keeps the dialogue, when no entry is unconditional', () => {
    const dialogues = {
      dialogues: {
        dlg_a: {
          entries: [{ when: [{ flag: 'met', equals: true }], node: 'start' }],
          nodes: { start: { speaker: 'npc_a', textKey: 'dlg.ba_nghiem.greet', next: null } },
        },
      },
    };
    const result = validate({ npcs: VALID_NPCS, dialogues });
    expect(result.content.dialogues).toHaveProperty(['dlg_a']);
    expect(result.issues).toContainEqual(expect.objectContaining({ level: 'warning' }));
  });

  it('reports a file that is not in the expected shape, without throwing', () => {
    const result = validate({ npcs: 'not a list', dialogues: null });
    expect(result.content.npcs).toEqual([]);
    expect(result.content.dialogues).toEqual({});
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
