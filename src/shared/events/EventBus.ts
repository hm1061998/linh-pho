/**
 * Typed publish/subscribe for game events. Each event is a discriminated union member with a `type`
 * string, and listeners receive only the members they subscribed to.
 *
 * Listeners that throw are logged and skipped, so one broken HUD component cannot stop gameplay
 * or the other listeners.
 */
export class EventBus<TEvent extends { readonly type: string }> {
  private readonly listeners = new Map<string, Set<(event: TEvent) => void>>();

  /** Subscribes to one event type. Returns the unsubscribe function. */
  on<T extends TEvent['type']>(
    type: T,
    listener: (event: Extract<TEvent, { readonly type: T }>) => void,
  ): () => void {
    // Only events whose `type` matches reach this listener, so the narrowed parameter is safe.
    const handler = listener as (event: TEvent) => void;
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(handler);
    return () => {
      this.listeners.get(type)?.delete(handler);
    };
  }

  emit(event: TEvent): void {
    const set = this.listeners.get(event.type);
    if (!set) {
      return;
    }
    // Copy first, so a listener that unsubscribes during emit does not skip the next one.
    for (const listener of [...set]) {
      try {
        listener(event);
      } catch (error) {
        console.error(`[EventBus] A listener for "${event.type}" threw`, error);
      }
    }
  }

  /** Removes every listener. Used on teardown. */
  clear(): void {
    this.listeners.clear();
  }
}
