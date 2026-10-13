import { EventBus } from '../../shared/events/EventBus';
import type { GroundPoint } from '../player/collision';

/** How close the player must be (XZ distance, meters) before a target can be used. Prompt 03 says 2 m. */
export const DEFAULT_INTERACTION_RANGE_M = 2;

export interface InteractableTarget {
  /** Stable ID, for example `npc_ba_nghiem`. Interaction events carry this ID. */
  readonly id: string;
  /** Locale key for the target's name. The engine never translates. */
  readonly labelKey: string;
  readonly position: GroundPoint;
  /** Optional per-target range in meters. Defaults to `DEFAULT_INTERACTION_RANGE_M`. */
  readonly range?: number;
}

export interface FocusedTarget {
  readonly id: string;
  readonly labelKey: string;
}

export type InteractionEvent =
  | { readonly type: 'interaction.focusChanged'; readonly target: FocusedTarget | null }
  | { readonly type: 'interaction.triggered'; readonly targetId: string };

interface RegisteredTarget {
  readonly id: string;
  readonly labelKey: string;
  readonly position: GroundPoint;
  readonly range: number;
}

/**
 * Tracks the one target the player is focused on, meaning the nearest target within range, and fires
 * `triggered` when the player presses interact. It has no DOM and no rendering, so the HUD and touch
 * button can react to its events independently.
 */
export class InteractionSystem {
  readonly events = new EventBus<InteractionEvent>();
  private readonly targets = new Map<string, RegisteredTarget>();
  private focusId: string | null = null;

  /** Adds a target. Returns false for a duplicate ID or an invalid range, and logs why. */
  register(target: InteractableTarget): boolean {
    if (this.targets.has(target.id)) {
      console.warn(`[Interaction] Target "${target.id}" is already registered; ignoring the duplicate`);
      return false;
    }
    const range = target.range ?? DEFAULT_INTERACTION_RANGE_M;
    if (!(range > 0) || !Number.isFinite(range)) {
      console.warn(`[Interaction] Target "${target.id}" has an invalid range; ignoring it`);
      return false;
    }
    this.targets.set(target.id, {
      id: target.id,
      labelKey: target.labelKey,
      position: { x: target.position.x, z: target.position.z },
      range,
    });
    return true;
  }

  /** Removes a target. If it was focused, focus is cleared and listeners are told. */
  unregister(targetId: string): boolean {
    const removed = this.targets.delete(targetId);
    if (this.focusId === targetId) {
      this.focusId = null;
      this.emitFocus();
    }
    return removed;
  }

  get focus(): FocusedTarget | null {
    if (this.focusId === null) {
      return null;
    }
    const target = this.targets.get(this.focusId);
    return target ? { id: target.id, labelKey: target.labelKey } : null;
  }

  /**
   * Recomputes focus from the player's position. Call once per frame, after the player moves.
   * Emits `focusChanged` only when the focused target actually changes.
   */
  update(player: GroundPoint): void {
    const nextId = this.nearestInRange(player);
    if (nextId !== this.focusId) {
      this.focusId = nextId;
      this.emitFocus();
    }
  }

  /**
   * Starts an interaction with the focused target. Returns false and does nothing when no target is in
   * range, so an out-of-range press never opens anything.
   */
  press(): boolean {
    if (this.focusId === null) {
      return false;
    }
    this.events.emit({ type: 'interaction.triggered', targetId: this.focusId });
    return true;
  }

  /**
   * Nearest target within its range. Ties go to whichever was registered first, so results are
   * deterministic.
   */
  private nearestInRange(player: GroundPoint): string | null {
    let bestId: string | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const target of this.targets.values()) {
      const distance = Math.hypot(target.position.x - player.x, target.position.z - player.z);
      if (distance <= target.range && distance < bestDistance) {
        bestId = target.id;
        bestDistance = distance;
      }
    }
    return bestId;
  }

  private emitFocus(): void {
    this.events.emit({ type: 'interaction.focusChanged', target: this.focus });
  }
}
