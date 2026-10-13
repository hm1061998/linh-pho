/**
 * The keys the player can change, as data. Keys are `KeyboardEvent.code` values, so layouts (AZERTY, Dvorak) map to the
 * same physical keys. Each action has one primary key, which the player changes in the pause menu. The arrow keys
 * always move the player and are not changed. Pure, with no DOM, so it can be tested in Node.
 */

export const REMAP_ACTIONS = ['forward', 'back', 'left', 'right', 'interact', 'lantern', 'inventory', 'journal'] as const;
export type RemapAction = (typeof REMAP_ACTIONS)[number];
export type KeyMap = Readonly<Record<RemapAction, string>>;

export const DEFAULT_KEY_MAP: KeyMap = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  interact: 'KeyE',
  lantern: 'KeyQ',
  inventory: 'KeyI',
  journal: 'KeyJ',
};

/** The arrow key that also moves the player in each direction. Arrows are never reassigned, so they stay unique. */
const ARROW_CODES: Partial<Record<RemapAction, string>> = {
  forward: 'ArrowUp',
  back: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};

/**
 * Keys no action can take. Escape closes panels and the menu, Enter and Space continue dialogue, Tab moves focus, the
 * arrows always move, and the F keys belong to the browser and the developer tools.
 */
export function isReservedCode(code: string): boolean {
  return ['Escape', 'Enter', 'Space', 'Tab', 'Backspace'].includes(code) || /^F\d{1,2}$/.test(code) || code.startsWith('Arrow');
}

/** A key code as the browser names it: a letter, digit or symbol name such as KeyW, Digit1 or BracketLeft. */
function isKeyCode(code: string): boolean {
  return /^[A-Za-z][A-Za-z0-9]{0,19}$/.test(code);
}

/** Every key code an action responds to: its primary key, plus the arrow for the four moves. */
export function codesFor(action: RemapAction, map: KeyMap): readonly string[] {
  const arrow = ARROW_CODES[action];
  return arrow ? [map[action], arrow] : [map[action]];
}

/** The action a key code triggers under this map, or null when the key does nothing. */
export function actionFor(code: string, map: KeyMap): RemapAction | null {
  for (const action of REMAP_ACTIONS) {
    if (codesFor(action, map).includes(code)) {
      return action;
    }
  }
  return null;
}

/**
 * Gives `action` the key `code`. If another action had that key, the two swap, so no two actions ever share a key.
 * Returns null when the key is reserved or is not a key code, and then nothing changes.
 */
export function assignKey(map: KeyMap, action: RemapAction, code: string): KeyMap | null {
  if (!isKeyCode(code) || isReservedCode(code)) {
    return null;
  }
  const previous = map[action];
  if (previous === code) {
    return map;
  }
  const other = REMAP_ACTIONS.find((candidate) => candidate !== action && map[candidate] === code);
  const next: Record<RemapAction, string> = { ...map, [action]: code };
  if (other !== undefined) {
    next[other] = previous;
  }
  return next;
}

/**
 * Checks a key map read from a save. A missing or invalid entry takes the default for that action, so an older save
 * keeps the player's other keys, and a save from before an action existed gets its default. If the result has two
 * actions on one key, the whole map is replaced by the defaults.
 */
export function cleanKeyMap(value: unknown): KeyMap {
  const record = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const map = {} as Record<RemapAction, string>;
  for (const action of REMAP_ACTIONS) {
    const code = record[action];
    map[action] = typeof code === 'string' && isKeyCode(code) && !isReservedCode(code) ? code : DEFAULT_KEY_MAP[action];
  }
  const codes = Object.values(map);
  return new Set(codes).size === codes.length ? map : DEFAULT_KEY_MAP;
}

/** The short label shown on screen for a key code: W for KeyW, 1 for Digit1, and the code itself otherwise. */
export function keyLabel(code: string): string {
  if (code.startsWith('Key') && code.length === 4) {
    return code.slice(3);
  }
  if (code.startsWith('Digit') && code.length === 6) {
    return code.slice(5);
  }
  return code;
}
