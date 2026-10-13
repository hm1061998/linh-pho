import { useEffect, useState } from 'react';
import type { GameApp } from '../../app/GameApp';
import { t } from '../../content';
import type { SessionSnapshot } from '../../domain/GameSession';

/** Latest session snapshot. Re-reads on every session change, so the HUD never holds stale copies. */
export function useSessionSnapshot(game: GameApp): SessionSnapshot {
  const [snapshot, setSnapshot] = useState(() => game.session.snapshot());

  useEffect(
    () =>
      game.session.events.on('changed', () => {
        setSnapshot(game.session.snapshot());
      }),
    [game],
  );

  return snapshot;
}

/** Turns a notice's keys into text. Params ending in `Key` are locale keys and are translated first. */
export function renderNotice(textKey: string, params: Readonly<Record<string, string>>): string {
  const resolved: Record<string, string> = {};
  for (const [name, value] of Object.entries(params)) {
    if (name.endsWith('Key')) {
      resolved[name.slice(0, -3)] = t(value);
    } else {
      resolved[name] = value;
    }
  }
  return t(textKey, resolved);
}

export function qualityLabel(quality: string | null): string {
  return quality ? t(`quality.${quality}`) : '';
}
