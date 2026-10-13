import { codesFor, DEFAULT_KEY_MAP } from '../../domain/input/keyMap';

/** The codes that interact and lantern use under the default map. The input service passes the live ones instead. */
const DEFAULT_INTERACT_KEYS: readonly string[] = codesFor('interact', DEFAULT_KEY_MAP);
const DEFAULT_LANTERN_KEYS: readonly string[] = codesFor('lantern', DEFAULT_KEY_MAP);

/**
 * Whether a key press should queue one action (interact, or toggle the lantern).
 *
 * Ignored when:
 * - the game is blocked (dialogue, panel, pause), so a press meant for a modal never reaches the world;
 * - a UI element already handled the key (`defaultPrevented`). The dialogue card uses E to continue,
 *   and that same press must not also start a new action on the next frame;
 * - the key is an auto-repeat from holding it down.
 */
export interface KeyPress {
  readonly code: string;
  readonly repeat: boolean;
  readonly defaultPrevented: boolean;
}

export function shouldQueueAction(keys: readonly string[], press: KeyPress, blocked: boolean): boolean {
  return keys.includes(press.code) && !press.repeat && !press.defaultPrevented && !blocked;
}

export function shouldQueueInteract(press: KeyPress, blocked: boolean, keys: readonly string[] = DEFAULT_INTERACT_KEYS): boolean {
  return shouldQueueAction(keys, press, blocked);
}

export function shouldQueueLantern(press: KeyPress, blocked: boolean, keys: readonly string[] = DEFAULT_LANTERN_KEYS): boolean {
  return shouldQueueAction(keys, press, blocked);
}
