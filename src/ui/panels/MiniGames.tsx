import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { GameApp } from '../../app/GameApp';
import { t } from '../../content';
import type { MiniGameView } from '../../domain/GameSession';
import { playSfx } from '../../shared/audio/sfx';

/**
 * The two crafting minigames, drawn as HTML placeholders for now. They send each action to the session and draw
 * the result. The session decides the outcome, so these views hold no rules of their own.
 *
 * Both work with mouse, touch and keyboard: the assembly takes tap-to-select then tap-to-fit, or a drag. The
 * engraving marks are plain buttons.
 */

/** A pointer that moves less than this is a tap, not a drag. */
const DRAG_THRESHOLD_PX = 8;
/** A keyboard or assistive click has no position. It fits at this offset: a good fit, not a perfect one. */
const KEYBOARD_OFFSET = 0.5;
/** How long a snap or miss stays on screen. */
const FEEDBACK_MS = 450;

/** Socket centres in percent of the frame, one per socket in order. Placeholder layout for the two sockets. */
const SOCKET_POSITIONS = [
  { left: '50%', top: '24%' },
  { left: '50%', top: '70%' },
] as const;

/** Mark centres in percent of the ring. Placeholder layout for the three marks, in display order. */
const MARK_POSITIONS = [
  { x: 50, y: 18 },
  { x: 22, y: 72 },
  { x: 78, y: 72 },
] as const;

type AssemblyView = Extract<MiniGameView, { kind: 'assembly' }>;
type EngravingView = Extract<MiniGameView, { kind: 'engraving' }>;

export function MiniGame({ game, view }: { readonly game: GameApp; readonly view: MiniGameView }) {
  // The lantern in the world turns a quarter at a time, so the player can see every side of it while fitting or engraving.
  const turn = (
    <button type="button" className="minigame-turn" onClick={() => game.craft.rotate(90)}>
      {t('ui.minigame.turn')}
    </button>
  );
  if (view.kind === 'assembly') {
    return (
      <>
        <AssemblyGame game={game} view={view} />
        {turn}
      </>
    );
  }
  if (view.kind === 'engraving') {
    return (
      <>
        <EngravingGame game={game} view={view} />
        {turn}
      </>
    );
  }
  // A confirm-only recipe completes when it begins, so there is nothing to draw.
  return null;
}

/** A short haptic tap on phones that support it. Desktop browsers ignore it. */
function buzz(): void {
  if ('vibrate' in navigator) {
    navigator.vibrate(12);
  }
}

/** The offset of a point from a circular target's centre, in radii: 0 is the centre and 1 is the edge. */
function offsetFromPoint(target: HTMLElement | undefined, x: number, y: number): number {
  if (!target) {
    return KEYBOARD_OFFSET;
  }
  const rect = target.getBoundingClientRect();
  const radius = rect.width / 2;
  if (radius <= 0) {
    return KEYBOARD_OFFSET;
  }
  return Math.hypot(x - (rect.left + radius), y - (rect.top + radius)) / radius;
}

function AssemblyGame({ game, view }: { readonly game: GameApp; readonly view: AssemblyView }) {
  const [selected, setSelected] = useState(false);
  const [drag, setDrag] = useState<{ readonly x: number; readonly y: number } | null>(null);
  const [miss, setMiss] = useState(false);
  const [snappedId, setSnappedId] = useState<string | null>(null);
  const socketElements = useRef(new Map<string, HTMLButtonElement>());
  const pointer = useRef<{ readonly id: number; readonly x: number; readonly y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  // Each snap and miss gets its own short feedback, then clears.
  useEffect(() => {
    if (!miss && !snappedId) {
      return;
    }
    const timer = window.setTimeout(() => {
      setMiss(false);
      setSnappedId(null);
    }, FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [miss, snappedId]);

  const finished = view.status === 'complete';
  const fitted = view.sockets.filter((socket) => socket.filled).length;
  const open = view.sockets.filter((socket) => !socket.filled);

  const fit = (socketId: string, offset: number) => {
    const step = game.session.assemblyPlace(socketId, offset);
    if (step.ok) {
      setSnappedId(socketId);
      setSelected(false);
      buzz();
      playSfx(step.status === 'complete' ? 'chime' : 'snap');
    } else if (step.reason === 'miss') {
      setMiss(true);
      playSfx('miss');
    }
    // A socket that is already filled, or a finished frame, shows its state already. Nothing more to draw.
  };

  const fitByClick = (socketId: string, event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!selected) {
      return;
    }
    // detail is 0 for keyboard and assistive clicks, which carry no position.
    const offset = event.detail === 0 ? KEYBOARD_OFFSET : offsetFromPoint(socketElements.current.get(socketId), event.clientX, event.clientY);
    fit(socketId, offset);
  };

  const onPartDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    // A new press starts clean. A drag that ended off the token leaves no click behind to suppress.
    suppressClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPartMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = pointer.current;
    if (!start || start.id !== event.pointerId) {
      return;
    }
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) {
      return;
    }
    start.moved = true;
    setDrag({ x: dx, y: dy });
  };

  const onPartUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = pointer.current;
    if (!start || start.id !== event.pointerId) {
      return;
    }
    pointer.current = null;
    setDrag(null);
    if (!start.moved) {
      // A tap. The click that follows toggles the selection.
      return;
    }
    // A drag. Its click must not toggle the selection too.
    suppressClick.current = true;
    const nearest = nearestOpenSocket(event.clientX, event.clientY, open.map((socket) => socket.id), socketElements.current);
    if (nearest) {
      fit(nearest.id, nearest.offset);
    }
  };

  const onPartClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setSelected((value) => !value);
  };

  return (
    <div className="minigame assembly">
      <p>{t('ui.minigame.assembly.instruction')}</p>
      <div className="frame" role="group" aria-label={t('ui.minigame.assembly.title')}>
        {view.sockets.map((socket, index) => (
          <button
            key={socket.id}
            ref={(element) => {
              if (element) {
                socketElements.current.set(socket.id, element);
              } else {
                socketElements.current.delete(socket.id);
              }
            }}
            type="button"
            className={['socket', socket.filled ? 'filled' : '', socket.id === snappedId ? 'snapped' : '', selected && !socket.filled ? 'target' : '']
              .filter(Boolean)
              .join(' ')}
            style={SOCKET_POSITIONS[index]}
            disabled={socket.filled || finished}
            aria-label={`${t('ui.minigame.assembly.socket', { index: String(index + 1) })}${socket.filled ? `, ${t('ui.minigame.assembly.filled')}` : ''}`}
            onClick={(event) => fitByClick(socket.id, event)}
          />
        ))}
      </div>
      {open.length > 0 ? (
        <button
          type="button"
          className={`part-token${selected ? ' selected' : ''}`}
          aria-pressed={selected}
          style={drag ? { transform: `translate(${drag.x}px, ${drag.y}px)` } : undefined}
          onPointerDown={onPartDown}
          onPointerMove={onPartMove}
          onPointerUp={onPartUp}
          onPointerCancel={() => {
            pointer.current = null;
            setDrag(null);
          }}
          onClick={onPartClick}
        >
          {t('ui.minigame.assembly.part')}
        </button>
      ) : null}
      <p className="minigame-status" aria-live="polite">
        {miss
          ? t('ui.minigame.assembly.miss')
          : selected
            ? t('ui.minigame.assembly.selected')
            : t('ui.minigame.assembly.progress', { count: String(fitted), total: String(view.sockets.length) })}
      </p>
    </div>
  );
}

