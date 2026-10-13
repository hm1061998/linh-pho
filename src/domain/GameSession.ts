import { EventBus } from '../shared/events/EventBus';
import type { DialogueFile, NpcDefinition } from './content/types';
import type { ItemDef, PickupDef, PlacementDef, QuestDef, RecipeDef, StationDef } from './content/gameplayTypes';
import { CraftingSystem, type CraftSession } from './crafting/CraftingSystem';
import { DialogueSystem, type DialogueEvent } from './dialogue/DialogueSystem';
import { FlagStore } from './flags/FlagStore';
import { Inventory, type StackView } from './inventory/Inventory';
import { QuestSystem, type QuestSystemEvent, type QuestView } from './quests/QuestSystem';
import type { Quality } from './content/gameplayTypes';

/**
 * The game state for one playthrough, with no engine code. It connects the domain systems and applies rewards
 * exactly once. The engine sends interactions in (collect, craft, place, talk). It reads snapshots out and
 * listens to events (notices, panels, world changes).
 */

export interface SessionContent {
  readonly npcs: readonly NpcDefinition[];
  readonly dialogues: DialogueFile;
  readonly items: readonly ItemDef[];
  readonly recipes: readonly RecipeDef[];
  readonly quests: readonly QuestDef[];
  readonly pickups: readonly PickupDef[];
  readonly stations: readonly StationDef[];
  readonly placements: readonly PlacementDef[];
}

const PLAYER_FACING_REFUSALS: ReadonlySet<string> = new Set([
  'pickup_taken',
  'missing_inputs',
  'busy',
  'locked',
  'wrong_station',
]);

export type PanelState ={ readonly kind: 'craft'; readonly stationId: string } | { readonly kind: 'inventory' };

export type SessionEvent =
  | { readonly type: 'changed' }
  | { readonly type: 'notice'; readonly textKey: string; readonly params: Readonly<Record<string, string>> }
  | { readonly type: 'panel.opened'; readonly panel: PanelState }
  | { readonly type: 'panel.closed' };

export type ActionResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };

export interface SessionSnapshot {
  readonly coins: number;
  readonly reputation: number;
  readonly shopLevel: number;
  readonly inventory: readonly (StackView & { readonly nameKey: string })[];
  readonly quests: readonly QuestView[];
  readonly activeQuest: QuestView | null;
  readonly panel: PanelState | null;
  readonly craft: { readonly recipeId: string; readonly stationId: string } | null;
  readonly flags: Readonly<Record<string, boolean>>;
  readonly collectedPickups: readonly string[];
  readonly placed: readonly string[];
}

export class GameSession {
  readonly events = new EventBus<SessionEvent>();
  readonly flags = new FlagStore();
  readonly dialogue: DialogueSystem;
  readonly inventory: Inventory;
  readonly crafting: CraftingSystem;
  readonly quests: QuestSystem;
  private readonly content: SessionContent;
  private readonly itemNames: ReadonlyMap<string, string>;
  private readonly pickupById: ReadonlyMap<string, PickupDef>;
  private readonly placementById: ReadonlyMap<string, PlacementDef>;
  private readonly npcByDialogue: ReadonlyMap<string, string>;
  private readonly collected = new Set<string>();
  private readonly placed = new Set<string>();
  private coins = 0;
  private reputation = 0;
  private shopLevel = 0;
  private panel: PanelState | null = null;

  constructor(content: SessionContent) {
    this.content = content;
    this.itemNames = new Map(content.items.map((item) => [item.id, item.nameKey]));
    this.pickupById = new Map(content.pickups.map((pickup) => [pickup.id, pickup]));
    this.placementById = new Map(content.placements.map((placement) => [placement.id, placement]));
    this.npcByDialogue = new Map(content.npcs.map((npc) => [npc.dialogueId, npc.id]));

    this.dialogue = new DialogueSystem(content.dialogues, this.flags);
    this.inventory = new Inventory(content.items);
    this.crafting = new CraftingSystem(content.recipes, this.inventory, this.flags);
    this.quests = new QuestSystem(content.quests);

    this.quests.events.on('quest.completed', (event) => this.applyCompletion(event));
    this.quests.events.on('quest.started', (event) => this.notice('notice.quest_started', { questKey: this.questTitle(event.questId) }));
    this.dialogue.events.on('dialogue.opened', (event: Extract<DialogueEvent, { type: 'dialogue.opened' }>) => {
      const npcId = this.npcByDialogue.get(event.view.dialogueId);
      if (npcId) {
        this.quests.handle({ type: 'talk', targetId: npcId, sourceId: `talk:${npcId}` });
      }
      this.emitChanged();
    });
    this.dialogue.events.on('dialogue.closed', () => this.emitChanged());
  }

  /** Starts a new game: activates the first quests. */
  start(): void {
    this.quests.start();
    this.emitChanged();
  }

  // ---------- interactions from the world ----------

  /** A pickup is taken once. Its item goes to the inventory, and quests count the pickup id as the source. */
  collectPickup(pickupId: string): ActionResult {
    const pickup = this.pickupById.get(pickupId);
    if (!pickup) {
      return this.fail('pickup_unknown');
    }
    if (this.collected.has(pickupId)) {
      return this.fail('pickup_taken');
    }
    if (!this.inventory.add(pickup.itemId, 1)) {
      return this.fail('pickup_invalid');
    }
    this.collected.add(pickupId);
    this.quests.handle({ type: 'collect', targetId: pickup.itemId, sourceId: pickupId });
    this.notice('notice.collected', { itemKey: this.itemName(pickup.itemId) });
    this.emitChanged();
    return { ok: true };
  }

