import { useState } from 'react';
import type { GameApp } from '../../app/GameApp';
import { GAME_CONTENT, t } from '../../content';
import type { SessionSnapshot } from '../../domain/GameSession';
import { playSfx } from '../../shared/audio/sfx';

/**
 * The shop counter. Three things live here: customer orders (accept, then deliver), furniture for sale (paid from
 * earned coins), and the display sockets (pick a piece you own, then tap a free socket). Every action goes to the
 * session. The panel only shows what the session says.
 */
export function ShopPanel({ game, snap }: { readonly game: GameApp; readonly snap: SessionSnapshot }) {
  const [selected, setSelected] = useState<string | null>(null);
  const itemName = (itemId: string) => t(GAME_CONTENT.items.find((item) => item.id === itemId)?.nameKey ?? itemId);
  const furnitureName = (furnitureId: string) => t(GAME_CONTENT.shop.furniture.find((piece) => piece.id === furnitureId)?.nameKey ?? furnitureId);
  const slotLabel = (slotId: string) => t(GAME_CONTENT.shop.slots.find((slot) => slot.id === slotId)?.labelKey ?? slotId);
  const requiredLevel = (furnitureId: string) => GAME_CONTENT.shop.furniture.find((piece) => piece.id === furnitureId)?.minShopLevel ?? 1;

  // Orders that need attention: open ones an active quest asks for, and any already accepted or delivered.
  const relevantOrders = snap.orders.filter((order) => order.status !== 'open' || order.open);

  return (
    <>
      <section className="shop-section" aria-label={t('ui.shop.orders')}>
        <h3>{t('ui.shop.orders')}</h3>
        {relevantOrders.length === 0 ? (
          <p>{t('ui.shop.no_orders')}</p>
        ) : (
          <ul className="shop-list">
            {relevantOrders.map((order) => (
              <li key={order.id}>
                <strong>{t(order.nameKey)}</strong>
                <p className="need">
                  {order.requires
                    .map((amount) => {
                      const have = game.session.inventory.available(amount.itemId, amount.quality);
                      return `${itemName(amount.itemId)} ${Math.min(have, amount.count)}/${amount.count}`;
                    })
                    .join(', ')}
                  {' · '}
                  {t(`ui.shop.status.${order.status}`)}
                  {order.status === 'accepted' && order.ready ? ` · ${t('ui.shop.ready')}` : ''}
                </p>
                <p className="need">
                  {`+${order.rewards.coins} ${t('ui.hud.coins')} · +${order.rewards.reputation} ${t('ui.hud.reputation')}`}
                </p>
                {order.status === 'open' ? (
                  <button type="button" onClick={() => game.session.acceptOrder(order.id)}>
                    {t('ui.shop.accept')}
                  </button>
                ) : null}
                {order.status === 'accepted' ? (
                  <button
                    type="button"
                    disabled={!order.ready}
                    onClick={() => {
                      if (game.session.deliverOrder(order.id).ok) {
                        playSfx('coin');
                      }
                    }}
                  >
                    {t('ui.shop.deliver')}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="shop-section" aria-label={t('ui.shop.furniture')}>
        <h3>{t('ui.shop.furniture')}</h3>
        <ul className="shop-list">
          {snap.furniture.map((piece) => (
            <li key={piece.id}>
              <strong>{t(piece.nameKey)}</strong>
              <p className="need">
                {t('ui.shop.price', { price: String(piece.price) })}
                {' · '}
                {t('ui.shop.owned', { count: String(piece.owned) })}
                {piece.lockedBy === 'level' ? ` · ${t('ui.shop.locked_level', { level: String(requiredLevel(piece.id)) })}` : ''}
                {piece.lockedBy === 'flag' ? ` · ${t('ui.shop.locked_flag')}` : ''}
              </p>
              <button
                type="button"
                disabled={piece.lockedBy !== null || snap.coins < piece.price}
                onClick={() => {
                  if (game.session.buyFurniture(piece.id).ok) {
                    playSfx('coin');
                  }
                }}
              >
                {t('ui.shop.buy')}
              </button>
              {piece.owned > 0 ? (
                <button type="button" aria-pressed={selected === piece.id} onClick={() => setSelected(selected === piece.id ? null : piece.id)}>
                  {selected === piece.id ? t('ui.shop.cancel_select') : t('ui.shop.place_hint')}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="shop-section" aria-label={t('ui.shop.slots')}>
        <h3>{t('ui.shop.slots')}</h3>
        {selected ? <p className="need">{t('ui.shop.selected', { item: furnitureName(selected) })}</p> : null}
        <ul className="shop-list slots">
          {snap.shopSlots.map((slot) => {
            const occupant = slot.furnitureId
              ? furnitureName(slot.furnitureId)
              : slot.unlocked
                ? t('ui.shop.slot_empty')
                : t('ui.shop.slot_locked');
            const canPlace = selected !== null && slot.unlocked && slot.furnitureId === null;
            return (
              <li key={slot.id}>
                <button
                  type="button"
                  disabled={!canPlace}
                  onClick={() => {
                    if (selected && game.session.placeFurniture(selected, slot.id).ok) {
                      setSelected(null);
                      playSfx('snap');
                    }
                  }}
                >
                  {`${slotLabel(slot.id)}: ${occupant}`}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
