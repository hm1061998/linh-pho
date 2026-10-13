import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '../shared/events/EventBus';

type Sample =
  | { readonly type: 'ping'; readonly count: number }
  | { readonly type: 'pong'; readonly label: string };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EventBus', () => {
  it('delivers each event only to listeners of its type', () => {
    const bus = new EventBus<Sample>();
    const ping = vi.fn();
    const pong = vi.fn();
    bus.on('ping', ping);
    bus.on('pong', pong);

    bus.emit({ type: 'ping', count: 2 });

    expect(ping).toHaveBeenCalledWith({ type: 'ping', count: 2 });
    expect(pong).not.toHaveBeenCalled();
  });

  it('stops delivering after unsubscribe', () => {
    const bus = new EventBus<Sample>();
    const listener = vi.fn();
    const off = bus.on('ping', listener);

    off();
    bus.emit({ type: 'ping', count: 1 });

    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps delivering to other listeners when one throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const bus = new EventBus<Sample>();
    const after = vi.fn();
    bus.on('ping', () => {
      throw new Error('broken HUD component');
    });
    bus.on('ping', after);

    bus.emit({ type: 'ping', count: 3 });

    expect(after).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalled();
  });

  it('lets a listener unsubscribe during emit without skipping the next listener', () => {
    const bus = new EventBus<Sample>();
    const second = vi.fn();
    let off: () => void = () => {};
    off = bus.on('ping', () => off());
    bus.on('ping', second);

    bus.emit({ type: 'ping', count: 4 });

    expect(second).toHaveBeenCalledTimes(1);
  });
});
