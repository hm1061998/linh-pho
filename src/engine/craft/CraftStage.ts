import * as pc from 'playcanvas';
import type { SessionSnapshot } from '../../domain/GameSession';
import type { AssetLoader } from '../assets/AssetLoader';
import { colorFromHex } from '../scene/colorFromHex';
import {
  CRAFT_SNAP_SECONDS,
  markPosition,
  segmentShape,
  snapProgressToHeight,
  socketPosition,
  trailSegments,
} from './craftLayout';

/** Where the two craft stations stand, in metres. The stage appears at the station of the craft in progress. */
export interface CraftStations {
  readonly assembly: { readonly x: number; readonly z: number };
  readonly engraving: { readonly x: number; readonly z: number };
}

const TRAIL_THICKNESS_M = 0.012;
const MARK_RADIUS_M = 0.028;
const TURN_SPEED = 6;

interface Rib {
  readonly entity: pc.Entity;
  readonly socketIndex: number;
  elapsed: number;
}

/**
 * The 3D side of the two craft minigames (GDD B5). The HTML panel takes the player's input. This stage shows the lantern in
 * the world and follows the minigame's state: a rib drops into each socket as it is filled, and a light trail runs along
 * the marks in the order they were lit. It only reads snapshots, so it can never change the game.
 */
export class CraftStage {
  private readonly parent: pc.Entity;
  private readonly assets: AssetLoader;
  private readonly stations: CraftStations;
  private root: pc.Entity | null = null;
  private kind: 'assembly' | 'engraving' | null = null;
  private readonly ribs = new Map<string, Rib>();
  private readonly marks: pc.Entity[] = [];
  private trail: pc.Entity[] = [];
  private yaw = 0;
  private yawTarget = 0;

  constructor(parent: pc.Entity, assets: AssetLoader, stations: CraftStations) {
    this.parent = parent;
    this.assets = assets;
    this.stations = stations;
  }

  /** Brings the stage in line with the minigame in progress. Called on every session change. */
  sync(snap: SessionSnapshot): void {
    const game = snap.miniGame;
    if (!game || !snap.craft || (game.kind !== 'assembly' && game.kind !== 'engraving')) {
      this.clear();
      return;
    }
    if (this.kind !== game.kind) {
      this.clear();
      this.build(game.kind);
    }
    if (game.kind === 'assembly') {
      this.syncSockets(game.sockets);
    } else {
      this.syncMarks(game.marks);
    }
  }

  /** Turns the stage by `degrees`, smoothly. The panel's rotate button calls this. */
  rotate(degrees: number): void {
    this.yawTarget += degrees;
  }

  /** Advances the drop of each rib and the turn of the stage. `dt` is the frame's time, already clamped by the engine. */
  update(dt: number): void {
    if (!this.root) {
      return;
    }
    this.yaw += (this.yawTarget - this.yaw) * Math.min(1, dt * TURN_SPEED);
    this.root.setLocalEulerAngles(0, this.yaw, 0);
    for (const rib of this.ribs.values()) {
      // A rib drops until it lands, then stays where it is.
      if (rib.elapsed < CRAFT_SNAP_SECONDS) {
        rib.elapsed = Math.min(CRAFT_SNAP_SECONDS, rib.elapsed + dt);
        const socket = socketPosition(rib.socketIndex);
        rib.entity.setLocalPosition(socket.x, snapProgressToHeight(rib.elapsed / CRAFT_SNAP_SECONDS), socket.z);
      }
    }
  }

  /** Removes the stage from the world. */
  dispose(): void {
    this.clear();
  }

  private build(kind: 'assembly' | 'engraving'): void {
    this.kind = kind;
    const station = kind === 'assembly' ? this.stations.assembly : this.stations.engraving;
    const root = new pc.Entity(kind === 'assembly' ? 'CRAFT_Stage_Assembly' : 'CRAFT_Stage_Engraving');
    root.setLocalPosition(station.x, 0, station.z);
    this.parent.addChild(root);
    this.root = root;

    const model = this.assets.instantiateLoaded(kind === 'assembly' ? 'craft.lantern_frame' : 'craft.engraving_lantern');
    if (model) {
      root.addChild(model);
    }
  }

