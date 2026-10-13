import { useEffect, useRef } from 'react';
import type { GameApp } from '../../app/GameApp';
import { speakerName, t } from '../../content';
import { useDialogueView } from '../state/useGameplayState';

/**
 * Dialogue card at the bottom of the screen. It draws the line that `DialogueSystem` describes and sends
 * the player's choices back. It contains no story logic.
 *
 * Input: tap the text to continue, press E, Enter, or Space to continue (unless a button has focus),
 * pick a choice with a tap or click, and close with Escape or the close button.
 */
export function DialoguePanel({ game }: { readonly game: GameApp }) {
  const view = useDialogueView(game);
  const dialogue = game.dialogue;
  const panelRef = useRef<HTMLElement>(null);
  const isOpen = view !== null;

  // Move focus into the card when it opens, so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (isOpen) {
      panelRef.current?.focus({ preventScroll: true });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      // Ignore held keys so one press does not skip several lines.
      if (event.repeat) {
        return;
      }
      if (event.code === 'Escape') {
        event.preventDefault();
        dialogue.close('dismissed');
        return;
      }
      // A focused button handles Enter and Space itself (choose or close).
      if (event.target instanceof HTMLButtonElement) {
        return;
      }
      if (event.code === 'KeyE' || event.code === 'Enter' || event.code === 'Space') {
        event.preventDefault();
        dialogue.advance();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, dialogue]);

  if (!view) {
    return null;
  }

  const continueByTap = () => {
    if (view.canContinue) {
      dialogue.advance();
    }
  };

  return (
    <section
      ref={panelRef}
      className="dialogue-panel"
      role="dialog"
      aria-modal="true"
      aria-label={t('ui.dialogue.label')}
      tabIndex={-1}
    >
      <header className="dialogue-header">
        <h2 className="dialogue-speaker">{speakerName(view.speakerId)}</h2>
        <button type="button" className="dialogue-close" onClick={() => dialogue.close('dismissed')}>
          {t('ui.dialogue.close')}
        </button>
      </header>

      <div className="dialogue-body" onClick={continueByTap}>
        <p className="dialogue-text" aria-live="polite">
          {t(view.textKey)}
        </p>
        {view.choices.length > 0 ? (
          <ul className="dialogue-choices">
            {view.choices.map((choice) => (
              <li key={choice.index}>
                <button type="button" onClick={() => dialogue.choose(choice.index)}>
                  {t(choice.textKey)}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="dialogue-hint">{t('ui.dialogue.continue')}</p>
        )}
      </div>
    </section>
  );
}
