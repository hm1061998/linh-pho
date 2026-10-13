import { describe, expect, it } from 'vitest';
import type { FurnitureDef, ItemDef, OrderDef, ShopSlotDef } from '../domain/content/gameplayTypes';
import { Inventory } from '../domain/inventory/Inventory';
import { OrderBoard } from '../domain/orders/OrderBoard';
import { Shop } from '../domain/shop/Shop';

const NO_FLAGS = () => false;
const ALL_FLAGS = () => true;

const SHELF: FurnitureDef = {
  id: 'shelf',
  nameKey: 'k.shelf',
  price: 20,
  minShopLevel: 1,
  requiresFlag: 'q01_complete',
  visual: { shape: 'box', color: '#8a5a3b', size: [1.6, 1.1, 0.5] },
};
const VASE: FurnitureDef = {
  id: 'vase',
  nameKey: 'k.vase',
  price: 8,
  minShopLevel: 1,
  requiresFlag: null,
  visual: { shape: 'cylinder', color: '#7fa35a', size: [0.5, 0.9, 0.5] },
};
const LAMP: FurnitureDef = {
  id: 'lamp',
  nameKey: 'k.lamp',
  price: 25,
  minShopLevel: 2,
  requiresFlag: null,
  visual: { shape: 'sphere', color: '#f2b759', size: [0.5, 0.5, 0.5] },
};
const SLOTS: ShopSlotDef[] = [
  { id: 'slot_1', labelKey: 'k.slot1', position: { x: 0, z: 0 }, minShopLevel: 1 },
  { id: 'slot_2', labelKey: 'k.slot2', position: { x: 2, z: 0 }, minShopLevel: 1 },
  { id: 'slot_3', labelKey: 'k.slot3', position: { x: 4, z: 0 }, minShopLevel: 2 },
];

describe('Shop: purchases', () => {
  it('refuses a purchase the coins cannot cover, and changes nothing', () => {
    const shop = new Shop([VASE], SLOTS);
    expect(shop.checkPurchase('vase', 1, ALL_FLAGS, 7)).toEqual({ ok: false, reason: 'insufficient_coins' });
    expect(shop.owned('vase')).toBe(0);
  });

  it('accepts a purchase with exactly enough coins', () => {
    const shop = new Shop([VASE], SLOTS);
    const check = shop.checkPurchase('vase', 1, ALL_FLAGS, 8);
    expect(check.ok).toBe(true);
    shop.commitPurchase('vase');
    expect(shop.owned('vase')).toBe(1);
  });

  it('refuses a piece above the shop level, with the reason', () => {
    const shop = new Shop([LAMP], SLOTS);
    expect(shop.checkPurchase('lamp', 1, ALL_FLAGS, 999)).toEqual({ ok: false, reason: 'level_locked' });
    expect(shop.checkPurchase('lamp', 2, ALL_FLAGS, 999).ok).toBe(true);
  });

  it('refuses a piece whose flag is not set yet', () => {
    const shop = new Shop([SHELF], SLOTS);
    expect(shop.checkPurchase('shelf', 1, NO_FLAGS, 999)).toEqual({ ok: false, reason: 'flag_locked' });
    expect(shop.checkPurchase('shelf', 1, ALL_FLAGS, 999).ok).toBe(true);
  });

  it('refuses an unknown piece', () => {
    expect(new Shop([VASE], SLOTS).checkPurchase('ghost', 1, ALL_FLAGS, 999)).toEqual({
      ok: false,
      reason: 'unknown_furniture',
    });
  });

  it('gives each purchase its own id, so repeated buys count as separate sources', () => {
    const shop = new Shop([VASE], SLOTS);
    expect(shop.commitPurchase('vase')).not.toBe(shop.commitPurchase('vase'));
  });
});

