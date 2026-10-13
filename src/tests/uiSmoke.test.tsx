// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { GameApp } from '../app/GameApp';
import { GAME_CONTENT } from '../content';
import { GameSession } from '../domain/GameSession';
import { InteractionSystem } from '../engine/interaction/InteractionSystem';
import { DialoguePanel } from '../ui/dialogue/DialoguePanel';
import { CurrencyBar, QuestTracker } from '../ui/hud/HudBars';
import { StartupErrorPanel } from '../ui/hud/StartupErrorPanel';
import { PanelHost } from '../ui/panels/PanelHost';

/**
 * Smoke tests for the HUD. They render the real components against a real session. The game object is a stand-in
 * with only what these components read: the session, the dialogue, the interaction system, and an input service that
 * ignores everything. PlayCanvas is not loaded, so these tests run in plain jsdom.
 */

afterEach(() => {
  cleanup();
});

function newSession(): GameSession {
  const session = new GameSession(GAME_CONTENT);
  session.start();
  return session;
}

function gameFor(session: GameSession): GameApp {
  const input = {
    isBlocked: false,
    pushBlocker: () => undefined,
    popBlocker: () => undefined,
    pressInteract: () => undefined,
    pressLantern: () => undefined,
    setStick: () => undefined,
  };
  return { session, dialogue: session.dialogue, interaction: new InteractionSystem(), input } as unknown as GameApp;
}

describe('launch: the startup panel says what went wrong and offers a reload', () => {
  it('explains a missing WebGL2 in Vietnamese, with a reload button', () => {
    render(<StartupErrorPanel reason="webgl2_unavailable" />);
    expect(screen.getByRole('heading', { name: 'Không thể mở Linh Phố' })).toBeTruthy();
    expect(screen.getByText(/WebGL2/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tải lại trang' })).toBeTruthy();
  });

  it('shows a message for an engine failure and for an unknown one', () => {
    const { unmount } = render(<StartupErrorPanel reason="engine_init_failed" />);
    expect(screen.getByText(/engine đồ họa/)).toBeTruthy();
    unmount();
    render(<StartupErrorPanel reason="unknown" />);
    expect(screen.getByText(/không xác định/)).toBeTruthy();
  });
});

describe('HUD: currency and quest progress', () => {
  it('shows the coins and reputation, starting at zero', () => {
    const game = gameFor(newSession());
    render(<CurrencyBar game={game} />);
    expect(screen.getByText(/Xu Đèn/)).toBeTruthy();
    expect(screen.getByText(/Uy Tín/)).toBeTruthy();
  });

  it('shows the first quest and its objectives, and the count moves as a pickup is taken', () => {
    const session = newSession();
    const game = gameFor(session);
    render(<QuestTracker game={game} />);
    expect(screen.getByText('Đêm Mở Chợ')).toBeTruthy();
    expect(screen.getByText(/Nhặt 2 tre ở vườn tre \(0\/2\)/)).toBeTruthy();

    act(() => {
      session.collectPickup('pk_bamboo_1');
    });
    expect(screen.getByText(/Nhặt 2 tre ở vườn tre \(1\/2\)/)).toBeTruthy();
  });
});

describe('dialogue: a conversation shows its speaker and its first line', () => {
  it('opens Bà Nghiêm\'s greeting when the dialogue starts', () => {
    const session = newSession();
    const game = gameFor(session);
    render(<DialoguePanel game={game} />);
    act(() => {
      session.dialogue.start('dlg_ba_nghiem');
    });
    expect(screen.getByText(/Con đến rồi à/)).toBeTruthy();
  });
});

describe('inventory: the panel lists what the player carries', () => {
  it('lists collected items and closes from its close button', () => {
    const session = newSession();
    const game = gameFor(session);
    act(() => {
      session.collectPickup('pk_bamboo_1');
      session.openPanel({ kind: 'inventory' });
    });
    render(<PanelHost game={game} />);
    expect(screen.getByRole('heading', { name: 'Kho đồ' })).toBeTruthy();
    expect(screen.getByText('Tre')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(session.currentPanel).toBeNull();
  });

  it('says the inventory is empty when nothing is carried', () => {
    const session = newSession();
    act(() => {
      session.openPanel({ kind: 'inventory' });
    });
    render(<PanelHost game={gameFor(session)} />);
    expect(screen.getByText('Kho đang trống.')).toBeTruthy();
  });
});
