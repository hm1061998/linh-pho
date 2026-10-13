import { describe, expect, it } from 'vitest';
import { KeyboardState } from '../engine/input/KeyboardState';
import { BOUND_KEY_CODES, INTERACT_KEYS, MOVE_BINDINGS } from '../engine/input/keyBindings';

describe('KeyboardState.moveVector', () => {
  it('gives the same walk intent for WASD and the arrow keys', () => {
    const wasd = new KeyboardState();
    wasd.press('KeyW');
    const arrows = new KeyboardState();
    arrows.press('ArrowUp');
    expect(wasd.moveVector()).toEqual(arrows.moveVector());
    expect(wasd.moveVector()).toEqual({ x: 0, y: 1 });
  });

  it('cancels opposite keys', () => {
    const state = new KeyboardState();
    state.press('KeyW');
    state.press('KeyS');
    expect(state.moveVector()).toEqual({ x: 0, y: 0 });
  });

  it('normalizes diagonals to unit length', () => {
    const state = new KeyboardState();
    state.press('KeyW');
    state.press('KeyD');
    const move = state.moveVector();
    expect(Math.hypot(move.x, move.y)).toBeCloseTo(1);
    expect(move.x).toBeGreaterThan(0);
    expect(move.y).toBeGreaterThan(0);
  });

  it('stops moving after release', () => {
    const state = new KeyboardState();
    state.press('KeyA');
    state.release('KeyA');
    expect(state.moveVector()).toEqual({ x: 0, y: 0 });
  });

  it('forgets every held key on clear, so a lost focus cannot leave the player walking', () => {
    const state = new KeyboardState();
    state.press('KeyW');
    state.press('KeyD');
    state.clear();
    expect(state.moveVector()).toEqual({ x: 0, y: 0 });
    expect(state.isPressed('KeyW')).toBe(false);
  });
});

describe('key bindings', () => {
  it('binds every move action to at least WASD or the arrows', () => {
    expect(MOVE_BINDINGS.forward).toContain('KeyW');
    expect(MOVE_BINDINGS.back).toContain('KeyS');
    expect(MOVE_BINDINGS.left).toContain('KeyA');
    expect(MOVE_BINDINGS.right).toContain('KeyD');
  });

  it('includes interact on E and lists it among bound codes', () => {
    expect(INTERACT_KEYS).toContain('KeyE');
    expect(BOUND_KEY_CODES.has('KeyE')).toBe(true);
  });

  it('never binds Tab, so keyboard focus navigation keeps working', () => {
    expect(BOUND_KEY_CODES.has('Tab')).toBe(false);
  });
});
