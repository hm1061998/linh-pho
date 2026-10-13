/**
 * Keyboard bindings by `KeyboardEvent.code`, so layouts (AZERTY, Dvorak) map to the same physical keys.
 * Kept as data so a key-remap screen (Prompt 10) can replace it without touching the input logic.
 */
export const MOVE_BINDINGS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
} as const satisfies Record<string, readonly string[]>;

export const INTERACT_KEYS: readonly string[] = ['KeyE'];

/** Đèn Soi Linh toggle. Q is the key the GDD lists for changing the lantern mode. */
export const LANTERN_KEYS: readonly string[] = ['KeyQ'];

const ALL_BOUND_CODES: readonly string[] = [
  ...MOVE_BINDINGS.forward,
  ...MOVE_BINDINGS.back,
  ...MOVE_BINDINGS.left,
  ...MOVE_BINDINGS.right,
  ...INTERACT_KEYS,
  ...LANTERN_KEYS,
];

export const BOUND_KEY_CODES: ReadonlySet<string> = new Set(ALL_BOUND_CODES);
