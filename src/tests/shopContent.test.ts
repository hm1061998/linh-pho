import { describe, expect, it } from 'vitest';
import itemsJson from '../content/items.json';
import ordersJson from '../content/orders.json';
import shopJson from '../content/shop.json';
import type { ItemDef } from '../domain/content/gameplayTypes';
import { validateShop, type ShopRaw } from '../domain/content/validateShop';

const ITEMS = new Map(itemsJson.items.map((item) => [item.id, item as ItemDef]));
/** Every locale key is treated as present. These tests are about shape and references, not about the copy. */
const CTX = { items: ITEMS, hasTextKey: () => true };

function rawShop(overrides: Partial<{ shop: unknown; orders: unknown }> = {}): ShopRaw {
  return { shop: shopJson, orders: ordersJson, ...overrides };
}

/** A single furniture entry that is valid, to be broken one field at a time. */
const GOOD_PIECE = {
  id: 'stool',
  nameKey: 'k.stool',
  price: 10,
  minShopLevel: 1,
  requiresFlag: null,
  visual: { shape: 'box', color: '#6b4a2f', size: [0.6, 0.45, 0.6] },
};

describe('shipped shop content', () => {
  it('loads with no issues: a counter, three sockets, five furniture pieces, and the six authored orders', () => {
    const result = validateShop(rawShop(), { ...CTX, hasTextKey: (key) => key.length > 0 && key.includes('.') });
    expect(result.issues).toEqual([]);
    expect(result.content.counter).not.toBeNull();
    expect(result.content.slots).toHaveLength(3);
    expect(result.content.furniture).toHaveLength(5);
    // The first two are the chapter's orders, and the other four are the replay orders GDD C3 asks for.
    expect(result.content.orders.map((order) => order.id)).toEqual([
      'order_wood_lantern',
      'order_paper_rope',
      'order_ink_wood',
      'order_indigo_bamboo',
      'order_rope_wood',
      'order_spirit_lantern',
    ]);
  });

  it('gives the second socket and the hanging lamp a later shop level, so the shop visibly grows', () => {
    const result = validateShop(rawShop(), { ...CTX, hasTextKey: (key) => key.includes('.') });
    expect(result.content.slots.map((slot) => slot.minShopLevel)).toEqual([1, 1, 2]);
    expect(result.content.furniture.find((piece) => piece.id === 'hanging_lamp')?.minShopLevel).toBe(2);
  });
});

describe('validateShop: bad entries are dropped with a reason', () => {
  it('drops a furniture piece with a zero price and says why', () => {
    const raw = rawShop({ shop: { ...shopJson, furniture: [{ ...GOOD_PIECE, price: 0 }] } });
    const result = validateShop(raw, CTX);
    expect(result.content.furniture).toEqual([]);
    expect(result.issues.some((issue) => issue.message.includes('price'))).toBe(true);
  });

  it('drops a furniture piece whose colour is not a hex value', () => {
    const raw = rawShop({
      shop: { ...shopJson, furniture: [{ ...GOOD_PIECE, visual: { ...GOOD_PIECE.visual, color: 'brown' } }] },
    });
    expect(validateShop(raw, CTX).content.furniture).toEqual([]);
  });

  it('drops a furniture piece whose shape is not a known primitive', () => {
    const raw = rawShop({
      shop: { ...shopJson, furniture: [{ ...GOOD_PIECE, visual: { ...GOOD_PIECE.visual, shape: 'torus' } }] },
    });
    expect(validateShop(raw, CTX).content.furniture).toEqual([]);
  });

  it('drops an order that asks for an item that does not exist', () => {
    const raw = rawShop({
      orders: { orders: [{ ...ordersJson.orders[0], requires: [{ itemId: 'dragon_scale', count: 1 }] }] },
    });
    const result = validateShop(raw, CTX);
    expect(result.content.orders).toEqual([]);
    expect(result.issues.some((issue) => issue.message.includes('dragon_scale'))).toBe(true);
  });

  it('drops an order with negative rewards', () => {
    const raw = rawShop({
      orders: { orders: [{ ...ordersJson.orders[0], rewards: { coins: -5, reputation: 0 } }] },
    });
    expect(validateShop(raw, CTX).content.orders).toEqual([]);
  });

  it('keeps the rest of the shop when the counter is missing, and reports the counter', () => {
    const { counter: _removed, ...withoutCounter } = shopJson;
    const result = validateShop(rawShop({ shop: withoutCounter }), CTX);
    expect(result.content.counter).toBeNull();
    expect(result.content.slots).toHaveLength(3);
    expect(result.issues.some((issue) => issue.source.includes('counter'))).toBe(true);
  });

  it('keeps the first of two sockets with the same id, and reports the duplicate', () => {
    const duplicate = { ...shopJson.slots[0] };
    const result = validateShop(rawShop({ shop: { ...shopJson, slots: [...shopJson.slots, duplicate] } }), CTX);
    expect(result.content.slots.filter((slot) => slot.id === duplicate.id)).toHaveLength(1);
    expect(result.issues.some((issue) => issue.message.includes('duplicate'))).toBe(true);
  });
});
