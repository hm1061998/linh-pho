import type { AnimTrack, Entity } from 'playcanvas';

/**
 * Plays one clip on a model, looping. The clip's node paths resolve against `root`, so pass the entity that
 * `AssetLoader.instantiateLoaded` returned. Call once per model: a second call adds the same state again.
 */
export function playLoop(root: Entity, name: string, track: AnimTrack): void {
  root.addComponent('anim', { activate: true });
  root.anim?.assignAnimation(name, track, undefined, 1, true);
}

/**
 * Plays several looping clips on one model, and switches between them. `set` with the clip already playing does nothing,
 * so it can be called every frame.
 */
export function startStates(
  root: Entity,
  clips: Readonly<Record<string, AnimTrack>>,
  start: string,
): { set(state: string, speed?: number): void } {
  root.addComponent('anim', { activate: true });
  const anim = root.anim;
  for (const [name, track] of Object.entries(clips)) {
    anim?.assignAnimation(name, track, undefined, 1, true);
  }
  let current = start;
  anim?.baseLayer?.play(start);
  return {
    set(state: string, speed = 1): void {
      if (!anim || !(state in clips)) {
        return;
      }
      anim.speed = speed;
      if (state === current) {
        return;
      }
      current = state;
      anim.baseLayer?.transition(state, 0.2);
    },
  };
}
