import { describe, expect, it } from 'vitest';
import { KeyboardState } from '../engine/input/KeyboardState';
import { KeyBindings } from '../engine/input/keyBindings';
import { DEFAULT_KEY_MAP } from '../domain/input/keyMap';

describe('KeyboardState.moveVector', () => {
  const fresh = () => new KeyboardState(new KeyBindings());

  it('gives the same walk intent for WASD and the arrow keys', () => {
    const wasd = fresh();
    wasd.press('KeyW');
    const arrows = fresh();
    arrows.press('ArrowUp');
    expect(wasd.moveVector()).toEqual(arrows.moveVector());
    expect(wasd.moveVector()).toEqual({ x: 0, y: 1 });
  });

  it('cancels opposite keys', () => {
    const state = fresh();
    state.press('KeyW');
    state.press('KeyS');
    expect(state.moveVector()).toEqual({ x: 0, y: 0 });
  });

  it('normalizes diagonals to unit length', () => {
    const state = fresh();
    state.press('KeyW');
    state.press('KeyD');
    const move = state.moveVector();
    expect(Math.hypot(move.x, move.y)).toBeCloseTo(1);
    expect(move.x).toBeGreaterThan(0);
    expect(move.y).toBeGreaterThan(0);
  });

  it('stops moving after release', () => {
    const state = fresh();
    state.press('KeyA');
    state.release('KeyA');
    expect(state.moveVector()).toEqual({ x: 0, y: 0 });
  });

  it('forgets every held key on clear, so a lost focus cannot leave the player walking', () => {
    const state = fresh();
    state.press('KeyW');
    state.press('KeyD');
    state.clear();
    expect(state.moveVector()).toEqual({ x: 0, y: 0 });
    expect(state.isPressed('KeyW')).toBe(false);
  });

  it('walks on the player\'s own key after a remap, and the old key does nothing', () => {
    const bindings = new KeyBindings({ ...DEFAULT_KEY_MAP, forward: 'KeyI', inventory: 'KeyW' });
    const state = new KeyboardState(bindings);
    state.press('KeyI');
    expect(state.moveVector()).toEqual({ x: 0, y: 1 });
    state.release('KeyI');
    state.press('KeyW');
    expect(state.moveVector()).toEqual({ x: 0, y: 0 });
  });
});

describe('key bindings', () => {
  it('binds every move action to at least WASD or the arrows', () => {
    const bindings = new KeyBindings();
    expect(bindings.codesFor('forward')).toContain('KeyW');
    expect(bindings.codesFor('back')).toContain('KeyS');
    expect(bindings.codesFor('left')).toContain('KeyA');
    expect(bindings.codesFor('right')).toContain('KeyD');
  });

  it('includes interact on E and lists it among bound codes', () => {
    const bindings = new KeyBindings();
    expect(bindings.codesFor('interact')).toContain('KeyE');
    expect(bindings.boundCodes().has('KeyE')).toBe(true);
  });

  it('never binds Tab, so keyboard focus navigation keeps working', () => {
    expect(new KeyBindings().boundCodes().has('Tab')).toBe(false);
  });

  it('tells listeners when the map changes, and stops telling them after unsubscribe', () => {
    const bindings = new KeyBindings();
    let calls = 0;
    const stop = bindings.subscribe(() => calls++);
    bindings.set({ ...DEFAULT_KEY_MAP, interact: 'KeyF' });
    expect(calls).toBe(1);
    expect(bindings.actionFor('KeyF')).toBe('interact');
    stop();
    bindings.set(DEFAULT_KEY_MAP);
    expect(calls).toBe(1);
  });
});
