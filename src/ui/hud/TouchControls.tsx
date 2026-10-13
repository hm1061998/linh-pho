import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { InputService } from '../../engine/input/InputService';
import { NO_MOVE } from '../../engine/input/moveInput';

/** Joystick knob travel in CSS pixels from the center to full deflection. */
const JOYSTICK_TRAVEL_PX = 56;
const COARSE_POINTER_QUERY = '(pointer: coarse)';

function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(() => matchesCoarsePointer());

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }
    const query = window.matchMedia(COARSE_POINTER_QUERY);
    const update = () => setCoarse(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return coarse;
}

function matchesCoarsePointer(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(COARSE_POINTER_QUERY).matches;
}

/**
 * Touch-only controls: a virtual joystick on the left and an interact button on the right.
 * They only forward intent to `InputService`. Movement and interaction logic stay in the engine.
 * Keyboard users never see them.
 */
export function TouchControls({ input }: { readonly input: InputService }) {
  const coarse = useCoarsePointer();
  if (!coarse) {
    return null;
  }
  return (
    <div className="touch-controls">
      <Joystick input={input} />
      <button type="button" className="interact-button" onClick={() => input.pressInteract()}>
        Tương tác
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
