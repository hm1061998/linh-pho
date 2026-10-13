import { useEffect, useState } from 'react';
import type { GameApp } from '../../app/GameApp';

/**
 * Frame rate and draw calls, read from the engine's own counters. F3 shows or hides it, in every build. It only shows
 * numbers on screen: nothing is recorded or sent anywhere.
 */
export function StatsOverlay({ game }: { readonly game: GameApp }) {
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState(() => game.stats());

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'F3' && !event.repeat) {
        event.preventDefault();
        setVisible((value) => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setStats(game.stats());
    const timer = window.setInterval(() => setStats(game.stats()), 500);
    return () => window.clearInterval(timer);
  }, [game, visible]);

  if (!visible) {
    return null;
  }
  const models = game.assets.summary();
  return (
    <div className="stats-overlay" aria-hidden="true">
      <div>FPS {Math.round(stats.fps)}</div>
      <div>Draw calls {stats.drawCalls}</div>
      <div>
        Models {models.loaded}/{models.total}
      </div>
    </div>
  );
}
