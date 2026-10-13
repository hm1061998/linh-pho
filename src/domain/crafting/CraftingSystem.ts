import type { Quality, RecipeDef } from '../content/gameplayTypes';
import type { FlagStore } from '../flags/FlagStore';
import type { Inventory, Reservation } from '../inventory/Inventory';

/**
 * One craft at a time. `begin` reserves the inputs, `complete` commits them and adds the output in one
 * step, and `cancel` returns them. The inputs are only spent when a craft finishes, so cancelling a
 * minigame never loses materials.
 */

export type CraftRefusal = 'unknown_recipe' | 'wrong_station' | 'locked' | 'missing_inputs' | 'busy' | 'no_craft';

export interface CraftSession {
  readonly craftId: string;
  readonly recipeId: string;
  readonly stationId: string;
  readonly reservation: Reservation;
}

export interface RecipeStatus {
  readonly recipe: RecipeDef;
  readonly known: boolean;
  readonly affordable: boolean;
}

export type CraftStart = { readonly ok: true; readonly session: CraftSession } | { readonly ok: false; readonly reason: CraftRefusal };

export type CraftComplete =
  | { readonly ok: true; readonly craftId: string; readonly recipeId: string; readonly outputItemId: string; readonly quality: Quality | null }
  | { readonly ok: false; readonly reason: CraftRefusal };

export class CraftingSystem {
  private readonly recipes: ReadonlyMap<string, RecipeDef>;
  private readonly inventory: Inventory;
  private readonly flags: FlagStore;
  private active: CraftSession | null = null;
  private nextCraft = 1;

  constructor(recipes: readonly RecipeDef[], inventory: Inventory, flags: FlagStore) {
    this.recipes = new Map(recipes.map((recipe) => [recipe.id, recipe]));
    this.inventory = inventory;
    this.flags = flags;
  }

  get current(): CraftSession | null {
    return this.active;
  }

  isKnown(recipe: RecipeDef): boolean {
    return recipe.unlockFlag === null || this.flags.get(recipe.unlockFlag);
  }

  /** Recipes at one station, with whether each is known and whether the inputs are in the inventory now. */
  recipesAt(stationId: string): RecipeStatus[] {
    return [...this.recipes.values()]
      .filter((recipe) => recipe.stationId === stationId)
      .map((recipe) => ({
        recipe,
        known: this.isKnown(recipe),
        affordable: recipe.inputs.every((input) => this.inventory.available(input.itemId, input.quality) >= input.count),
      }));
  }

  begin(recipeId: string, stationId: string): CraftStart {
    if (this.active) {
      return { ok: false, reason: 'busy' };
    }
    const recipe = this.recipes.get(recipeId);
    if (!recipe) {
      return { ok: false, reason: 'unknown_recipe' };
    }
    if (recipe.stationId !== stationId) {
      return { ok: false, reason: 'wrong_station' };
    }
    if (!this.isKnown(recipe)) {
      return { ok: false, reason: 'locked' };
    }
    const reservation = this.inventory.reserve(recipe.inputs);
    if (!reservation) {
      return { ok: false, reason: 'missing_inputs' };
    }
    const session: CraftSession = {
      craftId: `craft-${this.nextCraft++}`,
      recipeId,
      stationId,
      reservation,
    };
    this.active = session;
    return { ok: true, session };
  }

  /**
   * Finishes the active craft. The reserved inputs are removed and the output is added. `quality` only
   * applies to qualifiable outputs and defaults to normal.
   */
  complete(quality: Quality = 'normal'): CraftComplete {
    const session = this.active;
    if (!session) {
      return { ok: false, reason: 'no_craft' };
    }
    const recipe = this.recipes.get(session.recipeId);
    if (!recipe) {
      this.cancel();
      return { ok: false, reason: 'unknown_recipe' };
    }
    this.inventory.commit(session.reservation.id);
    const outputQuality = this.outputQuality(recipe, quality);
    this.inventory.add(recipe.output.itemId, recipe.output.count, outputQuality);
    this.active = null;
    return {
      ok: true,
      craftId: session.craftId,
      recipeId: recipe.id,
      outputItemId: recipe.output.itemId,
      quality: outputQuality,
    };
  }

  /** Returns the reserved inputs and ends the craft. A no-op when nothing is active. */
  cancel(): void {
    if (!this.active) {
      return;
    }
    this.inventory.release(this.active.reservation.id);
    this.active = null;
  }

  private outputQuality(recipe: RecipeDef, quality: Quality): Quality | null {
    // Only qualifiable outputs carry a quality. Raw materials are stored without one.
    return this.inventory.isQualifiable(recipe.output.itemId) ? quality : null;
  }
}
