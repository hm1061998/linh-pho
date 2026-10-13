import * as pc from 'playcanvas';
import type { FurnitureDef, FurnitureShape, GlyphDef, PickupDef, PlacementDef, ShopContent, StationDef } from '../../domain/content/gameplayTypes';
import type { SessionSnapshot } from '../../domain/GameSession';
import type { AssetLoader } from '../assets/AssetLoader';
import type { WalkableWorld } from '../player/collision';
import { colorFromHex } from '../scene/colorFromHex';

/**
 * Placeholder world objects built from content: pickups (small boxes in the item's color), stations (a glowing
 * floor marker), placements (a pedestal whose lamp lights up when filled), glyphs (glowing discs that show only in
 * spirit phase), and the bridge glow that Q01 unlocks. Each frame is driven by session snapshots, not by its own
 * state, so reloads and rules changes stay consistent.
 */

const ITEM_COLORS: Readonly<Record<string, string>> = {
  bamboo: '#6E9E5A',
  paper: '#EDE6CF',
  ink: '#2A2A33',
  indigo: '#3F5FA8',
  rope: '#B89A5E',
  wood_scrap: '#8A6442',
  wooden_lantern: '#C98B4E',
  spirit_lantern: '#65D4BD',
};
const FALLBACK_COLOR = '#B9B1A0';
const STATION_COLOR = '#65D4BD';
const LAMP_GOLD = '#F2B759';
const SPIRIT_JADE = '#65D4BD';
const PEDESTAL_COLOR = '#6B5C47';
const PICKUP_SIZE_M = 0.32;
const BRIDGE_DECK_NAME = 'ENV_Bridge_Deck';
const BRIDGE_GLOW_INTENSITY = 0.9;
const SHOP_GLOW_NODES: readonly string[] = ['ENV_House_Shop_Body', 'PROP_Signboard_Shop'];
/** The shop body warms as the shop levels up. Level 1 lights it, level 2 lights it fully. */
const SHOP_GLOW_LEVEL_1 = 0.25;
const SHOP_GLOW_LEVEL_2 = 0.55;
const COUNTER_COLOR = '#6B4A2F';
const COUNTER_SIZE_M: readonly [number, number, number] = [1.2, 0.9, 0.6];
/** A hanging piece (a sphere) sits this high. Anything else stands on the floor. */
const HANGING_HEIGHT_M = 1.3;

export interface WorldContent {
  readonly pickups: readonly PickupDef[];
  readonly stations: readonly StationDef[];
  readonly placements: readonly PlacementDef[];
  readonly glyphs: readonly GlyphDef[];
  readonly shop: ShopContent;
}

interface PlacementView {
  readonly headMaterial: pc.StandardMaterial;
  readonly placed: pc.Entity;
}

interface GlyphView {
  readonly root: pc.Entity;
  readonly material: pc.StandardMaterial;
}

interface SlotView {
  readonly root: pc.Entity;
  readonly base: pc.Entity;
  furnitureId: string | null;
  piece: pc.Entity | null;
}

/** True when a named blockout node is a render entity with a standard material that a glow can be cloned from. */
function hasGlowMaterial(node: pc.GraphNode | null): boolean {
  return node instanceof pc.Entity && node.render !== undefined && node.render.material instanceof pc.StandardMaterial;
}

/** Clones a node's material so the glow only lights this node, then points the node at the clone. */
function cloneGlowMaterial(node: pc.GraphNode | null): pc.StandardMaterial | null {
  if (!(node instanceof pc.Entity) || !node.render) {
    return null;
  }
  const shared = node.render.material;
  if (!(shared instanceof pc.StandardMaterial)) {
    return null;
  }
  const own = shared.clone();
  own.emissive = colorFromHex(LAMP_GOLD);
  own.update();
  node.render.material = own;
  return own;
}

export class WorldView {
  private readonly pickupViews = new Map<string, pc.Entity>();
  private readonly placementViews = new Map<string, PlacementView>();
  private readonly glyphViews = new Map<string, GlyphView>();
  private readonly slotViews = new Map<string, SlotView>();
  private readonly furnitureById = new Map<string, FurnitureDef>();
  private readonly parent: pc.Entity;
  private readonly assets: AssetLoader;
  private bridgeMaterial: pc.StandardMaterial | null = null;
  private shopGlow: pc.StandardMaterial[] = [];