  /** Places one unit of the accepted item on a spot. Fails with a notice when the item is missing. */
  placeItem(placementId: string): ActionResult {
    return this.placeAt(this.placementById.get(placementId), placementId);
  }

  /** Opens a panel. Only one panel can be open, so opening another one replaces it. */
  openPanel(panel: PanelState): void {
    this.panel = panel;
    this.events.emit({ type: 'panel.opened', panel });
    this.emitChanged();
  }

  closePanel(): void {
    if (!this.panel) {
      return;
    }
    this.panel = null;
    this.events.emit({ type: 'panel.closed' });
    this.emitChanged();
  }

  // ---------- crafting ----------

  beginCraft(recipeId: string, stationId: string): ActionResult {
    const start = this.crafting.begin(recipeId, stationId);
    if (!start.ok) {
      return this.fail(start.reason);
    }
    this.emitChanged();
    return { ok: true };
  }

  /** Finishes the active craft with the given quality. The output goes to the inventory, and quests count it. */
  completeCraft(quality: Quality = 'normal'): ActionResult {
    const done = this.crafting.complete(quality);
    if (!done.ok) {
      return this.fail(done.reason);
    }
    this.quests.handle({ type: 'craft', targetId: done.recipeId, sourceId: done.craftId });
    this.notice('notice.crafted', { itemKey: this.itemName(done.outputItemId) });
    this.emitChanged();
    return { ok: true };
  }

  cancelCraft(): void {
    this.crafting.cancel();
    this.emitChanged();
  }

  /** The active craft, if any. The minigame reads it to know what it is making. */
  get activeCraft(): CraftSession | null {
    return this.crafting.current;
  }

  // ---------- snapshots ----------

  snapshot(): SessionSnapshot {
    const craft = this.crafting.current;
    return {
      coins: this.coins,
      reputation: this.reputation,
      shopLevel: this.shopLevel,
      inventory: this.inventory.stackViews().map((stack) => ({
        ...stack,
        nameKey: this.itemNames.get(stack.itemId) ?? stack.itemId,
      })),
      quests: this.quests.views(),
      activeQuest: this.quests.activeView(),
      panel: this.panel,
      craft: craft ? { recipeId: craft.recipeId, stationId: craft.stationId } : null,
      flags: this.flags.snapshot(),
      collectedPickups: [...this.collected],
      placed: [...this.placed],
    };
  }

  get currentCoins(): number {
    return this.coins;
  }

  get currentReputation(): number {
    return this.reputation;
  }

  get currentPanel(): PanelState | null {
    return this.panel;
  }

  stationById(stationId: string): StationDef | undefined {
    return this.content.stations.find((station) => station.id === stationId);
  }

  // ---------- internals ----------

  private placeAt(placement: PlacementDef | undefined, placementId: string): ActionResult {
    if (!placement) {
      return this.fail('placement_unknown');
    }
    if (this.placed.has(placementId)) {
      return this.fail('placement_filled');
    }
    if (!this.inventory.spend([{ itemId: placement.acceptsItemId, count: 1 }])) {
      this.notice('notice.place_missing', { itemKey: this.itemName(placement.acceptsItemId) });
      return this.fail('item_missing');
    }
    this.placed.add(placementId);
    this.quests.handle({ type: 'place', targetId: placementId, sourceId: placementId });
    this.notice('notice.placed', { itemKey: this.itemName(placement.acceptsItemId) });
    this.emitChanged();
    return { ok: true };
  }

  /** Rewards are applied here, once per completion. The quest system emits a completion only once. */
  private applyCompletion(event: Extract<QuestSystemEvent, { type: 'quest.completed' }>): void {
    this.coins += event.rewards.coins;
    this.reputation += event.rewards.reputation;
    for (const flag of event.unlocks.flags) {
      this.flags.set(flag, true);
    }
    if (event.unlocks.shopLevel !== null) {
      this.shopLevel = Math.max(this.shopLevel, event.unlocks.shopLevel);
    }
    this.notice('notice.quest_done', { questKey: this.questTitle(event.questId) });
    if (event.rewards.coins > 0) {
      this.notice('notice.coins_gained', { amount: String(event.rewards.coins) });
    }
    this.emitChanged();
  }

  private questTitle(questId: string): string {
    return this.content.quests.find((quest) => quest.id === questId)?.titleKey ?? questId;
  }

  private itemName(itemId: string): string {
    return this.itemNames.get(itemId) ?? itemId;
  }

  private notice(textKey: string, params: Record<string, string>): void {
    this.events.emit({ type: 'notice', textKey, params });
  }

  private emitChanged(): void {
    this.events.emit({ type: 'changed' });
  }

  /** Reasons the player should hear about. Others are programming or content errors, and only the result says so. */
  private fail(reason: string): ActionResult {
    if (PLAYER_FACING_REFUSALS.has(reason)) {
      this.notice(`error.${reason}`, {});
    }
    return { ok: false, reason };
  }
}

