import { useSyncExternalStore } from 'react';
import type { GameApp } from '../../app/GameApp';
import type { KeyMap } from '../../domain/input/keyMap';

/** The live key map. The HUD shows its labels, so they update the moment the player changes a key. */
export function useKeyMap(game: GameApp): KeyMap {
  return useSyncExternalStore(
    (listener) => game.input.bindings.subscribe(listener),
    () => game.input.bindings.current,
  );
}
