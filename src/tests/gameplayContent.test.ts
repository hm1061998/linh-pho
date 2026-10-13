import { describe, expect, it } from 'vitest';
import { CONTENT_ISSUES, GAME_CONTENT } from '../content';
import { validateGameplay, type GameplayContext, type GameplayRaw } from '../domain/content/validateGameplay';
import { isPointInAabb } from '../engine/player/collision';
import { HUB_WORLD } from '../engine/scene/hubCollision';
import { HUB_HALF_SIZE_M } from '../engine/scene/hubLayout';

const CTX: GameplayContext = {
  npcIds: new Set(['npc_x']),
  hasTextKey: () => true,
  targetExists: (type, id) => (type === 'talk' ? id === 'npc_x' : type === 'place' ? id === 'lamp' : false),
};

const BASE_RAW: GameplayRaw = {
  items: {
    items: [
      { id: 'bamboo', nameKey: 'k', stackLimit: 9, qualifiable: false },
      { id: 'lantern', nameKey: 'k', stackLimit: 9, qualifiable: true },
    ],
  },
  recipes: {
    recipes: [
      {
        id: 'r1',
        nameKey: 'k',
        inputs: [{ itemId: 'bamboo', count: 1 }],
        output: { itemId: 'lantern', count: 1 },
        stationId: 'st1',
        miniGame: 'confirm',
        unlockFlag: null,
      },
    ],
  },
  quests: {
    quests: [
      {
        id: 'q1',
        titleKey: 'k',
        autoStart: true,
        prerequisites: [],
        objectives: [{ id: 'o1', type: 'craft', targetId: 'r1', count: 1, textKey: 'k' }],
        rewards: { coins: 1, reputation: 0 },
        unlocks: { flags: [], shopLevel: null },
      },
    ],
  },
  world: {
    pickups: [{ id: 'pk1', itemId: 'bamboo', position: { x: 1, z: 1 } }],
    stations: [{ id: 'st1', kind: 'workbench', labelKey: 'k', position: { x: 2, z: 2 } }],
    placements: [{ id: 'lamp', labelKey: 'k', position: { x: 3, z: 3 }, acceptsItemId: 'lantern' }],
  },
};

describe('shipped gameplay content', () => {
  it('loads with no issues', () => {
    expect(CONTENT_ISSUES).toEqual([]);
  });

  it('has the Module 04 pieces: items, recipes, Q00, and world interactables', () => {
    expect(GAME_CONTENT.items.map((item) => item.id)).toContain('wooden_lantern');
    expect(GAME_CONTENT.recipes.map((recipe) => recipe.id)).toContain('recipe_wooden_lantern');
    expect(GAME_CONTENT.quests.map((quest) => quest.id)).toEqual(['q00_dem_mo_cho']);
    expect(GAME_CONTENT.stations.length).toBeGreaterThan(0);
    expect(GAME_CONTENT.placements.length).toBeGreaterThan(0);
  });

  it('keeps every pickup, station, and placement inside the hub and off solid obstacles', () => {
    const points = [
      ...GAME_CONTENT.pickups.map((entry) => ({ id: entry.id, position: entry.position })),
      ...GAME_CONTENT.stations.map((entry) => ({ id: entry.id, position: entry.position })),
      ...GAME_CONTENT.placements.map((entry) => ({ id: entry.id, position: entry.position })),
    ];
    for (const { id, position } of points) {
      expect(Math.abs(position.x), `${id} x`).toBeLessThan(HUB_HALF_SIZE_M - 0.5);
      expect(Math.abs(position.z), `${id} z`).toBeLessThan(HUB_HALF_SIZE_M - 0.5);
      expect(HUB_WORLD.solids.some((box) => isPointInAabb(position, box)), `${id} blocked`).toBe(false);
    }
  });

  it('gives every recipe a station that exists', () => {
    const stations = new Set(GAME_CONTENT.stations.map((station) => station.id));
    for (const recipe of GAME_CONTENT.recipes) {
      expect(stations.has(recipe.stationId), recipe.id).toBe(true);
    }
  });
});

