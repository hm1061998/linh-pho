import { INTERACT_KEYS } from './keyBindings';

/**
 * Whether a key press should queue one interact action.
 *
 * Ignored when:
 * - the game is blocked (dialogue, pause), so a press meant for a modal never reaches the world;
 * - a UI element already handled the key (`defaultPrevented`). The dialogue card uses E to continue,
 *   and that same press must not also start a new interaction on the next frame;
 * - the key is an auto-repeat from holding it down.
 */
export function shouldQueueInteract(
  press: { readonly code: string; readonly repeat: boolean; readonly defaultPrevented: boolean },
  blocked: boolean,
): boolean {
  return INTERACT_KEYS.includes(press.code) && !press.repeat && !press.defaultPrevented && !blocked;
}