/** The open socket nearest the drop point, with its offset in radii. Null only when nothing is open. */
function nearestOpenSocket(
  x: number,
  y: number,
  openIds: readonly string[],
  elements: ReadonlyMap<string, HTMLButtonElement>,
): { readonly id: string; readonly offset: number } | null {
  let best: { readonly id: string; readonly distance: number; readonly offset: number } | null = null;
  for (const id of openIds) {
    const element = elements.get(id);
    if (!element) {
      continue;
    }
    const offset = offsetFromPoint(element, x, y);
    const rect = element.getBoundingClientRect();
    const distance = Math.hypot(x - (rect.left + rect.width / 2), y - (rect.top + rect.height / 2));
    if (!best || distance < best.distance) {
      best = { id, distance, offset };
    }
  }
  if (!best) {
    return null;
  }
  // Past the snap edge a drop counts as a miss. Infinity tells the session so, and fits nothing.
  return { id: best.id, offset: best.offset <= 1 ? best.offset : Infinity };
}

function EngravingGame({ game, view }: { readonly game: GameApp; readonly view: EngravingView }) {
  const [wrongId, setWrongId] = useState<string | null>(null);

  useEffect(() => {
    if (!wrongId) {
      return;
    }
    const timer = window.setTimeout(() => setWrongId(null), FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [wrongId]);

  const finished = view.status === 'complete';
  const lit = view.marks.filter((mark) => mark.step !== null).sort((a, b) => (a.step ?? 0) - (b.step ?? 0));
  const positionOf = (markId: string) => {
    const index = view.marks.findIndex((mark) => mark.id === markId);
    return MARK_POSITIONS[index] ?? { x: 50, y: 50 };
  };

  const tap = (markId: string) => {
    const step = game.session.engravingTap(markId);
    if (step.ok) {
      buzz();
      playSfx(step.status === 'complete' ? 'chime' : 'snap');
    } else if (step.reason === 'wrong_mark') {
      setWrongId(markId);
      playSfx('wrong');
    }
  };

  return (
    <div className="minigame engraving">
      <p>{t('ui.minigame.engraving.instruction')}</p>
      <div className="ring">
        <svg className="ring-light" viewBox="0 0 100 100" aria-hidden="true">
          {lit.length > 1 ? <polyline points={lit.map((mark) => `${positionOf(mark.id).x},${positionOf(mark.id).y}`).join(' ')} /> : null}
        </svg>
        {view.marks.map((mark, index) => {
          const position = MARK_POSITIONS[index] ?? { x: 50, y: 50 };
          const isLit = mark.step !== null;
          return (
            <button
              key={mark.id}
              type="button"
              className={['mark', isLit ? 'lit' : '', wrongId === mark.id ? 'wrong' : ''].filter(Boolean).join(' ')}
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
              disabled={finished || isLit}
              aria-pressed={isLit}
              onClick={() => tap(mark.id)}
            >
              <span>{t(mark.symbolKey)}</span>
              {isLit ? <span className="mark-check" aria-hidden="true">✓</span> : null}
            </button>
          );
        })}
      </div>
      <p className="minigame-status" aria-live="polite">
        {wrongId ? t('ui.minigame.engraving.wrong') : t('ui.minigame.engraving.progress', { count: String(lit.length), total: String(view.marks.length) })}
      </p>
    </div>
  );
}
