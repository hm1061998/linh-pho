import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { GameApp } from '../../app/GameApp';
import { t } from '../../content';
import type { InputService } from '../../engine/input/InputService';
import { NO_MOVE } from '../../engine/input/moveInput';
import { useCoarsePointer } from '../state/useCoarsePointer';
import { useDialogueView, useInteractionFocus } from '../state/useGameplayState';

/** Joystick knob travel in CSS pixels from the center to full deflection. */
const JOYSTICK_TRAVEL_PX = 56;

/**
 * Touch-only controls: a virtual joystick on the left and an interact button on the right.
 * They only forward intent to `InputService`. The button label follows the focused target. The whole
 * group hides during dialogue, where the dialogue card has the screen. Keyboard users never see it.
 */
export function TouchControls({ game }: { readonly game: GameApp }) {
  const coarse = useCoarsePointer();
  const focus = useInteractionFocus(game);
  const dialogue = useDialogueView(game);
  if (!coarse || dialogue) {
    return null;
  }
  return (
    <div className="touch-controls">
      <Joystick input={game.input} />
      <button type="button" className="lantern-button" onClick={() => game.input.pressLantern()}>
        {t('ui.lantern.toggle')}
      </button>
      <button type="button" className="interact-button" onClick={() => game.input.pressInteract()}>
        {focus ? t('ui.talk') : t('ui.interact')}
      </button>
    </div>
  );
}

function Joystick({ input }: { readonly input: InputService }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  // Release the stick if the joystick unmounts while held.
  useEffect(() => () => input.setStick(NO_MOVE), [input]);

  const moveKnob = (event: ReactPointerEvent<HTMLDivElement>) => {
    const base = baseRef.current;
    if (!base) {
      return;
    }
    const rect = base.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy);
    const scale = length > JOYSTICK_TRAVEL_PX ? JOYSTICK_TRAVEL_PX / length : 1;
    const knobX = dx * scale;
    const knobY = dy * scale;
    setKnob({ x: knobX, y: knobY });
    // Screen Y grows downward, but forward in the game is up, so Y is flipped.
    input.setStick({ x: knobX / JOYSTICK_TRAVEL_PX, y: -knobY / JOYSTICK_TRAVEL_PX });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    activePointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    moveKnob(event);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointer.current === event.pointerId) {
      moveKnob(event);
    }
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) {
      return;
    }
    activePointer.current = null;
    setKnob({ x: 0, y: 0 });
    input.setStick(NO_MOVE);
  };

  return (
    <div
      ref={baseRef}
      className="joystick"
      aria-hidden="true"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <div className="joystick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}