describe('gameplay validation drops bad entries and reports them', () => {
  it('accepts the base fixture', () => {
    const result = validateGameplay(BASE_RAW, CTX);
    expect(result.issues).toEqual([]);
    expect(result.content.quests).toHaveLength(1);
  });

  it('drops a recipe that uses an unknown item', () => {
    const raw: GameplayRaw = {
      ...BASE_RAW,
      recipes: {
        recipes: [{ ...(BASE_RAW.recipes as { recipes: object[] }).recipes[0], inputs: [{ itemId: 'ghost', count: 1 }] }],
      },
    };
    const result = validateGameplay(raw, CTX);
    expect(result.content.recipes).toEqual([]);
    expect(result.issues.some((issue) => issue.message.includes('ghost'))).toBe(true);
  });

  it('drops a quest that points at a missing recipe', () => {
    const raw: GameplayRaw = {
      ...BASE_RAW,
      quests: {
        quests: [
          {
            ...(BASE_RAW.quests as { quests: object[] }).quests[0],
            objectives: [{ id: 'o1', type: 'craft', targetId: 'nope', count: 1, textKey: 'k' }],
          },
        ],
      },
    };
    const result = validateGameplay(raw, CTX);
    expect(result.content.quests).toEqual([]);
  });

  it('reports an objective type with no content yet, instead of accepting it silently', () => {
    const raw: GameplayRaw = {
      ...BASE_RAW,
      quests: {
        quests: [
          {
            ...(BASE_RAW.quests as { quests: object[] }).quests[0],
            objectives: [{ id: 'o1', type: 'scan', targetId: 'glyph_x', count: 1, textKey: 'k' }],
          },
        ],
      },
    };
    expect(validateGameplay(raw, CTX).content.quests).toEqual([]);
  });

  it('drops a quest whose prerequisite does not exist, and says so', () => {
    const raw: GameplayRaw = {
      ...BASE_RAW,
      quests: {
        quests: [{ ...(BASE_RAW.quests as { quests: object[] }).quests[0], id: 'q2', prerequisites: ['missing'] }],
      },
    };
    const result = validateGameplay(raw, CTX);
    expect(result.content.quests).toEqual([]);
    expect(result.issues.some((issue) => issue.message.includes('"missing"'))).toBe(true);
  });

  it('drops a pickup for an unknown item, and reports a repeated interactable id', () => {
    const raw: GameplayRaw = {
      ...BASE_RAW,
      world: {
        pickups: [
          { id: 'pk1', itemId: 'ghost', position: { x: 1, z: 1 } },
          { id: 'st1', itemId: 'bamboo', position: { x: 5, z: 5 } },
        ],
        stations: [{ id: 'st1', kind: 'workbench', labelKey: 'k', position: { x: 2, z: 2 } }],
        placements: [],
      },
    };
    const result = validateGameplay(raw, CTX);
    expect(result.content.pickups.map((pickup) => pickup.id)).toEqual(['st1']);
    expect(result.issues.some((issue) => issue.message.includes('used more than once'))).toBe(true);
  });

  it('drops a station with an unknown kind', () => {
    const raw: GameplayRaw = {
      ...BASE_RAW,
      world: {
        pickups: [],
        stations: [{ id: 'st9', kind: 'cauldron', labelKey: 'k', position: { x: 2, z: 2 } }],
        placements: [],
      },
    };
    expect(validateGameplay(raw, CTX).content.stations).toEqual([]);
  });

  it('rejects quality on a raw material', () => {
    const raw: GameplayRaw = {
      ...BASE_RAW,
      recipes: {
        recipes: [
          {
            ...(BASE_RAW.recipes as { recipes: object[] }).recipes[0],
            inputs: [{ itemId: 'bamboo', count: 1, quality: 'good' }],
          },
        ],
      },
    };
    expect(validateGameplay(raw, CTX).content.recipes).toEqual([]);
  });
});
