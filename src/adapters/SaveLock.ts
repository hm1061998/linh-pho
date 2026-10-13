/**
 * Keeps one tab at a time in charge of the save. Two tabs that both write would overwrite each other's progress. The
 * Web Locks API gives one lock per origin, and the browser releases it when its tab closes, so a crashed tab never
 * leaves the lock held.
 */

export const SAVE_LOCK_NAME = 'linh-pho-save';

/** Gives the save lock back. Calling it again does nothing. */
export type ReleaseSaveLock = () => void;

/** The browser's lock manager, or null where the Web Locks API is missing. Without it, tabs are not kept apart. */
export function browserLocks(): LockManager | null {
  return typeof navigator !== 'undefined' && navigator.locks ? navigator.locks : null;
}

/**
 * Waits until this tab owns the save, then resolves with the function that gives it up. If another tab holds the lock,
 * `onWaiting` runs once, and the wait goes on until that tab closes. The wait ends with a rejection if `signal` aborts,
 * and then the tab never takes the lock.
 */
export function acquireSaveLock(locks: LockManager, signal: AbortSignal, onWaiting: () => void): Promise<ReleaseSaveLock> {
  return new Promise<ReleaseSaveLock>((resolve, reject) => {
    // Holds the lock until the returned function is called. The lock is granted only once `resolve` has run.
    const hold = () =>
      new Promise<void>((release) => {
        let released = false;
        resolve(() => {
          if (!released) {
            released = true;
            release();
          }
        });
      });
    locks
      .request(SAVE_LOCK_NAME, { ifAvailable: true }, (lock) => {
        if (lock) {
          return hold();
        }
        onWaiting();
        return locks.request(SAVE_LOCK_NAME, { signal }, () => hold());
      })
      .catch(reject);
  });
}
