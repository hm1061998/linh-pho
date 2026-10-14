import { describe, expect, it } from 'vitest';
import { QueuedPress } from '../engine/input/QueuedPress';

describe('QueuedPress', () => {
  const TTL = 250;

  it('reports nothing when no press is queued', () => {
    const press = new QueuedPress(TTL);
    expect(press.take(0)).toBe(false);
  });

  it('takes a fresh press once, then reports nothing', () => {
    const press = new QueuedPress(TTL);
    press.queue(100);
    expect(press.take(110)).toBe(true);
    expect(press.take(111)).toBe(false);
  });

  it('keeps a press that is exactly at the limit', () => {
    const press = new QueuedPress(TTL);
    press.queue(0);
    expect(press.take(TTL)).toBe(true);
  });

  it('drops a press that waited longer than the limit', () => {
    const press = new QueuedPress(TTL);
    press.queue(0);
    expect(press.take(TTL + 1)).toBe(false);
  });

  it('measures from the latest press, so a repeat refreshes the window', () => {
    const press = new QueuedPress(TTL);
    press.queue(0);
    press.queue(200);
    expect(press.take(400)).toBe(true);
  });

  it('empties the queue when a stale press is dropped, so a later frame does not revive it', () => {
    const press = new QueuedPress(TTL);
    press.queue(0);
    expect(press.take(1000)).toBe(false);
    expect(press.take(1001)).toBe(false);
  });

  it('clear drops a pending press', () => {
    const press = new QueuedPress(TTL);
    press.queue(0);
    press.clear();
    expect(press.take(10)).toBe(false);
  });
});
