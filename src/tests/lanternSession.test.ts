import { describe, expect, it } from 'vitest';
import { GAME_CONTENT } from '../content';
import { GameSession } from '../domain/GameSession';
import { LANTERN_TRANSITION_S } from '../domain/lantern/LanternPhase';

describe('Đèn Soi Linh visuals in the session', () => {
  it('publishes a change on every frame of a transition, then goes quiet once settled', () => {
    const session = new GameSession(GAME_CONTENT);
    session.start();
    let changes = 0;
    session.events.on('changed', () => {
      changes += 1;
    });

    expect(session.toggleLantern()).toEqual({ ok: true });
    const afterToggle = changes;

    // Glow and tint read spiritAmount, which moves every frame, so each frame must reach the view.
    session.updateLantern(0.1);
    session.updateLantern(0.1);
    expect(changes).toBe(afterToggle + 2);
    expect(session.snapshot().lantern.spiritAmount).toBeGreaterThan(0);
    expect(session.snapshot().lantern.spiritAmount).toBeLessThan(1);

    session.updateLantern(LANTERN_TRANSITION_S);
    expect(session.snapshot().lantern.phase).toBe('spirit');
    const settled = changes;
    expect(settled).toBeGreaterThan(afterToggle + 2);

    // Steady spirit phase: nothing moves, so nothing is published.
    session.updateLantern(0.1);
    expect(changes).toBe(settled);
  });
});
