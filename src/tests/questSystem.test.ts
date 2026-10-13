import { describe, expect, it } from 'vitest';
import type { QuestDef } from '../domain/content/gameplayTypes';
import { QuestSystem, type QuestSystemEvent } from '../domain/quests/QuestSystem';

const QUESTS: QuestDef[] = [
  {
    id: 'q_a',
    titleKey: 'k',
    autoStart: true,
    prerequisites: [],
    objectives: [
      { id: 'talk', type: 'talk', targetId: 'npc_x', count: 1, textKey: 'k' },
      { id: 'gather', type: 'collect', targetId: 'bamboo', count: 2, textKey: 'k' },
    ],
    rewards: { coins: 30, reputation: 1 },
    unlocks: { flags: ['q_a_done'], shopLevel: 1 },
  },
  {
    id: 'q_b',
    titleKey: 'k',
    autoStart: true,
    prerequisites: ['q_a'],
    objectives: [{ id: 'craft', type: 'craft', targetId: 'recipe_x', count: 1, textKey: 'k' }],
    rewards: { coins: 0, reputation: 0 },
    unlocks: { flags: [], shopLevel: null },
  },
  {
    id: 'q_manual',
    titleKey: 'k',
    autoStart: false,
    prerequisites: [],
    objectives: [{ id: 'buy', type: 'buy', targetId: 'furniture_x', count: 1, textKey: 'k' }],
    rewards: { coins: 5, reputation: 0 },
    unlocks: { flags: [], shopLevel: null },
  },
];

function collect(system: QuestSystem): QuestSystemEvent[] {
  const events: QuestSystemEvent[] = [];
  system.events.on('quest.started', (event) => events.push(event));
  system.events.on('quest.progressed', (event) => events.push(event));
  system.events.on('quest.completed', (event) => events.push(event));
  return events;
}

describe('QuestSystem activation', () => {
  it('starts auto-start quests without prerequisites, and leaves the rest locked', () => {
    const quests = new QuestSystem(QUESTS);
    quests.start();
    expect(quests.statusOf('q_a')).toBe('active');
    expect(quests.statusOf('q_b')).toBe('locked');
    expect(quests.statusOf('q_manual')).toBe('locked');
  });

  it('starts a manual quest only through startQuest', () => {
    const quests = new QuestSystem(QUESTS);
    quests.start();
    expect(quests.startQuest('q_manual')).toBe(true);
    expect(quests.startQuest('q_manual')).toBe(false);
    expect(quests.statusOf('q_manual')).toBe('active');
  });
});

describe('QuestSystem progress', () => {
  it('counts each distinct source once, so a repeated pickup does not advance twice', () => {
    const quests = new QuestSystem(QUESTS);
    quests.start();
    quests.handle({ type: 'collect', targetId: 'bamboo', sourceId: 'pk_1' });
    quests.handle({ type: 'collect', targetId: 'bamboo', sourceId: 'pk_1' });
    expect(quests.views()[0]?.objectives[1]?.progress).toBe(1);
  });

  it('ignores events for other types and targets', () => {
    const quests = new QuestSystem(QUESTS);
    quests.start();
    quests.handle({ type: 'collect', targetId: 'paper', sourceId: 'pk_9' });
    quests.handle({ type: 'craft', targetId: 'bamboo', sourceId: 'c1' });
    expect(quests.views()[0]?.objectives.map((objective) => objective.progress)).toEqual([0, 0]);
  });

  it('completes once, announces rewards once, and then starts the next quest', () => {
    const quests = new QuestSystem(QUESTS);
    const events = collect(quests);
    quests.start();
    quests.handle({ type: 'talk', targetId: 'npc_x', sourceId: 'talk:npc_x' });
    quests.handle({ type: 'collect', targetId: 'bamboo', sourceId: 'a' });
    quests.handle({ type: 'collect', targetId: 'bamboo', sourceId: 'b' });
    // More events after completion must not award again.
    quests.handle({ type: 'collect', targetId: 'bamboo', sourceId: 'c' });
    quests.handle({ type: 'talk', targetId: 'npc_x', sourceId: 'talk:npc_x' });

    const completed = events.filter((event) => event.type === 'quest.completed');
    expect(completed).toEqual([
      {
        type: 'quest.completed',
        questId: 'q_a',
        rewards: { coins: 30, reputation: 1 },
        unlocks: { flags: ['q_a_done'], shopLevel: 1 },
      },
    ]);
    expect(quests.statusOf('q_a')).toBe('completed');
    expect(quests.statusOf('q_b')).toBe('active');
  });

  it('counts a repeated source once within a single objective', () => {
    const quests = new QuestSystem(QUESTS);
    quests.start();
    quests.handle({ type: 'collect', targetId: 'bamboo', sourceId: 'same' });
    quests.handle({ type: 'collect', targetId: 'bamboo', sourceId: 'same' });
    expect(quests.views()[0]?.objectives[1]).toMatchObject({ progress: 1, done: false });
  });
});

describe('QuestSystem save and restore', () => {
  it('restores status and distinct sources, and ignores unknown quests', () => {
    const quests = new QuestSystem(QUESTS);
    quests.start();
    quests.handle({ type: 'collect', targetId: 'bamboo', sourceId: 'pk_1' });
    const saved = quests.snapshot();

    const restored = new QuestSystem(QUESTS);
    restored.restore({ ...saved, ghost_quest: { status: 'completed', progress: {} } });
    expect(restored.views()[0]?.objectives[1]?.progress).toBe(1);
    expect(restored.statusOf('q_a')).toBe('active');
    expect(restored.statusOf('ghost_quest')).toBeNull();
  });

  it('does not re-award a restored completed quest', () => {
    const quests = new QuestSystem(QUESTS);
    quests.start();
    quests.handle({ type: 'talk', targetId: 'npc_x', sourceId: 'talk:npc_x' });
    quests.handle({ type: 'collect', targetId: 'bamboo', sourceId: 'a' });
    quests.handle({ type: 'collect', targetId: 'bamboo', sourceId: 'b' });
    const restored = new QuestSystem(QUESTS);
    restored.restore(quests.snapshot());
    const events = collect(restored);
    restored.handle({ type: 'collect', targetId: 'bamboo', sourceId: 'c' });
    expect(events.filter((event) => event.type === 'quest.completed')).toEqual([]);
  });
});
