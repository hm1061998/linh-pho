/**
 * One button press waiting for the next engine frame. The press is valid only for `ttlMs` after it was queued,
 * so a press that waited through a stall (a long frame, a hidden tab coming back) does not fire late, when the
 * player has already moved on. No DOM, so it can be tested in Node.
 */
export class QueuedPress {
  private queuedAt: number | null = null;
  private readonly ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  /** Queues a press at time `now` (ms). A second press before the frame refreshes the timestamp. */
  queue(now: number): void {
    this.queuedAt = now;
  }

  /**
   * Returns true when a press is queued and still fresh at `now`. Either way the queue is emptied, so a press is
   * taken at most once and a stale one is dropped.
   */
  take(now: number): boolean {
    const queuedAt = this.queuedAt;
    this.queuedAt = null;
    return queuedAt !== null && now - queuedAt <= this.ttlMs;
  }

  /** Drops any queued press. Used when focus is lost or a modal opens. */
  clear(): void {
    this.queuedAt = null;
  }
}
