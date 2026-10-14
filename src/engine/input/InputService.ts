import { shouldQueueAction } from './interactPolicy';
import { KeyBindings } from './keyBindings';
import { KeyboardState } from './KeyboardState';
import { addMoveInputs, applyDeadzone, clampMagnitude, NO_MOVE, type MoveInput } from './moveInput';
import { QueuedPress } from './QueuedPress';

/** Everything the player asked for since the last frame. Read once per update, then reset. */
export interface InputFrame {
  /** Walk intent, camera space. Keyboard and joystick combined, length at most 1. */
  readonly move: MoveInput;
  /** Hold either Shift key to run; cleared on blur, pause and dialogue. */
  readonly sprintHeld: boolean;
  /** Camera yaw change in radians from a horizontal drag on the canvas. */
  readonly yawDelta: number;
  /** Camera distance change in meters since the last frame. Negative zooms in. */
  readonly zoomDelta: number;
  /** True only on the frame an interact press began. */
  readonly interactPressed: boolean;
  /** True only on the frame a lantern toggle press began (Q key or the touch button). */
  readonly lanternPressed: boolean;
}

/** Radians per pixel of horizontal drag. 0.008 rad ≈ 0.46° per pixel. */
const YAW_PER_PIXEL = 0.008;
/** Meters per wheel pixel. */
const WHEEL_ZOOM_PER_PIXEL = 0.05;
/** Meters per pixel of pinch change. */
const PINCH_ZOOM_PER_PIXEL = 0.15;
/** Approximate line height used when a browser reports wheel deltas in lines instead of pixels. */
const WHEEL_LINE_HEIGHT_PX = 16;
/** How long a press waits for the next frame before it is dropped. Frames come every ~16 ms, so this only matters after a stall. */
const PRESS_TTL_MS = 250;

interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Turns browser events into one `InputFrame` per update. Owns no game state and knows nothing about
 * the player or camera. Movement and camera code consume its output.
 *
 * - Keyboard: WASD and arrows on window. Ignored while typing in a form field.
 * - Canvas drag (mouse or touch): horizontal drag rotates the camera. Two fingers pinch to zoom.
 * - Canvas wheel: zoom.
 * - Joystick and interact button: call `setStick` and `pressInteract` from the HUD.
 * - Blockers: while any blocker is active (dialogue, crafting, pause), gameplay input reads as neutral.
 */
export class InputService {
  private readonly bindingsTable: KeyBindings;
  private readonly keys: KeyboardState;
  private readonly blockers = new Set<string>();
  private readonly activePointers = new Map<number, ScreenPoint>();
  private readonly cleanups: Array<() => void> = [];
  private readonly canvas: HTMLCanvasElement;

  private stick: MoveInput = NO_MOVE;
  private pendingYaw = 0;
  private pendingZoom = 0;
  private pinchDistance: number | null = null;
  private readonly interactPress = new QueuedPress(PRESS_TTL_MS);
  private readonly lanternPress = new QueuedPress(PRESS_TTL_MS);

  constructor(canvas: HTMLCanvasElement, bindings: KeyBindings = new KeyBindings()) {
    this.canvas = canvas;
    this.bindingsTable = bindings;
    this.keys = new KeyboardState(bindings);
    // Focusable, so the canvas can take keyboard focus after a click or tap.
    canvas.tabIndex = 0;

    this.bind(window, 'keydown', this.onKeyDown);
    this.bind(window, 'keyup', this.onKeyUp);
    this.bind(window, 'blur', this.resetTransientInput);
    this.bind(document, 'visibilitychange', this.onVisibilityChange);

    this.bind(canvas, 'pointerdown', this.onPointerDown);
    this.bind(canvas, 'pointermove', this.onPointerMove);
    this.bind(canvas, 'pointerup', this.onPointerEnd);
    this.bind(canvas, 'pointercancel', this.onPointerEnd);
    this.bind(canvas, 'wheel', this.onWheel, { passive: false });
  }

  /** The live key map. The pause menu changes it, and the HUD shows its labels. */
  get bindings(): KeyBindings {
    return this.bindingsTable;
  }

  /** True while at least one blocker is active. */
  get isBlocked(): boolean {
    return this.blockers.size > 0;
  }

  /**
   * Blocks gameplay input for `id` (for example "dialogue" or "crafting"). Held keys and drags are
   * dropped so nothing keeps moving behind the modal. Blockers are counted by name, so repeated
   * pushes need matching pops.
   */
  pushBlocker(id: string): void {
    this.blockers.add(id);
    this.resetTransientInput();
  }

  popBlocker(id: string): void {
    this.blockers.delete(id);
  }

  /** Joystick vector. `x` is right, `y` is forward. Values are clamped and deadzoned in `frame()`. */
  setStick(stick: MoveInput): void {
    this.stick = clampMagnitude(stick);
  }

