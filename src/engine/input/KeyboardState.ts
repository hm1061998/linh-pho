import { MOVE_BINDINGS } from './keyBindings';
import { clampMagnitude, type MoveInput } from './moveInput';

/**
 * Which bound keys are held right now. Pure state, no DOM, so it can be tested in Node.
 * `InputService` feeds it key events and clears it when focus is lost.
 */
export class KeyboardState {
  private readonly pressed = new Set<string>();

  press(code: string): void {
    this.pressed.add(code);
  }

  release(code: string): void {
    this.pressed.delete(code);
  }

  /** Forgets every held key. Called on window blur and when a modal opens. */
  clear(): void {
    this.pressed.clear();
  }

  isPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  /**
   * Walk intent from the held move keys. Opposite keys cancel out, and diagonals are normalized,
   * so W+D moves at the same speed as W alone.
   */
  moveVector(): MoveInput {
    const right = this.anyPressed(MOVE_BINDINGS.right) ? 1 : 0;
    const left = this.anyPressed(MOVE_BINDINGS.left) ? 1 : 0;
    const forward = this.anyPressed(MOVE_BINDINGS.forward) ? 1 : 0;
    const back = this.anyPressed(MOVE_BINDINGS.back) ? 1 : 0;
    return clampMagnitude({ x: right - left, y: forward - back });
  }

  private anyPressed(codes: readonly string[]): boolean {
    return codes.some((code) => this.pressed.has(code));
  }
}
