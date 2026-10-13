import { codesFor, DEFAULT_KEY_MAP, actionFor, REMAP_ACTIONS, type KeyMap, type RemapAction } from '../../domain/input/keyMap';

/**
 * The live key map. `InputService` and the keyboard state read it on every event, and the pause menu replaces it when the
 * player changes a key. The HUD listens, so the key labels it shows stay current.
 */
export class KeyBindings {
  private map: KeyMap;
  private readonly listeners = new Set<() => void>();

  constructor(map: KeyMap = DEFAULT_KEY_MAP) {
    this.map = map;
  }

  get current(): KeyMap {
    return this.map;
  }

  /** Replaces the whole map and tells every listener. */
  set(map: KeyMap): void {
    this.map = map;
    for (const listener of this.listeners) {
      listener();
    }
  }

  /** Called on every change. Returns the function that stops listening. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  codesFor(action: RemapAction): readonly string[] {
    return codesFor(action, this.map);
  }

  actionFor(code: string): RemapAction | null {
    return actionFor(code, this.map);
  }

  /** Every key code any action uses. The input service listens to these, and to nothing else. */
  boundCodes(): ReadonlySet<string> {
    return new Set(REMAP_ACTIONS.flatMap((action) => codesFor(action, this.map)));
  }
}
