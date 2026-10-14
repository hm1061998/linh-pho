// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { InputService } from '../engine/input/InputService';
import { locomotionState } from '../engine/player/locomotion';

let input: InputService | undefined;
afterEach(() => input?.dispose());
const key = (type: string, code: string) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));

describe('hold Shift to run', () => {
  it('accepts both Shift keys, releases independently, and clears on focus loss', () => {
    input = new InputService(document.createElement('canvas'));
    key('keydown', 'KeyW');
    key('keydown', 'ShiftLeft');
    expect(input.frame().sprintHeld).toBe(true);
    key('keydown', 'ShiftRight');
    key('keyup', 'ShiftLeft');
    expect(input.frame().sprintHeld).toBe(true);
    key('keyup', 'ShiftRight');
    expect(input.frame().sprintHeld).toBe(false);
    expect(input.frame().move.y).toBe(1);
    key('keydown', 'ShiftLeft');
    window.dispatchEvent(new Event('blur'));
    expect(input.frame().sprintHeld).toBe(false);
    expect(input.frame().move).toEqual({ x: 0, y: 0 });
  });

  it('drops held sprint when a dialogue or pause blocker opens', () => {
    input = new InputService(document.createElement('canvas'));
    key('keydown', 'ShiftLeft');
    key('keydown', 'KeyW');
    input.pushBlocker('dialogue');
    expect(input.frame().sprintHeld).toBe(false);
    input.popBlocker('dialogue');
    expect(input.frame().sprintHeld).toBe(false);
    expect(input.frame().move).toEqual({ x: 0, y: 0 });
  });
});

it('uses actual speed to enter run, decelerate back to walk, and stop at a wall', () => {
  expect(locomotionState(0, 1.1, 'idle', true, true)).toBe('idle');
  expect(locomotionState(1, 1.1, 'idle', true, true)).toBe('walk');
  expect(locomotionState(3.6, 1.1, 'walk', true, true)).toBe('run');
  expect(locomotionState(2, 1.1, 'run', false, true)).toBe('run');
  expect(locomotionState(1.1, 1.1, 'run', false, true)).toBe('walk');
  expect(locomotionState(0, 1.1, 'run', true, true)).toBe('idle');
  expect(locomotionState(3.6, 1.1, 'walk', true, false)).toBe('walk');
});
