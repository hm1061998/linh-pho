import * as pc from 'playcanvas';
import type { GlyphDef, PickupDef, PlacementDef, StationDef } from '../../domain/content/gameplayTypes';
import type { SessionSnapshot } from '../../domain/GameSession';
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

export interface WorldContent {
  readonly pickups: readonly PickupDef[];
  readonly stations: readonly StationDef[];
  readonly placements: readonly PlacementDef[];
  readonly glyphs: readonly GlyphDef[];
}

interface PlacementView {
  readonly headMaterial: pc.StandardMaterial;
  readonly placed: pc.Entity;
}

interface GlyphView {
  readonly root: pc.Entity;
  readonly material: pc.StandardMaterial;
}

export class WorldView {
  private readonly pickupViews = new Map<string, pc.Entity>();
  private readonly placementViews = new Map<string, PlacementView>();
  private readonly glyphViews = new Map<string, GlyphView>();
  private readonly parent: pc.Entity;
  private bridgeMaterial: pc.StandardMaterial | null = null;

  constructor(parent: pc.Entity, content: WorldContent, world: WalkableWorld) {
    this.parent = parent;
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
  }

  dispose(): void {
    // Entities belong to the app root and are destroyed with it.
    this.pickupViews.clear();
    this.placementViews.clear();
    this.glyphViews.clear();
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
