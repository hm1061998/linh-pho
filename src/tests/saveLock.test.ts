import { describe, expect, it } from 'vitest';
import { acquireSaveLock } from '../adapters/SaveLock';

/**
 * Just enough of the Web Locks API for these tests: one lock, a queue of waiters, `ifAvailable`, and abort. The real
 * browser lock is per origin, so one instance stands for both tabs.
 */
class FakeLocks {
  private held = false;
  private waiting: Array<{ run: () => void }> = [];

  request(_name: string, options: { ifAvailable?: boolean; signal?: AbortSignal }, callback: (lock: object | null) => unknown): Promise<unknown> {
    if (!this.held) {
      return this.grant(callback);
    }
    if (options.ifAvailable) {
      return Promise.resolve(callback(null));
    }
    return new Promise((resolve, reject) => {
      const entry = { run: () => void this.grant(callback).then(resolve, reject) };
      this.waiting.push(entry);
      options.signal?.addEventListener('abort', () => {
        this.waiting = this.waiting.filter((candidate) => candidate !== entry);
        reject(new DOMException('The request was aborted.', 'AbortError'));
      });
    });
  }

  private grant(callback: (lock: object | null) => unknown): Promise<unknown> {
    this.held = true;
    return Promise.resolve()
      .then(() => callback({}))
      .finally(() => {
        this.held = false;
        this.waiting.shift()?.run();
      });
  }
}

const asLockManager = (fake: FakeLocks) => fake as unknown as LockManager;
const turn = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('save lock', () => {
  it('grants the lock at once when no other tab holds it, and does not report a wait', async () => {
    const locks = new FakeLocks();
    let waits = 0;
    const release = await acquireSaveLock(asLockManager(locks), new AbortController().signal, () => waits++);
    expect(waits).toBe(0);
    release();
  });

  it('makes a second tab wait, reports the wait once, and grants the lock when the first tab lets go', async () => {
    const locks = new FakeLocks();
    const first = await acquireSaveLock(asLockManager(locks), new AbortController().signal, () => undefined);

    let waits = 0;
    let secondGranted = false;
    const second = acquireSaveLock(asLockManager(locks), new AbortController().signal, () => waits++).then((release) => {
      secondGranted = true;
      return release;
    });
    await turn();
    expect(waits).toBe(1);
    expect(secondGranted).toBe(false);

    first();
    const secondRelease = await second;
    expect(secondGranted).toBe(true);
    secondRelease();
  });

  it('stops waiting when its signal aborts, and never takes the lock afterwards', async () => {
    const locks = new FakeLocks();
    const first = await acquireSaveLock(asLockManager(locks), new AbortController().signal, () => undefined);

    const controller = new AbortController();
    const second = acquireSaveLock(asLockManager(locks), controller.signal, () => undefined);
    controller.abort();
    await expect(second).rejects.toMatchObject({ name: 'AbortError' });

    // The aborted waiter is gone from the queue, so a third tab gets the lock as soon as the first lets go.
    first();
    const third = await acquireSaveLock(asLockManager(locks), new AbortController().signal, () => undefined);
    third();
  });

  it('releases only once, so a second call from cleanup cannot free a lock a later tab now holds', async () => {
    const locks = new FakeLocks();
    const first = await acquireSaveLock(asLockManager(locks), new AbortController().signal, () => undefined);
    first();
    const second = await acquireSaveLock(asLockManager(locks), new AbortController().signal, () => undefined);
    first();
    // Still held by the second acquisition: a third tab must wait.
    let waits = 0;
    void acquireSaveLock(asLockManager(locks), new AbortController().signal, () => waits++);
    await turn();
    expect(waits).toBe(1);
    second();
  });
});
