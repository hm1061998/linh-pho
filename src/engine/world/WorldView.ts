import * as pc from 'playcanvas';
import type { FurnitureDef, FurnitureShape, GlyphDef, PickupDef, PlacementDef, ShopContent, StationDef } from '../../domain/content/gameplayTypes';
import type { SessionSnapshot } from '../../domain/GameSession';
import type { AssetLoader } from '../assets/AssetLoader';
import type { WalkableWorld } from '../player/collision';
import { colorFromHex } from '../scene/colorFromHex';
import { cloneGlowMaterials, standardInstances } from '../scene/materialClones';

/**
 * World objects built from content: pickups, stations, placements (a pedestal with a lantern set on it), glyphs (stone
 * tablets that show only in spirit phase), the shop counter and its display plinths, and the bridge glow that Q01
 * unlocks. Every object starts as a placeholder, and attachModels swaps in its model once it has loaded. Each frame is
 * driven by session snapshots, not by its own state, so reloads and rules changes stay consistent.
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
const PLACED_ITEM_SIZE_M = 0.36;
const PLACEMENT_PEDESTAL_SIZE_M: readonly [number, number, number] = [0.7, 1.0, 0.7];
const SLOT_PLATE_SIZE_M = 1.1;
const SLOT_PLATE_HEIGHT_M = 0.05;
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
/** The material name the glyph models use for their jade mark. Only this material glows; the stone does not. */
const JADE_MATERIAL = 'MAT_Jade_A';

export interface WorldContent {
  readonly pickups: readonly PickupDef[];
  readonly stations: readonly StationDef[];
  readonly placements: readonly PlacementDef[];
  readonly glyphs: readonly GlyphDef[];
  readonly shop: ShopContent;
}

interface PlacementView {
  readonly placed: pc.Entity;
}

interface GlyphView {
  readonly root: pc.Entity;
  /** The materials that glow. Before the model loads this is the placeholder disc's material. */
  materials: pc.StandardMaterial[];
}

interface SlotView {
  readonly root: pc.Entity;
  readonly base: pc.Entity;
  furnitureId: string | null;
  piece: pc.Entity | null;
}

/**
 * One object's placeholder and where its model goes. `container` stays in the scene for the object's whole life, so the
 * session can show and hide it. attachModels then moves the model into the container and drops the placeholder.
 */
interface ModelSlot {
  readonly assetId: string;
  readonly container: pc.Entity;
  placeholder: pc.Entity | null;
  readonly onModel: ((model: pc.Entity) => void) | null;
}

export class WorldView {
  private readonly pickupViews = new Map<string, pc.Entity>();
  private readonly placementViews = new Map<string, PlacementView>();
  private readonly glyphViews = new Map<string, GlyphView>();
  private readonly slotViews = new Map<string, SlotView>();
  private readonly furnitureById = new Map<string, FurnitureDef>();
  private readonly modelSlots: ModelSlot[] = [];
  private readonly parent: pc.Entity;
  private readonly assets: AssetLoader;
  private bridgeMaterials: pc.StandardMaterial[] = [];
  private shopGlow: pc.StandardMaterial[] = [];

