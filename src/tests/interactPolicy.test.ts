import { describe, expect, it } from 'vitest';
import { shouldQueueInteract } from '../engine/input/interactPolicy';

const fresh = { code: 'KeyE', repeat: false, defaultPrevented: false };

describe('shouldQueueInteract', () => {
  it('queues a fresh E press while the game is free', () => {
    expect(shouldQueueInteract(fresh, false)).toBe(true);
  });

  it('ignores E while the game is blocked by a dialogue or pause', () => {
    expect(shouldQueueInteract(fresh, true)).toBe(false);
  });

  it('ignores an E press that the UI already handled, so closing a dialogue with E does not reopen it', () => {
    expect(shouldQueueInteract({ ...fresh, defaultPrevented: true }, false)).toBe(false);
  });

  it('ignores auto-repeat from holding the key', () => {
    expect(shouldQueueInteract({ ...fresh, repeat: true }, false)).toBe(false);
  });

  it('ignores keys that are not interact keys', () => {
    expect(shouldQueueInteract({ ...fresh, code: 'KeyW' }, false)).toBe(false);
    expect(shouldQueueInteract({ ...fresh, code: 'Enter' }, false)).toBe(false);
  });
});
