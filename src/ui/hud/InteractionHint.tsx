import type { GameApp } from '../../app/GameApp';
import { t } from '../../content';
import { useCoarsePointer } from '../state/useCoarsePointer';
import { useDialogueView, useInteractionFocus } from '../state/useGameplayState';

/**
 * Small hint near the bottom of the screen: "E · Talk to Auntie Nghiêm". It appears only when a target is in
 * range and no dialogue is open. Touch devices use the interact button label instead, so the hint stays hidden.
 */
export function InteractionHint({ game }: { readonly game: GameApp }) {
  const focus = useInteractionFocus(game);
  const dialogue = useDialogueView(game);
  const coarse = useCoarsePointer();

  if (!focus || dialogue || coarse) {
    return null;
  }
  return (
    <div className="interaction-hint" role="status">
      <kbd aria-hidden="true">{t('ui.key.interact')}</kbd>
      <span>{t('ui.hint.talk', { name: t(focus.labelKey) })}</span>
    </div>
  );
}