  constructor(parent: pc.Entity, content: WorldContent, world: WalkableWorld, assets: AssetLoader) {
    this.parent = parent;
    this.assets = assets;

    for (const pickup of content.pickups) {
      const root = this.groundedRoot(`PICKUP_${pickup.id}`, pickup.position, world);
      const box = this.box('PickupBox', colorFromHex(ITEM_COLORS[pickup.itemId] ?? FALLBACK_COLOR));
      box.setLocalScale(PICKUP_SIZE_M, PICKUP_SIZE_M, PICKUP_SIZE_M);
      box.setLocalPosition(0, PICKUP_SIZE_M / 2, 0);
      root.addChild(box);
      parent.addChild(root);
      this.pickupViews.set(pickup.id, root);
      this.addModelSlot(`pickup.${pickup.itemId}`, root, box);
    }

    for (const station of content.stations) {
      const root = this.groundedRoot(`STATION_${station.id}`, station.position, world);
      const marker = this.box('StationMarker', colorFromHex(STATION_COLOR), true);
      marker.setLocalScale(1.1, 0.04, 1.1);
      marker.setLocalPosition(0, 0.02, 0);
      root.addChild(marker);
      parent.addChild(root);
      this.addModelSlot(`station.${station.kind}`, root, marker);
    }

    for (const placement of content.placements) {
      const root = this.groundedRoot(`PLACEMENT_${placement.id}`, placement.position, world);
      const [pedestalWidth, pedestalHeight, pedestalDepth] = PLACEMENT_PEDESTAL_SIZE_M;

      const pedestal = new pc.Entity('Pedestal');
      const pedestalBox = this.box('PedestalBox', colorFromHex(PEDESTAL_COLOR));
      pedestalBox.setLocalScale(pedestalWidth, pedestalHeight, pedestalDepth);
      pedestalBox.setLocalPosition(0, pedestalHeight / 2, 0);
      pedestal.addChild(pedestalBox);
      root.addChild(pedestal);
      this.addModelSlot('placement.pedestal', pedestal, pedestalBox);

      // The lantern sits on the pedestal's top. It is hidden until the placement is filled.
      const placed = new pc.Entity('PlacedItem');
      const placedBox = this.box('PlacedBox', colorFromHex(ITEM_COLORS[placement.acceptsItemId] ?? FALLBACK_COLOR));
      placedBox.setLocalScale(PLACED_ITEM_SIZE_M, PLACED_ITEM_SIZE_M, PLACED_ITEM_SIZE_M);
      placedBox.setLocalPosition(0, PLACED_ITEM_SIZE_M / 2, 0);
      placed.addChild(placedBox);
      placed.setLocalPosition(0, pedestalHeight, 0);
      placed.enabled = false;
      root.addChild(placed);
      parent.addChild(root);
      this.placementViews.set(placement.id, { placed });
      this.addModelSlot(`item.${placement.acceptsItemId}`, placed, placedBox);
    }

    for (const glyph of content.glyphs) {
      const root = this.groundedRoot(`GLYPH_${glyph.id}`, glyph.position, world);
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
      // Glyphs exist only in spirit phase, so they start hidden. sync turns them on.
      root.enabled = false;
      parent.addChild(root);
      const view: GlyphView = { root, materials: [material] };
      this.glyphViews.set(glyph.id, view);
      this.addModelSlot(`glyph.${glyph.id.replace(/^glyph_/, '')}`, root, disc, (model) => {
        view.materials = cloneGlowMaterials(model, SPIRIT_JADE, (candidate) => candidate.name === JADE_MATERIAL);
      });
    }

    this.buildShop(content.shop, world);
  }

  /**
   * Replaces each placeholder with its model, once the model has loaded. A slot whose model is missing keeps its
   * placeholder, and a slot that already has its model is skipped, so calling this twice changes nothing. GameApp calls
   * it once, after the assets have loaded and before the first sync.
   */
  attachModels(): void {
    for (const slot of this.modelSlots) {
      if (!slot.placeholder) {
        continue;
      }
      const model = this.assets.instantiateLoaded(slot.assetId);
      if (!model) {
        continue;
      }
      slot.placeholder.destroy();
      slot.placeholder = null;
      slot.container.addChild(model);
      slot.onModel?.(model);
    }
  }

