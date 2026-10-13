import { describe, expect, it } from 'vitest';
import { actionFor, assignKey, cleanKeyMap, codesFor, DEFAULT_KEY_MAP, isReservedCode, keyLabel, REMAP_ACTIONS } from '../domain/input/keyMap';

describe('key map', () => {
  it('gives each action its own key by default', () => {
    const keys = Object.values(DEFAULT_KEY_MAP);
    expect(new Set(keys).size).toBe(REMAP_ACTIONS.length);
  });

  it('keeps the arrows on the four moves, whatever the primary key is', () => {
    const map = { ...DEFAULT_KEY_MAP, forward: 'KeyT' };
    expect(codesFor('forward', map)).toEqual(['KeyT', 'ArrowUp']);
    expect(codesFor('interact', map)).toEqual([map.interact]);
  });

  it('finds the action a key triggers, and null for a key that does nothing', () => {
    expect(actionFor('KeyI', DEFAULT_KEY_MAP)).toBe('inventory');
    expect(actionFor('ArrowLeft', DEFAULT_KEY_MAP)).toBe('left');
    expect(actionFor('KeyZ', DEFAULT_KEY_MAP)).toBeNull();
  });

  it('gives a key to an action', () => {
    const next = assignKey(DEFAULT_KEY_MAP, 'interact', 'KeyF');
    expect(next).not.toBeNull();
    expect(next?.interact).toBe('KeyF');
    // E was free, so the old interact key is simply no longer used.
    expect(actionFor('KeyE', next ?? DEFAULT_KEY_MAP)).toBeNull();
  });

  it('swaps two actions when the new key is already another action\'s key, so no key is ever shared', () => {
    const next = assignKey(DEFAULT_KEY_MAP, 'interact', 'KeyQ');
    expect(next?.interact).toBe('KeyQ');
    expect(next?.lantern).toBe('KeyE');
    const keys = next ? Object.values(next) : [];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('refuses reserved keys and leaves the map unchanged', () => {
    for (const code of ['Escape', 'Enter', 'Space', 'Tab', 'Backspace', 'F3', 'F12', 'ArrowUp']) {
      expect(assignKey(DEFAULT_KEY_MAP, 'interact', code), code).toBeNull();
    }
  });

  it('accepts a modifier key, which is a real key code', () => {
    expect(assignKey(DEFAULT_KEY_MAP, 'interact', 'ShiftLeft')?.interact).toBe('ShiftLeft');
  });

  it('refuses text that is not a key code', () => {
    expect(assignKey(DEFAULT_KEY_MAP, 'interact', '')).toBeNull();
    expect(assignKey(DEFAULT_KEY_MAP, 'interact', 'Key W')).toBeNull();
    expect(assignKey(DEFAULT_KEY_MAP, 'interact', '<script>')).toBeNull();
  });

  it('keeps the same map when the action already has that key', () => {
    expect(assignKey(DEFAULT_KEY_MAP, 'forward', 'KeyW')).toBe(DEFAULT_KEY_MAP);
  });

  it('reads a saved map, and falls back to the defaults for anything wrong with it', () => {
    expect(cleanKeyMap(undefined)).toEqual(DEFAULT_KEY_MAP);
    expect(cleanKeyMap('KeyW')).toEqual(DEFAULT_KEY_MAP);
    expect(cleanKeyMap({ ...DEFAULT_KEY_MAP, forward: 'Escape' })).toEqual(DEFAULT_KEY_MAP);
    expect(cleanKeyMap({ ...DEFAULT_KEY_MAP, forward: 42 })).toEqual(DEFAULT_KEY_MAP);
    expect(cleanKeyMap({ ...DEFAULT_KEY_MAP, forward: 'KeyE' })).toEqual(DEFAULT_KEY_MAP);
    const { lantern: _missing, ...partial } = DEFAULT_KEY_MAP;
    expect(cleanKeyMap(partial)).toEqual(DEFAULT_KEY_MAP);
  });

  it('keeps a valid saved map as it is', () => {
    const saved = { ...DEFAULT_KEY_MAP, forward: 'KeyT', inventory: 'KeyB' };
    expect(cleanKeyMap(saved)).toEqual(saved);
  });

  it('names the reserved codes, the arrows and the F keys', () => {
    expect(isReservedCode('Escape')).toBe(true);
    expect(isReservedCode('F5')).toBe(true);
    expect(isReservedCode('ArrowDown')).toBe(true);
    expect(isReservedCode('KeyW')).toBe(false);
  });

  it('shows letters and digits without their prefix', () => {
    expect(keyLabel('KeyW')).toBe('W');
    expect(keyLabel('Digit1')).toBe('1');
    expect(keyLabel('ShiftLeft')).toBe('ShiftLeft');
  });
});
