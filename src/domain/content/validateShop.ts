import type { FurnitureDef, FurnitureShape, ItemDef, OrderDef, ShopContent, ShopCounterDef, ShopSlotDef } from './gameplayTypes';
import type { ContentIssue } from './types';
import {
  error,
  isFiniteNumber,
  isNonEmptyString,
  isNonNegativeInteger,
  isPositiveInteger,
  isRecord,
  parseAll,
  parseAmount,
  parsePosition,
  readList,
} from './validateGameplay';

/**
 * Validates the shop (counter, decoration sockets, furniture) and the customer orders. The same rules as the rest
 * of the content: a bad entry is dropped with a reason, and everything else still loads.
 */

export interface ShopRaw {
  readonly shop: unknown;
  readonly orders: unknown;
}

export interface ShopContext {
  readonly items: ReadonlyMap<string, ItemDef>;
  readonly hasTextKey: (key: string) => boolean;
}

export interface ValidatedShop {
  readonly content: ShopContent;
  readonly issues: ContentIssue[];
}

const SHAPES: readonly FurnitureShape[] = ['box', 'cylinder', 'sphere'];
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function parseCounter(raw: unknown, issues: ContentIssue[], ctx: ShopContext): ShopCounterDef | null {
  if (raw === undefined) {
    issues.push(error('shop.counter', 'counter is missing'));
    return null;
  }
  if (!isRecord(raw) || !isNonEmptyString(raw.id)) {
    issues.push(error('shop.counter', 'expected an object with a non-empty "id"'));
    return null;
  }
  const where = `shop.counter.${raw.id}`;
  const position = parsePosition(raw.position);
  if (!isNonEmptyString(raw.labelKey) || !ctx.hasTextKey(raw.labelKey)) {
    issues.push(error(where, `labelKey "${String(raw.labelKey)}" is missing from the primary locale`));
    return null;
  }
  if (!position) {
    issues.push(error(where, 'position must be { "x": number, "z": number }'));
    return null;
  }
  return { id: raw.id, labelKey: raw.labelKey, position };
}

function parseSlot(raw: unknown, source: string, ctx: ShopContext, issues: ContentIssue[]): ShopSlotDef | null {
  if (!isRecord(raw) || !isNonEmptyString(raw.id)) {
    issues.push(error(source, 'expected an object with a non-empty "id"'));
    return null;
  }
  const where = `shopSlots.${raw.id}`;
  const before = issues.length;
  const position = parsePosition(raw.position);
  if (!isNonEmptyString(raw.labelKey) || !ctx.hasTextKey(raw.labelKey)) {
    issues.push(error(where, `labelKey "${String(raw.labelKey)}" is missing from the primary locale`));
  }
  if (!position) {
    issues.push(error(where, 'position must be { "x": number, "z": number }'));
  }
  if (!isPositiveInteger(raw.minShopLevel)) {
    issues.push(error(where, 'minShopLevel must be a whole number >= 1'));
  }
  if (issues.length > before || !position) {
    return null;
  }
  return { id: raw.id, labelKey: raw.labelKey as string, position, minShopLevel: raw.minShopLevel as number };
}

function parseVisual(raw: unknown, where: string, issues: ContentIssue[]): FurnitureDef['visual'] | null {
  if (
    !isRecord(raw) ||
    typeof raw.shape !== 'string' ||
    !SHAPES.includes(raw.shape as FurnitureShape) ||
    typeof raw.color !== 'string' ||
    !HEX_COLOR.test(raw.color) ||
    !Array.isArray(raw.size) ||
    raw.size.length !== 3 ||
    !raw.size.every((value) => isFiniteNumber(value) && value > 0)
  ) {
    issues.push(error(where, 'visual must be { "shape": box | cylinder | sphere, "color": "#rrggbb", "size": [w, h, d] }, sizes > 0'));
    return null;
  }
  return {
    shape: raw.shape as FurnitureShape,
    color: raw.color,
    size: [raw.size[0] as number, raw.size[1] as number, raw.size[2] as number],
  };
}

