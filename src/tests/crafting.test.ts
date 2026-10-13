import { describe, expect, it } from 'vitest';
import type { ItemDef, RecipeDef } from '../domain/content/gameplayTypes';
import { CraftingSystem } from '../domain/crafting/CraftingSystem';
import { FlagStore } from '../domain/flags/FlagStore';
import { Inventory } from '../domain/inventory/Inventory';

const ITEMS: ItemDef[] = [
  { id: 'bamboo', nameKey: 'k', stackLimit: 99, qualifiable: false },
  { id: 'paper', nameKey: 'k', stackLimit: 99, qualifiable: false },
  { id: 'rope', nameKey: 'k', stackLimit: 99, qualifiable: false },
  { id: 'wooden_lantern', nameKey: 'k', stackLimit: 20, qualifiable: true },
  { id: 'spirit_lantern', nameKey: 'k', stackLimit: 20, qualifiable: true },
  { id: 'wood_scrap', nameKey: 'k', stackLimit: 99, qualifiable: false },
];

const RECIPES: RecipeDef[] = [
  {
    id: 'recipe_wooden_lantern',
    nameKey: 'k',
    inputs: [
      { itemId: 'bamboo', count: 2 },
      { itemId: 'paper', count: 1 },
      { itemId: 'rope', count: 1 },
    ],
    output: { itemId: 'wooden_lantern', count: 1 },
    stationId: 'station_workbench',
    miniGame: 'confirm',
    unlockFlag: null,
  },
  {
    id: 'recipe_spirit_lantern',
    nameKey: 'k',
    inputs: [{ itemId: 'wood_scrap', count: 1 }],
    output: { itemId: 'spirit_lantern', count: 1 },
    stationId: 'station_engraving',
    miniGame: 'engraving',
    unlockFlag: 'recipe_spirit_lantern_known',
  },
];

function setup(stock: Array<[string, number]> = [['bamboo', 2], ['paper', 1], ['rope', 1]]) {
  const inventory = new Inventory(ITEMS);
  for (const [itemId, count] of stock) {
    inventory.add(itemId, count);
  }
  const flags = new FlagStore();
  const crafting = new CraftingSystem(RECIPES, inventory, flags);
  return { inventory, flags, crafting };
}

describe('CraftingSystem refusals', () => {
  it('refuses an unknown recipe, a wrong station, and a locked recipe', () => {
    const { crafting } = setup();
    expect(crafting.begin('nope', 'station_workbench')).toEqual({ ok: false, reason: 'unknown_recipe' });
    expect(crafting.begin('recipe_wooden_lantern', 'station_engraving')).toEqual({ ok: false, reason: 'wrong_station' });
    expect(crafting.begin('recipe_spirit_lantern', 'station_engraving')).toEqual({ ok: false, reason: 'locked' });
  });

  it('refuses when inputs are missing and reserves nothing', () => {
    const { crafting, inventory } = setup([['bamboo', 1], ['paper', 1], ['rope', 1]]);
    expect(crafting.begin('recipe_wooden_lantern', 'station_workbench')).toEqual({ ok: false, reason: 'missing_inputs' });
    expect(inventory.available('bamboo')).toBe(1);
  });

  it('allows one craft at a time', () => {
    const { crafting } = setup([['bamboo', 4], ['paper', 2], ['rope', 2]]);
    expect(crafting.begin('recipe_wooden_lantern', 'station_workbench').ok).toBe(true);
    expect(crafting.begin('recipe_wooden_lantern', 'station_workbench')).toEqual({ ok: false, reason: 'busy' });
  });

  it('unlocks a recipe when its flag is set', () => {
    const { crafting, flags, inventory } = setup([['wood_scrap', 1]]);
    flags.set('recipe_spirit_lantern_known', true);
    expect(crafting.begin('recipe_spirit_lantern', 'station_engraving').ok).toBe(true);
    expect(inventory.available('wood_scrap')).toBe(0);
  });
});

describe('CraftingSystem commit and cancel', () => {
  it('reserves inputs on begin and spends them once on complete', () => {
    const { crafting, inventory } = setup();
    crafting.begin('recipe_wooden_lantern', 'station_workbench');
    expect(inventory.available('bamboo')).toBe(0);
    const done = crafting.complete('good');
    expect(done).toMatchObject({ ok: true, recipeId: 'recipe_wooden_lantern', outputItemId: 'wooden_lantern', quality: 'good' });
    expect(inventory.available('wooden_lantern', 'good')).toBe(1);
    expect(crafting.current).toBeNull();
  });

  it('gives a raw-material output no quality, even when a quality is requested', () => {
    const rawRecipe: RecipeDef = {
      id: 'recipe_split_bamboo',
      nameKey: 'k',
      inputs: [{ itemId: 'bamboo', count: 1 }],
      output: { itemId: 'paper', count: 2 },
      stationId: 'station_workbench',
      miniGame: 'confirm',
      unlockFlag: null,
    };
    const inventory = new Inventory(ITEMS);
    inventory.add('bamboo', 1);
    const crafting = new CraftingSystem([rawRecipe], inventory, new FlagStore());
    crafting.begin('recipe_split_bamboo', 'station_workbench');
    expect(crafting.complete('perfect')).toMatchObject({ ok: true, quality: null });
    expect(inventory.available('paper')).toBe(2);
  });

  it('returns the inputs on cancel, and a second cancel does nothing', () => {
    const { crafting, inventory } = setup();
    crafting.begin('recipe_wooden_lantern', 'station_workbench');
    crafting.cancel();
    expect(inventory.available('bamboo')).toBe(2);
    expect(inventory.available('paper')).toBe(1);
    expect(crafting.current).toBeNull();
    crafting.cancel();
    expect(inventory.available('bamboo')).toBe(2);
  });

  it('cannot complete twice, so a repeated click never duplicates the output', () => {
    const { crafting, inventory } = setup();
    crafting.begin('recipe_wooden_lantern', 'station_workbench');
    crafting.complete();
    expect(crafting.complete()).toEqual({ ok: false, reason: 'no_craft' });
    expect(inventory.available('wooden_lantern')).toBe(1);
  });

  it('lists recipes at a station with known and affordable status', () => {
    const { crafting } = setup([['bamboo', 2], ['paper', 1]]);
    const [status] = crafting.recipesAt('station_workbench');
    expect(status).toMatchObject({ known: true, affordable: false });
    expect(crafting.recipesAt('station_engraving')[0]).toMatchObject({ known: false, affordable: false });
  });
});