describe('Shop: sockets', () => {
  it('shows a socket only once the shop level reaches it', () => {
    const shop = new Shop([VASE], SLOTS);
    expect(shop.views(1, ALL_FLAGS).slots.map((slot) => slot.unlocked)).toEqual([true, true, false]);
    expect(shop.views(2, ALL_FLAGS).slots.map((slot) => slot.unlocked)).toEqual([true, true, true]);
  });

  it('holds one piece per socket: a second piece in the same socket is refused', () => {
    const shop = new Shop([VASE], SLOTS);
    shop.commitPurchase('vase');
    shop.commitPurchase('vase');
    shop.commitPlacement('vase', 'slot_1');
    expect(shop.checkPlacement('vase', 'slot_1', 1)).toEqual({ ok: false, reason: 'slot_occupied' });
    expect(shop.checkPlacement('vase', 'slot_2', 1).ok).toBe(true);
  });

  it('refuses to place into a socket the level has not reached', () => {
    const shop = new Shop([VASE], SLOTS);
    shop.commitPurchase('vase');
    expect(shop.checkPlacement('vase', 'slot_3', 1)).toEqual({ ok: false, reason: 'slot_locked' });
  });

  it('refuses to place a piece that is not owned', () => {
    const shop = new Shop([VASE], SLOTS);
    expect(shop.checkPlacement('vase', 'slot_1', 1)).toEqual({ ok: false, reason: 'no_stock' });
  });

  it('moves a piece out of stock and into the socket, once', () => {
    const shop = new Shop([VASE], SLOTS);
    shop.commitPurchase('vase');
    shop.commitPlacement('vase', 'slot_1');
    expect(shop.owned('vase')).toBe(0);
    expect(shop.views(1, ALL_FLAGS).slots[0]).toMatchObject({ id: 'slot_1', furnitureId: 'vase' });
  });
});

describe('OrderBoard', () => {
  const WOOD: OrderDef = {
    id: 'order_wood',
    nameKey: 'k.order_wood',
    requires: [{ itemId: 'wooden_lantern', count: 1 }],
    rewards: { coins: 25, reputation: 2 },
  };
  const ITEMS: ItemDef[] = [
    { id: 'wooden_lantern', nameKey: 'k.lantern', stackLimit: 20, qualifiable: true },
  ] as ItemDef[];

  it('goes open, then accepted, then delivered, and never accepts or delivers out of order', () => {
    const board = new OrderBoard([WOOD]);
    const inventory = new Inventory(ITEMS);
    expect(board.status('order_wood')).toBe('open');
    expect(board.deliver('order_wood', inventory)).toEqual({ ok: false, reason: 'not_accepted' });
    expect(board.accept('order_wood')).toBe(true);
    expect(board.accept('order_wood')).toBe(false);
    expect(board.status('order_wood')).toBe('accepted');
  });

  it('spends nothing when an item is short, and the order stays accepted', () => {
    const board = new OrderBoard([WOOD]);
    const inventory = new Inventory(ITEMS);
    board.accept('order_wood');
    expect(board.deliver('order_wood', inventory)).toEqual({ ok: false, reason: 'missing_items' });
    expect(board.status('order_wood')).toBe('accepted');
  });

  it('delivers once: the items are spent a single time, and a second delivery is refused', () => {
    const board = new OrderBoard([WOOD]);
    const inventory = new Inventory(ITEMS);
    inventory.add('wooden_lantern', 2, 'normal');
    board.accept('order_wood');
    expect(board.deliver('order_wood', inventory).ok).toBe(true);
    expect(inventory.available('wooden_lantern')).toBe(1);
    expect(board.deliver('order_wood', inventory)).toEqual({ ok: false, reason: 'already_delivered' });
    expect(inventory.available('wooden_lantern')).toBe(1);
  });

  it('reports ready only when the inventory covers the whole order', () => {
    const board = new OrderBoard([WOOD]);
    const inventory = new Inventory(ITEMS);
    expect(board.views(inventory)[0]?.ready).toBe(false);
    inventory.add('wooden_lantern', 1, 'good');
    expect(board.views(inventory)[0]?.ready).toBe(true);
  });
});
