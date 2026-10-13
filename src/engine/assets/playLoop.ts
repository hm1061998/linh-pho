import type { AnimTrack, Entity } from 'playcanvas';

/**
 * Plays one clip on a model, looping. The clip's node paths resolve against `root`, so pass the entity that
 * `AssetLoader.instantiateLoaded` returned. Call once per model: a second call adds the same state again.
 */
export function playLoop(root: Entity, name: string, track: AnimTrack): void {
  root.addComponent('anim', { activate: true });
  root.anim?.assignAnimation(name, track, undefined, 1, true);
}
