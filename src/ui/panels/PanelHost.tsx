import { useEffect, useState } from 'react';
import type { GameApp } from '../../app/GameApp';
import { GAME_CONTENT, t } from '../../content';
import type { SessionSnapshot } from '../../domain/GameSession';
import { useDialogueView } from '../state/useGameplayState';
import { qualityLabel, useSessionSnapshot } from '../state/useSession';
import { MiniGame } from './MiniGames';
import { ShopPanel } from './ShopPanel';

/**
 * Hosts the one panel the session has open: the crafting table, the engraving puzzle, or the inventory. Panels
 * never run game logic. They read snapshots and send actions to the session. Keys: I toggles the inventory, Escape
 * closes the panel. Neither key works while a dialogue is open, because the dialogue owns them then.
 */
export function PanelHost({ game }: { readonly game: GameApp }) {
  const snap = useSessionSnapshot(game);
  const dialogue = useDialogueView(game);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || game.session.dialogue.isOpen) {
        return;
      }
      const panel = game.session.currentPanel;
      if (event.code === 'Escape' && panel) {
        event.preventDefault();
        game.session.closePanel();
      } else if (event.code === 'KeyI') {
        event.preventDefault();
        // The inventory would end a craft in progress. Keep the minigame open until the player finishes or cancels it.
        if (game.session.activeCraft) {
          return;
        }
        if (panel?.kind === 'inventory') {
          game.session.closePanel();
        } else {
          game.session.openPanel({ kind: 'inventory' });
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [game]);

  if (!snap.panel || dialogue) {
    return null;
  }
  const panel = snap.panel;
  return (
    <section className="panel-card" role="dialog" aria-modal="true" aria-label={panelTitle(snap)}>
      {panel.kind === 'craft' ? <CraftPanel game={game} stationId={panel.stationId} snap={snap} /> : null}
      {panel.kind === 'puzzle' ? <PuzzlePanel game={game} puzzleId={panel.puzzleId} snap={snap} /> : null}
      {panel.kind === 'shop' ? (
        <>
          <header className="panel-header">
            <h2>{panelTitle(snap)}</h2>
            <CloseButton game={game} />
          </header>
          <ShopPanel game={game} snap={snap} />
        </>
      ) : null}
      {panel.kind === 'inventory' ? <InventoryPanel game={game} snap={snap} /> : null}
    </section>
  );
}

function panelTitle(snap: SessionSnapshot): string {
  const panel = snap.panel;
  if (panel?.kind === 'craft' || panel?.kind === 'puzzle') {
    const station = GAME_CONTENT.stations.find((candidate) => candidate.id === panel.stationId);
    return t(station?.labelKey ?? 'ui.craft.title');
  }
  if (panel?.kind === 'shop') {
    return t(GAME_CONTENT.shop.counter?.labelKey ?? 'ui.shop.title');
  }
  return t('ui.inventory.title');
}

function CloseButton({ game }: { readonly game: GameApp }) {
  return (
    <button type="button" className="panel-close" onClick={() => game.session.closePanel()}>
      {t('ui.panel.close')}
    </button>
  );
}

/**
 * The recipe list. Starting a recipe reserves its inputs and opens its minigame in this same panel. The inputs are
 * spent only when the minigame completes. Cancelling returns them and goes back to this list.
 */
