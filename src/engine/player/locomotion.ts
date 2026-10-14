export type LocomotionState = 'idle' | 'walk' | 'run';

/** Select from actual travel: walls stop the feet, Shift alone never starts running. */
export function locomotionState(
  speed: number,
  walkSpeed: number,
  current: LocomotionState,
  sprintHeld: boolean,
  hasRunClip: boolean,
): LocomotionState {
  if (speed <= (current === 'idle' ? 0.3 : 0.15)) return 'idle';
  const running = current === 'run';
  if (hasRunClip && (sprintHeld || running) && speed > walkSpeed * (running ? 1.15 : 1.5)) return 'run';
  return 'walk';
}