  constructor(parent: pc.Entity, content: WorldContent, world: WalkableWorld, assets: AssetLoader) {
    this.parent = parent;
    this.assets = assets;
    for (const pickup of content.pickups) {
      const entity = this.box(`PICKUP_${pickup.id}`, colorFromHex(ITEM_COLORS[pickup.itemId] ?? FALLBACK_COLOR));
      entity.setLocalScale(PICKUP_SIZE_M, PICKUP_SIZE_M, PICKUP_SIZE_M);
      const surface = world.surfaceHeightAt(pickup.position);
      entity.setLocalPosition(pickup.position.x, surface + PICKUP_SIZE_M / 2, pickup.position.z);
      parent.addChild(entity);
      this.pickupViews.set(pickup.id, entity);
    }

    for (const station of content.stations) {
      const marker = this.box(`STATION_${station.id}`, colorFromHex(STATION_COLOR), true);
      marker.setLocalScale(1.1, 0.04, 1.1);
      const surface = world.surfaceHeightAt(station.position);
      marker.setLocalPosition(station.position.x, surface + 0.02, station.position.z);
      parent.addChild(marker);
    }

    for (const placement of content.placements) {
      const root = new pc.Entity(`PLACEMENT_${placement.id}`);
      const surface = world.surfaceHeightAt(placement.position);
      root.setLocalPosition(placement.position.x, surface, placement.position.z);

      const pedestal = this.box('Pedestal', colorFromHex(PEDESTAL_COLOR));
      pedestal.setLocalScale(0.7, 1.0, 0.7);
      pedestal.setLocalPosition(0, 0.5, 0);
      root.addChild(pedestal);

      const headMaterial = new pc.StandardMaterial();
      headMaterial.diffuse = colorFromHex(LAMP_GOLD);
      headMaterial.emissive = colorFromHex(LAMP_GOLD);
      headMaterial.emissiveIntensity = 0;
      headMaterial.update();
      const head = new pc.Entity('LampHead');
      head.addComponent('render', { type: 'sphere', material: headMaterial });
      head.setLocalScale(0.42, 0.42, 0.42);
      head.setLocalPosition(0, 1.25, 0);
      root.addChild(head);

      const placed = this.box('PlacedItem', colorFromHex(ITEM_COLORS[placement.acceptsItemId] ?? FALLBACK_COLOR));
      placed.setLocalScale(0.36, 0.36, 0.36);
      placed.setLocalPosition(0, 0.95, 0);
      placed.enabled = false;
      root.addChild(placed);

      parent.addChild(root);
      this.placementViews.set(placement.id, { headMaterial, placed });
    }

    for (const glyph of content.glyphs) {
      const root = new pc.Entity(`GLYPH_${glyph.id}`);
      const material = new pc.StandardMaterial();
      material.diffuse = colorFromHex(SPIRIT_JADE);
      material.emissive = colorFromHex(SPIRIT_JADE);
      material.emissiveIntensity = 0;
      material.update();
      const disc = new pc.Entity('Disc');
      disc.addComponent('render', { type: 'box', material });
      disc.setLocalScale(0.9, 0.04, 0.9);
      disc.setLocalPosition(0, 0.03, 0);
      root.addChild(disc);
      const surface = world.surfaceHeightAt(glyph.position);
      root.setLocalPosition(glyph.position.x, surface, glyph.position.z);
      root.enabled = false;
      parent.addChild(root);
      this.glyphViews.set(glyph.id, { root, material });
    }

    this.buildShop(content.shop, world);
  }

  /** Brings every world object in line with the session. Safe to call often. */
  sync(snapshot: SessionSnapshot): void {
    const collected = new Set(snapshot.collectedPickups);
    for (const [pickupId, entity] of this.pickupViews) {
      entity.enabled = !collected.has(pickupId);
    }

    const filled = new Set(snapshot.placed);
    for (const [placementId, view] of this.placementViews) {
      const isFilled = filled.has(placementId);
      view.headMaterial.emissiveIntensity = isFilled ? 2.2 : 0;
      view.headMaterial.update();
      view.placed.enabled = isFilled;
    }

    // Glyphs fade in with the spirit layer. They are invisible in the real phase, and they only take focus once settled.
    const spiritVisible = snapshot.lantern.spiritAmount > 0;
    for (const view of this.glyphViews.values()) {
      view.root.enabled = spiritVisible;
      view.material.emissiveIntensity = snapshot.lantern.spiritAmount * 2;
      view.material.update();
    }

    const bridge = this.resolveBridgeMaterial();
    if (bridge) {
      bridge.emissiveIntensity = snapshot.flags.bridge_glow ? BRIDGE_GLOW_INTENSITY : 0;
      bridge.update();
    }

    this.syncShop(snapshot);
  }

  dispose(): void {
    // Entities belong to the app root and are destroyed with it.
    this.pickupViews.clear();
    this.placementViews.clear();
    this.glyphViews.clear();
    this.slotViews.clear();
  }

