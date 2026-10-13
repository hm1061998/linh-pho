import { INTERACT_KEYS, LANTERN_KEYS } from './keyBindings';

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

export function shouldQueueInteract(press: KeyPress, blocked: boolean): boolean {
  return shouldQueueAction(INTERACT_KEYS, press, blocked);
}

export function shouldQueueLantern(press: KeyPress, blocked: boolean): boolean {
  return shouldQueueAction(LANTERN_KEYS, press, blocked);
}
