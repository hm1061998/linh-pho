import { useSyncExternalStore } from 'react';

/**
 * Whether the pause menu is open. This is UI state, not game state: pausing does not change the session, and it is
 * never saved. The pause menu and the HUD's menu button share it.
 */

let paused = false;
const listeners = new Set<() => void>();

export function isPaused(): boolean {
  return paused;
}

export function setPaused(value: boolean): void {
  if (value === paused) {
    return;
  }
  paused = value;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePaused(): boolean {
  return useSyncExternalStore(subscribe, isPaused);
}