  /** Brings every world object in line with the session. Safe to call often. */
  sync(snapshot: SessionSnapshot): void {
    const collected = new Set(snapshot.collectedPickups);
    for (const [pickupId, root] of this.pickupViews) {
      root.enabled = !collected.has(pickupId);
    }

    const filled = new Set(snapshot.placed);
    for (const [placementId, view] of this.placementViews) {
      view.placed.enabled = filled.has(placementId);
    }

    // Glyphs fade in with the spirit layer. They are invisible in the real phase, and they only take focus once settled.
    const spiritVisible = snapshot.lantern.spiritAmount > 0;
    for (const view of this.glyphViews.values()) {
      view.root.enabled = spiritVisible;
      for (const material of view.materials) {
        material.emissiveIntensity = snapshot.lantern.spiritAmount * 2;
        material.update();
      }
    }

    for (const material of this.resolveBridgeMaterials()) {
      material.emissiveIntensity = snapshot.flags.bridge_glow ? BRIDGE_GLOW_INTENSITY : 0;
      material.update();
    }

    this.syncShop(snapshot);
  }

  dispose(): void {
    // Entities belong to the app root and are destroyed with it.
    this.pickupViews.clear();
    this.placementViews.clear();
    this.glyphViews.clear();
    this.slotViews.clear();
    this.modelSlots.length = 0;
  }

  /** An empty entity standing on the ground at a content position. */
  private groundedRoot(name: string, position: { readonly x: number; readonly z: number }, world: WalkableWorld): pc.Entity {
    const root = new pc.Entity(name);
    root.setLocalPosition(position.x, world.surfaceHeightAt(position), position.z);
    return root;
  }

  /** Registers an object's placeholder, and optionally a hook that runs once its model is in place. */
  private addModelSlot(
    assetId: string,
    container: pc.Entity,
    placeholder: pc.Entity,
    onModel?: (model: pc.Entity) => void,
  ): void {
    this.modelSlots.push({ assetId, container, placeholder, onModel: onModel ?? null });
  }

  /** The counter and the three display sockets. Sockets stay hidden until the shop level reaches them. */
  private buildShop(shop: ShopContent, world: WalkableWorld): void {
    for (const piece of shop.furniture) {
      this.furnitureById.set(piece.id, piece);
    }
    if (shop.counter) {
      const counter = this.groundedRoot(`SHOP_${shop.counter.id}`, shop.counter.position, world);
      const [width, height, depth] = COUNTER_SIZE_M;
      const box = this.box('CounterBox', colorFromHex(COUNTER_COLOR));
      box.setLocalScale(width, height, depth);
      box.setLocalPosition(0, height / 2, 0);
      counter.addChild(box);
      this.parent.addChild(counter);
      this.addModelSlot('shop.counter', counter, box);
    }
    for (const slot of shop.slots) {
      const root = this.groundedRoot(`SHOP_SLOT_${slot.id}`, slot.position, world);
      const base = new pc.Entity('SlotBase');
      const plate = this.primitive('SlotPlate', 'cylinder', colorFromHex(PEDESTAL_COLOR));
      plate.setLocalScale(SLOT_PLATE_SIZE_M, SLOT_PLATE_HEIGHT_M, SLOT_PLATE_SIZE_M);
      plate.setLocalPosition(0, SLOT_PLATE_HEIGHT_M / 2, 0);
      base.addChild(plate);
      root.addChild(base);
      root.enabled = false;
      this.parent.addChild(root);
      this.slotViews.set(slot.id, { root, base, furnitureId: null, piece: null });
      this.addModelSlot('shop.plinth', base, plate);
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
      if (!SHOP_GLOW_NODES.every((name) => standardInstances(this.parent.findByName(name)).length > 0)) {
        return;
      }
      this.shopGlow = SHOP_GLOW_NODES.flatMap((name) => cloneGlowMaterials(this.parent.findByName(name), LAMP_GOLD));
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
   * The deck's material may be shared with other wood objects, so the glow needs a material of its own. The clones are
   * made once, on first use, after the hub has been built.
   */
  private resolveBridgeMaterials(): pc.StandardMaterial[] {
    if (this.bridgeMaterials.length === 0) {
      this.bridgeMaterials = cloneGlowMaterials(this.parent.findByName(BRIDGE_DECK_NAME), SPIRIT_JADE);
    }
    return this.bridgeMaterials;
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
