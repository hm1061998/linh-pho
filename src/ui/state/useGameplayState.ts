import { useEffect, useState } from 'react';
import type { GameApp } from '../../app/GameApp';
import type { DialogueView } from '../../domain/dialogue/DialogueSystem';
import type { FocusedTarget } from '../../engine/interaction/InteractionSystem';

/**
 * React views of gameplay state. Each hook takes its initial value from the system and then follows
 * events. The HUD never polls and never writes into gameplay state.
 */

export function useInteractionFocus(game: GameApp): FocusedTarget | null {
  const [focus, setFocus] = useState<FocusedTarget | null>(() => game.interaction.focus);

  useEffect(
    () =>
      game.interaction.events.on('interaction.focusChanged', (event) => {
        setFocus(event.target);
      }),
    [game],
  );

  return focus;
}

export function useDialogueView(game: GameApp): DialogueView | null {
  const [view, setView] = useState<DialogueView | null>(() => game.dialogue.view);

  useEffect(() => {
    const offOpened = game.dialogue.events.on('dialogue.opened', (event) => setView(event.view));
    const offChanged = game.dialogue.events.on('dialogue.changed', (event) => setView(event.view));
    const offClosed = game.dialogue.events.on('dialogue.closed', () => setView(null));
    return () => {
      offOpened();
      offChanged();
      offClosed();
    };
  }, [game]);

  return view;
}