  private syncSockets(sockets: readonly { readonly id: string; readonly filled: boolean }[]): void {
    if (!this.root) {
      return;
    }
    sockets.forEach((socket, index) => {
      const rib = this.ribs.get(socket.id);
      if (socket.filled && !rib) {
        const entity = this.assets.instantiateLoaded('craft.bamboo_rib');
        if (!entity) {
          return;
        }
        const place = socketPosition(index);
        entity.setLocalPosition(place.x, snapProgressToHeight(0), place.z);
        this.root?.addChild(entity);
        this.ribs.set(socket.id, { entity, socketIndex: index, elapsed: 0 });
      } else if (!socket.filled && rib) {
        rib.entity.destroy();
        this.ribs.delete(socket.id);
      }
    });
  }

  private syncMarks(marks: readonly { readonly step: number | null }[]): void {
    if (!this.root) {
      return;
    }
    const count = marks.length;
    if (this.marks.length !== count) {
      this.clearMarks();
      marks.forEach((_, index) => {
        const dot = this.primitive('sphere', colorFromHex('#65D4BD'), 0);
        const place = markPosition(index, count);
        dot.setLocalPosition(place.x, place.y, place.z);
        dot.setLocalScale(MARK_RADIUS_M * 2, MARK_RADIUS_M * 2, MARK_RADIUS_M * 2);
        this.root?.addChild(dot);
        this.marks.push(dot);
      });
    }
    const lit: { index: number; step: number }[] = [];
    marks.forEach((mark, index) => {
      const dot = this.marks[index];
      const isLit = mark.step !== null;
      if (dot?.render?.material instanceof pc.StandardMaterial) {
        dot.render.material.emissiveIntensity = isLit ? 2.4 : 0.35;
        dot.render.material.update();
      }
      if (mark.step !== null) {
        lit.push({ index, step: mark.step });
      }
    });
    this.drawTrail(lit, count);
  }

  /** Rebuilds the light trail. The trail is a few thin boxes, so rebuilding it on each change costs nothing. */
  private drawTrail(lit: readonly { index: number; step: number }[], count: number): void {
    for (const entity of this.trail) {
      entity.destroy();
    }
    this.trail = [];
    for (const { from, to } of trailSegments(lit, count)) {
      const { mid, length } = segmentShape(from, to);
      const segment = this.primitive('box', colorFromHex('#65D4BD'), 2.4);
      segment.setLocalPosition(mid.x, mid.y, mid.z);
      // The box runs along its local Z. Turning it about Y points that Z along the segment, since every mark is on one ring.
      segment.setLocalEulerAngles(0, (Math.atan2(to.x - from.x, to.z - from.z) * 180) / Math.PI, 0);
      segment.setLocalScale(TRAIL_THICKNESS_M, TRAIL_THICKNESS_M, length);
      this.root?.addChild(segment);
      this.trail.push(segment);
    }
  }

  private clearMarks(): void {
    for (const dot of this.marks) {
      dot.destroy();
    }
    this.marks.length = 0;
  }

  private clear(): void {
    for (const rib of this.ribs.values()) {
      rib.entity.destroy();
    }
    this.ribs.clear();
    this.clearMarks();
    for (const entity of this.trail) {
      entity.destroy();
    }
    this.trail = [];
    this.root?.destroy();
    this.root = null;
    this.kind = null;
    this.yaw = 0;
    this.yawTarget = 0;
  }

  /** A lit, emissive primitive, for the marks and the trail. Emission in `glow` is 0 when the piece should not glow. */
  private primitive(type: 'sphere' | 'box', color: pc.Color, glow: number): pc.Entity {
    const material = new pc.StandardMaterial();
    material.diffuse = color;
    material.emissive = color;
    material.emissiveIntensity = glow;
    material.update();
    const entity = new pc.Entity(`CRAFT_${type}`);
    entity.addComponent('render', { type, material });
    return entity;
  }
}