  /** Queues one interact press. Also called by the touch interact button. */
  pressInteract(): void {
    if (!this.isBlocked) {
      this.interactPress.queue(performance.now());
    }
  }

  /** Queues one lantern toggle. Also called by the touch lantern button. */
  pressLantern(): void {
    if (!this.isBlocked) {
      this.lanternPress.queue(performance.now());
    }
  }

  /** Reads and resets the per-frame input. Call exactly once per update. */
  frame(): InputFrame {
    const blocked = this.isBlocked;
    const keyboard = this.keys.moveVector();
    const move = blocked ? NO_MOVE : addMoveInputs(keyboard, applyDeadzone(this.stick));
    // Take both presses every frame, even when blocked, so a stale one cannot fire later.
    const now = performance.now();
    const interactTaken = this.interactPress.take(now);
    const lanternTaken = this.lanternPress.take(now);
    const frame: InputFrame = {
      move,
      sprintHeld: !blocked && (this.keys.isPressed('ShiftLeft') || this.keys.isPressed('ShiftRight')),
      yawDelta: blocked ? 0 : this.pendingYaw,
      zoomDelta: blocked ? 0 : this.pendingZoom,
      interactPressed: !blocked && interactTaken,
      lanternPressed: !blocked && lanternTaken,
    };
    this.pendingYaw = 0;
    this.pendingZoom = 0;
    return frame;
  }

  dispose(): void {
    for (const cleanup of this.cleanups.splice(0)) {
      cleanup();
    }
    this.resetTransientInput();
  }

  /** Drops everything that should not survive a focus change: held keys, joystick, drags, queued presses. */
  private readonly resetTransientInput = (): void => {
    this.keys.clear();
    this.stick = NO_MOVE;
    this.activePointers.clear();
    this.pinchDistance = null;
    this.pendingYaw = 0;
    this.pendingZoom = 0;
    this.interactPress.clear();
    this.lanternPress.clear();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    // Typing in a HUD field must not walk the player.
    if (isEditableTarget(event.target)) {
      return;
    }
    // Leave browser shortcuts (Ctrl+S, Cmd+D, ...) alone.
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (!this.bindingsTable.boundCodes().has(event.code) && event.code !== 'ShiftLeft' && event.code !== 'ShiftRight') {
      return;
    }
    // Read before our own preventDefault below, so "already handled by UI" means handled by someone else.
    const handledByUi = event.defaultPrevented;
    // Stop arrow keys from scrolling the page.
    event.preventDefault();
    const press = { code: event.code, repeat: event.repeat, defaultPrevented: handledByUi };
    if (shouldQueueAction(this.bindingsTable.codesFor('interact'), press, this.isBlocked)) {
      this.interactPress.queue(performance.now());
    }
    if (shouldQueueAction(this.bindingsTable.codesFor('lantern'), press, this.isBlocked)) {
      this.lanternPress.queue(performance.now());
    }
    this.keys.press(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    // Always release, whatever the map says now. A key remapped while held must not stay pressed.
    this.keys.release(event.code);
  };

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      this.resetTransientInput();
    }
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.isBlocked) {
      return;
    }
    this.canvas.focus({ preventScroll: true });
    this.canvas.setPointerCapture(event.pointerId);
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.pinchDistance = null;
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const previous = this.activePointers.get(event.pointerId);
    if (!previous) {
      return;
    }
    const current = { x: event.clientX, y: event.clientY };
    this.activePointers.set(event.pointerId, current);

    if (this.activePointers.size === 1) {
      this.pendingYaw += (current.x - previous.x) * YAW_PER_PIXEL;
      return;
    }
    if (this.activePointers.size === 2) {
      const [a, b] = [...this.activePointers.values()];
      if (!a || !b) {
        return;
      }
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinchDistance !== null) {
        // Fingers moving apart (positive change) zoom in, so the delta is negative.
        this.pendingZoom += (this.pinchDistance - distance) * PINCH_ZOOM_PER_PIXEL;
      }
      this.pinchDistance = distance;
    }
  };

  private readonly onPointerEnd = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId);
    this.pinchDistance = null;
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    if (this.isBlocked) {
      return;
    }
    const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? WHEEL_LINE_HEIGHT_PX : 1;
    this.pendingZoom += event.deltaY * scale * WHEEL_ZOOM_PER_PIXEL;
  };

  private bind<E extends Event>(
    target: EventTarget,
    type: string,
    listener: (event: E) => void,
    options?: AddEventListenerOptions,
  ): void {
    const handler = listener as EventListener;
    target.addEventListener(type, handler, options);
    this.cleanups.push(() => target.removeEventListener(type, handler, options));
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}