  /** The counter and the three display sockets. Sockets stay hidden until the shop level reaches them. */
  private buildShop(shop: ShopContent, world: WalkableWorld): void {
    for (const piece of shop.furniture) {
      this.furnitureById.set(piece.id, piece);
    }
    if (shop.counter) {
      const counter = this.box(`SHOP_${shop.counter.id}`, colorFromHex(COUNTER_COLOR));
      const [width, height, depth] = COUNTER_SIZE_M;
      counter.setLocalScale(width, height, depth);
      const surface = world.surfaceHeightAt(shop.counter.position);
      counter.setLocalPosition(shop.counter.position.x, surface + height / 2, shop.counter.position.z);
      this.parent.addChild(counter);
    }
    for (const slot of shop.slots) {
      const root = new pc.Entity(`SHOP_SLOT_${slot.id}`);
      root.setLocalPosition(slot.position.x, world.surfaceHeightAt(slot.position), slot.position.z);
      const base = this.primitive('SlotBase', 'cylinder', colorFromHex(PEDESTAL_COLOR));
      base.setLocalScale(1.1, 0.05, 1.1);
      base.setLocalPosition(0, 0.025, 0);
      root.addChild(base);
      root.enabled = false;
      this.parent.addChild(root);
      this.slotViews.set(slot.id, { root, base, furnitureId: null, piece: null });
    }
  }

  /**
   * Builds one placed piece. The asset loader gives its model when one is loaded, and its visual placeholder when not.
   * A hanging piece (a sphere) sits high, and anything else stands on the floor.
   */
  private buildPiece(furnitureId: string): pc.Entity | null {
    const piece = this.furnitureById.get(furnitureId);
    if (!piece) {
      return null;
    }
    const entity = this.assets.instantiate(`furniture.${piece.id}`, piece.visual);
    entity.setLocalPosition(0, piece.visual.shape === 'sphere' ? HANGING_HEIGHT_M : piece.visual.size[1] / 2 + 0.05, 0);
    return entity;
  }

  /** Shows the sockets the shop level allows, and swaps a socket's piece when the session says it changed. */
  private syncShop(snapshot: SessionSnapshot): void {
    for (const slot of snapshot.shopSlots) {
      const view = this.slotViews.get(slot.id);
      if (!view) {
        continue;
      }
      view.root.enabled = slot.unlocked;
      view.base.enabled = slot.furnitureId === null;
      if (view.furnitureId !== slot.furnitureId) {
        view.piece?.destroy();
        view.piece = slot.furnitureId ? this.buildPiece(slot.furnitureId) : null;
        if (view.piece) {
          view.root.addChild(view.piece);
        }
        view.furnitureId = slot.furnitureId;
      }
    }
    this.syncShopBody(snapshot.shopLevel);
  }

  /**
   * The shop body and its sign warm with the shop level. Each gets its own material clone, so the glow cannot light
   * the wood or the other buildings that share a material in the blockout. Resolved lazily, once every target
   * exists, so a half-built blockout never leaves one of the pair cloned and the other not.
   */
  private syncShopBody(level: number): void {
    if (this.shopGlow.length === 0) {
      if (!SHOP_GLOW_NODES.every((name) => hasGlowMaterial(this.parent.findByName(name)))) {
        return;
      }
      this.shopGlow = SHOP_GLOW_NODES.map((name) => cloneGlowMaterial(this.parent.findByName(name))).filter(
        (material): material is pc.StandardMaterial => material !== null,
      );
    }
    const intensity = level >= 2 ? SHOP_GLOW_LEVEL_2 : level >= 1 ? SHOP_GLOW_LEVEL_1 : 0;
    for (const material of this.shopGlow) {
      material.emissiveIntensity = intensity;
      material.update();
    }
  }

  private primitive(name: string, type: FurnitureShape, color: pc.Color, emissive = false): pc.Entity {
    const material = new pc.StandardMaterial();
    material.diffuse = color;
    if (emissive) {
      material.emissive = color;
      material.emissiveIntensity = 0.8;
    }
    material.update();
    const entity = new pc.Entity(name);
    entity.addComponent('render', { type, material });
    return entity;
  }

  /**
   * The deck's material is shared with other wood objects in the blockout, so the glow needs a material of its own.
   * It is cloned once, on first use, after the blockout has been built.
   */
  private resolveBridgeMaterial(): pc.StandardMaterial | null {
    if (this.bridgeMaterial) {
      return this.bridgeMaterial;
    }
    const deck = this.parent.findByName(BRIDGE_DECK_NAME);
    if (!(deck instanceof pc.Entity) || !deck.render) {
      return null;
    }
    const shared = deck.render.material;
    if (!(shared instanceof pc.StandardMaterial)) {
      return null;
    }
    const own = shared.clone();
    own.emissive = colorFromHex(SPIRIT_JADE);
    own.emissiveIntensity = 0;
    own.update();
    deck.render.material = own;
    this.bridgeMaterial = own;
    return own;
  }

  private box(name: string, color: pc.Color, emissive = false): pc.Entity {
    const material = new pc.StandardMaterial();
    material.diffuse = color;
    if (emissive) {
      material.emissive = color;
      material.emissiveIntensity = 0.8;
    }
    material.update();
    const entity = new pc.Entity(name);
    entity.addComponent('render', { type: 'box', material });
    return entity;
  }
}
