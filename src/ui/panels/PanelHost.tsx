import { useEffect } from 'react';
import type { GameApp } from '../../app/GameApp';
import { GAME_CONTENT, t } from '../../content';
import type { SessionSnapshot } from '../../domain/GameSession';
import { useDialogueView } from '../state/useGameplayState';
import { qualityLabel, useSessionSnapshot } from '../state/useSession';

/**
 * Hosts the one panel the session has open: the crafting table or the inventory. Panels never run game logic.
 * They read snapshots and send actions to the session. Keys: I toggles the inventory, Escape closes the panel.
 * Neither key works while a dialogue is open, because the dialogue owns them then.
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
        closePanel(game);
      } else if (event.code === 'KeyI') {
        event.preventDefault();
        if (panel?.kind === 'inventory') {
          closePanel(game);
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
  return (
    <section className="panel-card" role="dialog" aria-modal="true" aria-label={panelTitle(snap)}>
      {snap.panel.kind === 'craft' ? (
        <CraftPanel game={game} stationId={snap.panel.stationId} snap={snap} />
      ) : (
        <InventoryPanel game={game} snap={snap} />
      )}
    </section>
  );
}

/** Closing the crafting table during a craft returns its materials. The session does the refunding. */
function closePanel(game: GameApp): void {
  game.session.cancelCraft();
  game.session.closePanel();
}

function panelTitle(snap: SessionSnapshot): string {
  const panel = snap.panel;
  if (panel?.kind === 'craft') {
    const station = GAME_CONTENT.stations.find((candidate) => candidate.id === panel.stationId);
    return t(station?.labelKey ?? 'ui.craft.title');
  }
  return t('ui.inventory.title');
}

function CloseButton({ game }: { readonly game: GameApp }) {
  return (
    <button type="button" className="panel-close" onClick={() => closePanel(game)}>
      {t('ui.panel.close')}
    </button>
  );
}

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
  const itemName = (itemId: string) => t(GAME_CONTENT.items.find((item) => item.id === itemId)?.nameKey ?? itemId);

  // Placeholder confirm. Module 06 replaces this with the assembly and engraving minigames.
  const craftNow = (recipeId: string) => {
    if (game.session.beginCraft(recipeId, stationId).ok) {
      game.session.completeCraft('normal');
    }
  };

  return (
    <>
      <header className="panel-header">
        <h2>{panelTitle(snap)}</h2>
        <CloseButton game={game} />
      </header>
      {statuses.length === 0 ? (
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
                <button type="button" disabled={!affordable || busy} onClick={() => craftNow(recipe.id)}>
                  {t('ui.craft.confirm')}
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