function CraftPanel({
  game,
  stationId,
  snap,
}: {
  readonly game: GameApp;
  readonly stationId: string;
  readonly snap: SessionSnapshot;
}) {
  const statuses = game.session.crafting.recipesAt(stationId);
  const busy = snap.craft !== null;
  const craftHere = snap.craft?.stationId === stationId;
  const itemName = (itemId: string) => t(GAME_CONTENT.items.find((item) => item.id === itemId)?.nameKey ?? itemId);

  return (
    <>
      <header className="panel-header">
        <h2>{panelTitle(snap)}</h2>
        <CloseButton game={game} />
      </header>
      {craftHere && snap.miniGame ? (
        <>
          <MiniGame game={game} view={snap.miniGame} />
          <button type="button" className="craft-cancel" onClick={() => game.session.cancelCraft()}>
            {t('ui.craft.cancel')}
          </button>
        </>
      ) : statuses.length === 0 ? (
        <p>{t('ui.craft.none')}</p>
      ) : (
        <ul className="recipe-list">
          {statuses.map(({ recipe, known, affordable }) => (
            <li key={recipe.id}>
              <strong>{t(recipe.nameKey)}</strong>
              <p className="need">
                {t('ui.craft.need')}:{' '}
                {recipe.inputs
                  .map((input) => {
                    const have = game.session.inventory.available(input.itemId, input.quality);
                    return `${itemName(input.itemId)} ${Math.min(have, input.count)}/${input.count}`;
                  })
                  .join(', ')}
              </p>
              {known ? (
                <button
                  type="button"
                  disabled={!affordable || busy}
                  onClick={() => game.session.beginCraft(recipe.id, stationId)}
                >
                  {t('ui.craft.start')}
                </button>
              ) : (
                <p className="locked">{t('ui.craft.locked')}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** The engraving puzzle. Pick the three marks in order, then engrave. The hint appears after repeated misses. */
function PuzzlePanel({
  game,
  puzzleId,
  snap,
}: {
  readonly game: GameApp;
  readonly puzzleId: string;
  readonly snap: SessionSnapshot;
}) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const view = snap.puzzles.find((candidate) => candidate.id === puzzleId);
  const def = GAME_CONTENT.puzzles.find((candidate) => candidate.id === puzzleId);
  if (!view || !def) {
    return (
      <>
        <header className="panel-header">
          <h2>{t('ui.puzzle.missing')}</h2>
          <CloseButton game={game} />
        </header>
      </>
    );
  }
  const glyphs = def.glyphs
    .map((id) => GAME_CONTENT.glyphs.find((glyph) => glyph.id === id))
    .filter((glyph): glyph is NonNullable<typeof glyph> => glyph !== undefined);
  const symbolOf = (glyphId: string) => t(GAME_CONTENT.glyphs.find((glyph) => glyph.id === glyphId)?.symbolKey ?? glyphId);

  const submit = () => {
    const result = game.session.submitPuzzle(puzzleId);
    if (result.ok) {
      setFeedback('ui.puzzle.solved');
    } else if (result.reason === 'wrong_order') {
      setFeedback('ui.puzzle.wrong');
    } else if (result.reason === 'incomplete') {
      setFeedback('ui.puzzle.incomplete');
    } else {
      setFeedback(null);
    }
  };

  return (
    <>
      <header className="panel-header">
        <h2>{panelTitle(snap)}</h2>
        <CloseButton game={game} />
      </header>
      <p>{t('ui.puzzle.instruction')}</p>
      <div className="puzzle-picks">
        {glyphs.map((glyph) => (
          <button
            key={glyph.id}
            type="button"
            disabled={view.solved || view.entered.includes(glyph.id)}
            onClick={() => {
              setFeedback(null);
              game.session.pickGlyph(puzzleId, glyph.id);
            }}
          >
            {t(glyph.symbolKey)}
          </button>
        ))}
      </div>
      <p className="entered" aria-live="polite">
        {view.entered.length > 0 ? view.entered.map(symbolOf).join(' → ') : '—'}
        {' · '}
        {t('ui.puzzle.progress', { count: String(view.entered.length), total: String(view.required) })}
      </p>
      <div className="puzzle-actions">
        <button type="button" disabled={view.solved || view.entered.length === 0} onClick={() => game.session.undoGlyph(puzzleId)}>
          {t('ui.puzzle.undo')}
        </button>
        <button type="button" disabled={view.solved || view.entered.length === 0} onClick={() => game.session.clearGlyphs(puzzleId)}>
          {t('ui.puzzle.clear')}
        </button>
        <button type="button" disabled={view.solved || view.entered.length !== view.required} onClick={submit}>
          {t('ui.puzzle.submit')}
        </button>
      </div>
      {view.hintKey && !view.solved ? <p className="hint">{t(view.hintKey)}</p> : null}
      {feedback ? <p className="feedback">{t(feedback)}</p> : null}
      {view.solved && !feedback ? <p className="feedback">{t('ui.puzzle.solved')}</p> : null}
    </>
  );
}

function InventoryPanel({ game, snap }: { readonly game: GameApp; readonly snap: SessionSnapshot }) {
  return (
    <>
      <header className="panel-header">
        <h2>{t('ui.inventory.title')}</h2>
        <CloseButton game={game} />
      </header>
      {snap.inventory.length === 0 ? (
        <p>{t('ui.inventory.empty')}</p>
      ) : (
        <ul className="inventory-list">
          {snap.inventory.map((stack) => (
            <li key={`${stack.itemId}|${stack.quality ?? ''}`}>
              <span>{t(stack.nameKey)}</span>
              {stack.quality ? <span className="quality">{qualityLabel(stack.quality)}</span> : null}
              <b>{stack.count - stack.reserved}</b>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
