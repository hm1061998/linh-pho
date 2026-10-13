import { describe, expect, it } from 'vitest';
import type { ItemDef } from '../domain/content/gameplayTypes';
import { Inventory } from '../domain/inventory/Inventory';

const ITEMS: ItemDef[] = [
  { id: 'bamboo', nameKey: 'k', stackLimit: 3, qualifiable: false },
  { id: 'wooden_lantern', nameKey: 'k', stackLimit: 20, qualifiable: true },
];

function fresh(): Inventory {
  return new Inventory(ITEMS);
}

describe('Inventory stacking', () => {
  it('splits a large add across stacks at the stack limit', () => {
    const inv = fresh();
    expect(inv.add('bamboo', 7)).toBe(true);
    expect(inv.stackViews().map((stack) => stack.count)).toEqual([3, 3, 1]);
    expect(inv.available('bamboo')).toBe(7);
  });

  it('fills existing stacks before opening a new one', () => {
    const inv = fresh();
    inv.add('bamboo', 2);
    inv.add('bamboo', 2);
    expect(inv.stackViews().map((stack) => stack.count)).toEqual([3, 1]);
  });

  it('keeps qualities in separate stacks', () => {
    const inv = fresh();
    inv.add('wooden_lantern', 1, 'normal');
    inv.add('wooden_lantern', 1, 'perfect');
    expect(inv.available('wooden_lantern', 'perfect')).toBe(1);
    expect(inv.available('wooden_lantern')).toBe(2);
  });

  it('rejects unknown items, bad counts, and quality on raw materials', () => {
    const inv = fresh();
    expect(inv.add('nope', 1)).toBe(false);
    expect(inv.add('bamboo', 0)).toBe(false);
    expect(inv.add('bamboo', 1.5)).toBe(false);
    expect(inv.add('bamboo', 1, 'good')).toBe(false);
    expect(inv.add('wooden_lantern', 1)).toBe(false);
    expect(inv.stackViews()).toEqual([]);
  });
});

describe('Inventory reservations', () => {
  it('reserves atomically: a short amount changes nothing', () => {
    const inv = fresh();
    inv.add('bamboo', 2);
    const reserved = inv.reserve([
      { itemId: 'bamboo', count: 1 },
      { itemId: 'bamboo', count: 2 },
    ]);
    expect(reserved).toBeNull();
    expect(inv.available('bamboo')).toBe(2);
  });

  it('keeps reserved units out of the available count until commit', () => {
    const inv = fresh();
    inv.add('bamboo', 3);
    const reservation = inv.reserve([{ itemId: 'bamboo', count: 2 }]);
    expect(reservation).not.toBeNull();
    expect(inv.available('bamboo')).toBe(1);
    expect(inv.reserve([{ itemId: 'bamboo', count: 2 }])).toBeNull();
  });

  it('removes reserved units exactly once on commit', () => {
    const inv = fresh();
    inv.add('bamboo', 3);
    const reservation = inv.reserve([{ itemId: 'bamboo', count: 2 }]);
    expect(inv.commit(reservation!.id)).toBe(true);
    expect(inv.available('bamboo')).toBe(1);
    expect(inv.commit(reservation!.id)).toBe(false);
    expect(inv.available('bamboo')).toBe(1);
  });

  it('returns reserved units on release, and cannot release twice', () => {
    const inv = fresh();
    inv.add('bamboo', 3);
    const reservation = inv.reserve([{ itemId: 'bamboo', count: 3 }]);
    expect(inv.release(reservation!.id)).toBe(true);
    expect(inv.available('bamboo')).toBe(3);
    expect(inv.release(reservation!.id)).toBe(false);
  });

  it('spends atomically', () => {
    const inv = fresh();
    inv.add('bamboo', 1);
    expect(inv.spend([{ itemId: 'bamboo', count: 2 }])).toBe(false);
    expect(inv.available('bamboo')).toBe(1);
    expect(inv.spend([{ itemId: 'bamboo', count: 1 }])).toBe(true);
    expect(inv.available('bamboo')).toBe(0);
  });

  it('matches a required quality and treats a missing quality as any', () => {
    const inv = fresh();
    inv.add('wooden_lantern', 1, 'normal');
    inv.add('wooden_lantern', 1, 'good');
    expect(inv.reserve([{ itemId: 'wooden_lantern', count: 1, quality: 'perfect' }])).toBeNull();
    expect(inv.reserve([{ itemId: 'wooden_lantern', count: 2 }])).not.toBeNull();
  });
});
