/**
 * Walk intent in camera space, from keyboard or joystick. Input-agnostic: no DOM types here.
 * `x` is right (+1 = D), `y` is forward (+1 = W). Length is at most 1.
 */
export interface MoveInput {
  readonly x: number;
  readonly y: number;
}

export const NO_MOVE: MoveInput = { x: 0, y: 0 };

/** Joystick travel below this fraction of full deflection is ignored, to hide stick drift. */
export const STICK_DEADZONE = 0.15;

/** Scales the vector down to `max` length if it is longer. Shorter vectors are unchanged. */
export function clampMagnitude(input: MoveInput, max = 1): MoveInput {
  const length = Math.hypot(input.x, input.y);
  if (length <= max || length === 0) {
    return input;
  }
  const scale = max / length;
  return { x: input.x * scale, y: input.y * scale };
}

/**
 * Removes small analog drift and rescales the rest so the output starts at 0 just outside the
 * deadzone and reaches 1 at full deflection. Keeps the direction.
 */
export function applyDeadzone(input: MoveInput, deadzone = STICK_DEADZONE): MoveInput {
  const length = Math.hypot(input.x, input.y);
  if (length < deadzone) {
    return NO_MOVE;
  }
  const magnitude = Math.min(1, (length - deadzone) / (1 - deadzone));
  return { x: (input.x / length) * magnitude, y: (input.y / length) * magnitude };
}

export function addMoveInputs(a: MoveInput, b: MoveInput): MoveInput {
  return clampMagnitude({ x: a.x + b.x, y: a.y + b.y });
}
