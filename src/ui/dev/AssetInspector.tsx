import { useEffect, useReducer, useState } from 'react';
import type { Entity } from 'playcanvas';
import type { GameApp } from '../../app/GameApp';
import type { FurnitureVisual } from '../../domain/content/gameplayTypes';

/** The placeholder shown for an asset when placed. Anything with no model draws this. */
const PLACEHOLDER: FurnitureVisual = { shape: 'box', color: '#c98b4e', size: [1, 1, 1] };

/**
 * Developer tool, only in development builds (`import.meta.env.DEV`). Lists every optional model with its state,
 * loads one on request, and places a copy in front of the player. F4 shows or hides it. Its labels are plain English on
 * purpose: players never see it.
 */
export function AssetInspector({ game }: { readonly game: GameApp }) {
  const [open, setOpen] = useState(false);
  const [, redraw] = useReducer((count: number) => count + 1, 0);
  const [placed, setPlaced] = useState<Entity[]>([]);

  useEffect(() => game.assets.onChange(redraw), [game]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'F4' && !event.repeat) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!import.meta.env.DEV || !open) {
    return null;
  }

  const place = (id: string) => {
    const entity = game.assets.instantiate(id, PLACEHOLDER);
    game.placeInFrontOfPlayer(entity);
    setPlaced((entities) => [...entities, entity]);
  };

  const clearPlaced = () => {
    for (const entity of placed) {
      entity.destroy();
    }
    setPlaced([]);
  };

  return (
    <section className="asset-inspector" aria-label="Asset inspector (development only)">
      <h2>Assets (dev)</h2>
      <ul>
        {game.assets.entries().map((entry) => {
          const status = game.assets.status(entry.id);
          const clips = game.assets.animationsOf(entry.id);
          return (
            <li key={entry.id}>
              <span className="asset-id">{entry.id}</span>
              <span className={`asset-status asset-status-${status}`}>{status}</span>
              {clips.length > 0 ? <span className="asset-clips">{clips.join(', ')}</span> : null}
              <button type="button" disabled={!entry.source || status === 'loading'} onClick={() => void game.assets.load(entry.id)}>
                Load
              </button>
              <button type="button" onClick={() => place(entry.id)}>
                Place
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={clearPlaced} disabled={placed.length === 0}>
        Remove placed ({placed.length})
      </button>
    </section>
  );
}