function parseFurniture(raw: unknown, source: string, ctx: ShopContext, issues: ContentIssue[]): FurnitureDef | null {
  if (!isRecord(raw) || !isNonEmptyString(raw.id)) {
    issues.push(error(source, 'expected an object with a non-empty "id"'));
    return null;
  }
  const where = `furniture.${raw.id}`;
  const before = issues.length;
  const requiresFlag = raw.requiresFlag ?? null;
  if (!isNonEmptyString(raw.nameKey) || !ctx.hasTextKey(raw.nameKey)) {
    issues.push(error(where, `nameKey "${String(raw.nameKey)}" is missing from the primary locale`));
  }
  if (!isNonNegativeInteger(raw.price) || (raw.price as number) < 1) {
    issues.push(error(where, 'price must be a whole number >= 1, in Lantern Coins'));
  }
  if (!isPositiveInteger(raw.minShopLevel)) {
    issues.push(error(where, 'minShopLevel must be a whole number >= 1'));
  }
  if (requiresFlag !== null && !isNonEmptyString(requiresFlag)) {
    issues.push(error(where, '"requiresFlag" must be a non-empty string, or null'));
  }
  const visual = parseVisual(raw.visual, where, issues);
  if (issues.length > before || !visual) {
    return null;
  }
  return {
    id: raw.id,
    nameKey: raw.nameKey as string,
    price: raw.price as number,
    minShopLevel: raw.minShopLevel as number,
    requiresFlag: requiresFlag as string | null,
    visual,
  };
}

function parseOrder(raw: unknown, source: string, ctx: ShopContext, issues: ContentIssue[]): OrderDef | null {
  if (!isRecord(raw) || !isNonEmptyString(raw.id)) {
    issues.push(error(source, 'expected an object with a non-empty "id"'));
    return null;
  }
  const where = `orders.${raw.id}`;
  const before = issues.length;
  if (!isNonEmptyString(raw.nameKey) || !ctx.hasTextKey(raw.nameKey)) {
    issues.push(error(where, `nameKey "${String(raw.nameKey)}" is missing from the primary locale`));
  }
  if (!Array.isArray(raw.requires) || raw.requires.length === 0) {
    issues.push(error(where, '"requires" must be a non-empty list of { "itemId", "count" }'));
  }
  const rewards = isRecord(raw.rewards) ? raw.rewards : null;
  if (!rewards || !isNonNegativeInteger(rewards.coins) || !isNonNegativeInteger(rewards.reputation)) {
    issues.push(error(where, '"rewards" must be { "coins": whole number >= 0, "reputation": whole number >= 0 }'));
  }
  if (issues.length > before || !Array.isArray(raw.requires) || !rewards) {
    return null;
  }
  const requires = raw.requires
    .map((entry, index) => parseAmount(entry, `${where}.requires[${index}]`, ctx.items, issues))
    .filter((amount): amount is NonNullable<typeof amount> => amount !== null);
  if (requires.length !== raw.requires.length) {
    return null;
  }
  return {
    id: raw.id,
    nameKey: raw.nameKey as string,
    requires,
    rewards: { coins: rewards.coins as number, reputation: rewards.reputation as number },
  };
}

export function validateShop(raw: ShopRaw, ctx: ShopContext): ValidatedShop {
  const issues: ContentIssue[] = [];
  const shop = isRecord(raw.shop) ? raw.shop : null;
  if (!shop) {
    issues.push(error('shop', 'expected { "counter", "slots", "furniture" }'));
  }
  const counter = parseCounter(shop?.counter, issues, ctx);
  const slots = parseAll(
    readList(shop ?? {}, 'slots', issues),
    'shopSlots',
    (entry, source, local) => parseSlot(entry, source, ctx, local),
    issues,
  );
  const furniture = parseAll(
    readList(shop ?? {}, 'furniture', issues),
    'furniture',
    (entry, source, local) => parseFurniture(entry, source, ctx, local),
    issues,
  );
  const orders = parseAll(
    readList(raw.orders, 'orders', issues),
    'orders',
    (entry, source, local) => parseOrder(entry, source, ctx, local),
    issues,
  );
  return { content: { counter, slots, furniture, orders }, issues };
}
