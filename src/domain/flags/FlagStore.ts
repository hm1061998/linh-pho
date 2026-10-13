import type { FlagCondition } from '../content/types';

/**
 * Story flags: named booleans that dialogue conditions read and effects write.
 * Module 04 (quests) and Module 08 (save) will read and write the same store.
 * Missing flags count as false.
 */
export class FlagStore {
  private readonly values = new Map<string, boolean>();

  get(flag: string): boolean {
    return this.values.get(flag) ?? false;
  }

  set(flag: string, value: boolean): void {
    this.values.set(flag, value);
  }

  /** True when every condition holds. An empty list always holds. */
  matches(conditions: readonly FlagCondition[]): boolean {
    return conditions.every((condition) => this.get(condition.flag) === condition.equals);
  }

  /** Plain copy for saving or debugging. Changing it does not change the store. */
  snapshot(): Record<string, boolean> {
    return Object.fromEntries(this.values);
  }

  /** Replaces every flag with a saved set. Used when a save is loaded or the progress is reset. */
  restore(values: Readonly<Record<string, boolean>>): void {
    this.values.clear();
    for (const [flag, value] of Object.entries(values)) {
      this.values.set(flag, value);
    }
  }
}
