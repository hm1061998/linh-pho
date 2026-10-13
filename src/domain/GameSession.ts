import { EventBus } from '../shared/events/EventBus';
import type { DialogueFile, NpcDefinition } from './content/types';
import type {
  GlyphDef,
  ItemDef,
  PickupDef,
  PlacementDef,
  PuzzleDef,
  QuestDef,
  RecipeDef,
  ShopContent,
  StationDef,
} from './content/gameplayTypes';
import { CraftingSystem, type CraftSession } from './crafting/CraftingSystem';
import { DialogueSystem, type DialogueEvent } from './dialogue/DialogueSystem';
import { FlagStore } from './flags/FlagStore';
import { Inventory, type StackView } from './inventory/Inventory';
import { LanternPhase, type LanternSnapshot } from './lantern/LanternPhase';
import { AssemblyGame, ASSEMBLY_SOCKET_IDS } from './minigame/AssemblyGame';
import { EngravingGame } from './minigame/EngravingGame';
import { ConfirmGame, type MiniGame } from './minigame/MiniGame';
import type { MiniGameStatus, MiniGameStep } from './minigame/types';
import { OrderBoard, type OrderView } from './orders/OrderBoard';
import { GlyphPuzzle, type PuzzleResult, type PuzzleView } from './puzzle/GlyphPuzzle';
import { QuestSystem, type QuestSystemEvent, type QuestView } from './quests/QuestSystem';
import { Shop, type FurnitureView, type ShopSlotView } from './shop/Shop';

/**
 * The game state for one playthrough, with no engine code. It connects the domain systems and applies rewards
 * exactly once. The engine sends interactions in (collect, craft, place, talk, scan, puzzle). It reads snapshots
 * out and listens to events (notices, panels, world changes).
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
  readonly glyphs: readonly GlyphDef[];
  readonly puzzles: readonly PuzzleDef[];
  readonly shop: ShopContent;
}

const PLAYER_FACING_REFUSALS: ReadonlySet<string> = new Set([
  'pickup_taken',
  'missing_inputs',
  'busy',
  'locked',
  'wrong_station',
  'not_spirit',
  'insufficient_coins',
  'level_locked',
  'flag_locked',
  'slot_locked',
  'slot_occupied',
  'no_stock',
  'missing_items',
  'not_available',
]);

export type PanelState =
  | { readonly kind: 'craft'; readonly stationId: string }
  | { readonly kind: 'puzzle'; readonly stationId: string; readonly puzzleId: string }
  | { readonly kind: 'shop' }
  | { readonly kind: 'inventory' };

export type SessionEvent =
  | { readonly type: 'changed' }
  | { readonly type: 'notice'; readonly textKey: string; readonly params: Readonly<Record<string, string>> }
  | { readonly type: 'panel.opened'; readonly panel: PanelState }
  | { readonly type: 'panel.closed' };

export type ActionResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/** What the minigame panel needs to draw. Read-only: it never includes anything the player has not found yet. */
export type MiniGameView =
  | {
      readonly kind: 'assembly';
      readonly status: MiniGameStatus;
      readonly sockets: readonly { readonly id: string; readonly filled: boolean }[];
      readonly misses: number;
    }
  | {
      readonly kind: 'engraving';
      readonly status: MiniGameStatus;
      /** The ring in display order. `step` is set once a mark is lit. The order itself is never shown. */
      readonly marks: readonly { readonly id: string; readonly symbolKey: string; readonly step: number | null }[];
      readonly mistakes: number;
    }
  | { readonly kind: 'confirm'; readonly status: MiniGameStatus };

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
  readonly lantern: LanternSnapshot;
  readonly puzzles: readonly PuzzleView[];
  readonly miniGame: MiniGameView | null;
  readonly shopSlots: readonly ShopSlotView[];
  readonly furniture: readonly FurnitureView[];
  /** Orders as the board shows them. `open` is true only when an active quest asks for the order to be accepted. */
  readonly orders: readonly (OrderView & { readonly open: boolean })[];
}

export class GameSession {
  readonly events = new EventBus<SessionEvent>();
  readonly flags = new FlagStore();
  readonly dialogue: DialogueSystem;
  readonly inventory: Inventory;
  readonly crafting: CraftingSystem;
  readonly quests: QuestSystem;
  readonly lantern = new LanternPhase();
  private readonly content: SessionContent;
  private readonly itemNames: ReadonlyMap<string, string>;
  private readonly pickupById: ReadonlyMap<string, PickupDef>;
  private readonly placementById: ReadonlyMap<string, PlacementDef>;
  private readonly glyphById: ReadonlyMap<string, GlyphDef>;
  private readonly npcByDialogue: ReadonlyMap<string, string>;
  private readonly puzzles: ReadonlyMap<string, GlyphPuzzle>;
  private readonly collected = new Set<string>();
  private readonly placed = new Set<string>();
  private coins = 0;
  private reputation = 0;
  private shopLevel = 0;
  private panel: PanelState | null = null;
  private miniGame: MiniGame | null = null;
  private lastLanternPhase: string = 'real';
  private readonly shopStock: Shop;
  private readonly orderBoard: OrderBoard;
  private readonly flagSet = (flag: string): boolean => this.flags.get(flag);

  constructor(content: SessionContent) {
    this.content = content;
    this.itemNames = new Map(content.items.map((item) => [item.id, item.nameKey]));
    this.pickupById = new Map(content.pickups.map((pickup) => [pickup.id, pickup]));
    this.placementById = new Map(content.placements.map((placement) => [placement.id, placement]));
    this.glyphById = new Map(content.glyphs.map((glyph) => [glyph.id, glyph]));
    this.npcByDialogue = new Map(content.npcs.map((npc) => [npc.dialogueId, npc.id]));
    this.puzzles = new Map(content.puzzles.map((puzzle) => [puzzle.id, new GlyphPuzzle(puzzle)]));

    this.dialogue = new DialogueSystem(content.dialogues, this.flags);
    this.inventory = new Inventory(content.items);
    this.crafting = new CraftingSystem(content.recipes, this.inventory, this.flags);
    this.quests = new QuestSystem(content.quests);
    this.shopStock = new Shop(content.shop.furniture, content.shop.slots);
    this.orderBoard = new OrderBoard(content.shop.orders);

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

  /** Opens the right panel for a station. An unsolved engraving table opens its puzzle first. */
  interactStation(stationId: string): ActionResult {
    const station = this.stationById(stationId);
    if (!station) {
      return this.fail('station_unknown');
    }
    const puzzle = [...this.puzzles.values()].find((candidate) => candidate.stationId === stationId && !candidate.isSolved);
    if (puzzle) {
      this.openPanel({ kind: 'puzzle', stationId, puzzleId: puzzle.id });
    } else {
      this.openPanel({ kind: 'craft', stationId });
    }
    return { ok: true };
  }

  /**
   * Opens a panel. Only one panel can be open, so opening another one replaces it. A craft lives only while its own
   * craft panel is open: leaving that panel ends the craft and returns its inputs.
   */
  openPanel(panel: PanelState): void {
    const craft = this.crafting.current;
    if (craft && !(panel.kind === 'craft' && panel.stationId === craft.stationId)) {
      this.cancelCraft();
    }
    this.panel = panel;
    this.events.emit({ type: 'panel.opened', panel });
    this.emitChanged();
  }

  /** Closing a panel never loses materials: a craft in progress is cancelled first. */
  closePanel(): void {
    if (!this.panel) {
      return;
    }
    this.cancelCraft();
    this.panel = null;
    this.events.emit({ type: 'panel.closed' });
    this.emitChanged();
  }

  // ---------- Đèn Soi Linh and glyphs ----------

  /** Starts a lantern toggle. Taps during a transition queue one toggle. Returns false only if the queue is full. */
  toggleLantern(): ActionResult {
    const wasSpirit = this.lantern.isSpirit;
    if (!this.lantern.toggle()) {
      return this.fail('lantern_busy');
    }
    this.notice(wasSpirit ? 'notice.lantern_off' : 'notice.lantern_on', {});
    this.emitChanged();
    return { ok: true };
  }

  /**
   * Advances the lantern transition. The engine calls this every frame. Emits when the phase changes, and on every
   * frame of a transition, because the glyph glow and the HUD tint read `spiritAmount`, which moves each frame.
   */
  updateLantern(dt: number): void {
    this.lantern.update(dt);
    const phase = this.lantern.snapshot.phase;
    if (phase !== this.lastLanternPhase || this.lantern.isTransitioning) {
      this.lastLanternPhase = phase;
      this.emitChanged();
    }
  }

  /** Scans a glyph. Only possible in spirit phase. Scanning counts toward the quest objective for that glyph. */
  scanGlyph(glyphId: string): ActionResult {
    const glyph = this.glyphById.get(glyphId);
    if (!glyph) {
      return this.fail('glyph_unknown');
    }
    if (!this.lantern.isSpirit) {
      return this.fail('not_spirit');
    }
    this.quests.handle({ type: 'scan', targetId: glyphId, sourceId: glyphId });
    this.notice('notice.scanned', { nameKey: glyph.symbolKey });
    this.emitChanged();
    return { ok: true };
  }

  // ---------- puzzle at the engraving table ----------

  pickGlyph(puzzleId: string, glyphId: string): PuzzleResult {
    const puzzle = this.puzzles.get(puzzleId);
    if (!puzzle) {
      return { ok: false, reason: 'unknown_glyph' };
    }
    const result = puzzle.pick(glyphId);
    this.emitChanged();
    return result;
  }

  undoGlyph(puzzleId: string): void {
    this.puzzles.get(puzzleId)?.undo();
    this.emitChanged();
  }

  clearGlyphs(puzzleId: string): void {
    this.puzzles.get(puzzleId)?.clear();
    this.emitChanged();
  }

  /**
   * Submits the entry. A right order solves the puzzle: it unlocks the recipe that depends on it and counts toward
   * the quest. A wrong order only clears the entry and counts one attempt.
   */
  submitPuzzle(puzzleId: string): PuzzleResult {
    const puzzle = this.puzzles.get(puzzleId);
    if (!puzzle) {
      return { ok: false, reason: 'unknown_glyph' };
    }
    const result = puzzle.submit();
    if (result.ok) {
      this.flags.set(puzzle.unlockFlag, true);
      this.quests.handle({ type: 'puzzle', targetId: puzzleId, sourceId: puzzleId });
      this.notice('notice.puzzle_solved', {});
    }
    this.emitChanged();
    return result;
  }

  // ---------- crafting ----------

  /**
   * Reserves the inputs and opens the minigame for the recipe. The inputs are spent only when the minigame completes.
   * A recipe with a confirm-only minigame completes at once.
   */
  beginCraft(recipeId: string, stationId: string): ActionResult {
    const start = this.crafting.begin(recipeId, stationId);
    if (!start.ok) {
      return this.fail(start.reason);
    }
    const recipe = this.content.recipes.find((candidate) => candidate.id === recipeId);
    const game = recipe ? this.createMiniGame(recipe.miniGame, stationId) : null;
    if (!game) {
      this.crafting.cancel();
      return this.fail('locked');
    }
    this.miniGame = game;
    this.finishIfComplete();
    this.emitChanged();
    return { ok: true };
  }

  /** Fits one bamboo part into a socket. `offset` is the drop distance in snap radii. Completing the frame finishes the craft. */
  assemblyPlace(socketId: string, offset: number): MiniGameStep {
    const game = this.miniGame;
    if (game?.kind !== 'assembly') {
      return { ok: false, reason: 'no_minigame' };
    }
    const step = game.place(socketId, offset);
    this.finishIfComplete();
    this.emitChanged();
    return step;
  }

  /** Lights one engraving mark. A wrong mark counts a mistake and changes nothing else. */
  engravingTap(markId: string): MiniGameStep {
    const game = this.miniGame;
    if (game?.kind !== 'engraving') {
      return { ok: false, reason: 'no_minigame' };
    }
    const step = game.tap(markId);
    this.finishIfComplete();
    this.emitChanged();
    return step;
  }

  /**
   * Ends the craft and returns the reserved inputs. The minigame goes with it, so nothing is lost and nothing is
   * duplicated. The craft panel stays open, back at the recipe list.
   */
  cancelCraft(): void {
    this.crafting.cancel();
    this.miniGame = null;
    this.emitChanged();
  }

  /** The minigame kind for a recipe. Engraving follows the solved puzzle at the station, so its order is the one the player found. */
  private createMiniGame(kind: RecipeDef['miniGame'], stationId: string): MiniGame | null {
    if (kind === 'assembly') {
      return new AssemblyGame(ASSEMBLY_SOCKET_IDS);
    }
    if (kind === 'confirm') {
      return new ConfirmGame();
    }
    const solved = [...this.puzzles.values()].find((puzzle) => puzzle.stationId === stationId && puzzle.isSolved);
    return solved ? new EngravingGame(solved.glyphIds, solved.solution) : null;
  }

  /** Completes the craft once its minigame is complete. The craft and the minigame are cleared together, so this runs once. */
  private finishIfComplete(): void {
    const game = this.miniGame;
    if (!game || game.status !== 'complete' || !game.quality) {
      return;
    }
    const done = this.crafting.complete(game.quality);
    this.miniGame = null;
    if (!done.ok) {
      return;
    }
    this.quests.handle({ type: 'craft', targetId: done.recipeId, sourceId: done.craftId });
    const itemKey = this.itemName(done.outputItemId);
    if (done.quality) {
      this.notice('notice.crafted_quality', { itemKey, qualityKey: `quality.${done.quality}` });
    } else {
      this.notice('notice.crafted', { itemKey });
    }
  }

  private miniGameView(): MiniGameView | null {
    const game = this.miniGame;
    if (!game) {
      return null;
    }
    if (game.kind === 'assembly') {
      return { kind: 'assembly', status: game.status, sockets: game.sockets(), misses: game.misses };
    }
    if (game.kind === 'engraving') {
      const marks = game.ring().map(({ id, step }) => ({
        id,
        symbolKey: this.glyphById.get(id)?.symbolKey ?? id,
        step,
      }));
      return { kind: 'engraving', status: game.status, marks, mistakes: game.mistakes };
    }
    return { kind: 'confirm', status: game.status };
  }

  /** The active craft, if any. The minigame reads it to know what it is making. */
  get activeCraft(): CraftSession | null {
    return this.crafting.current;
  }

  // ---------- shop and orders (Module 07) ----------

  /**
   * Buys one piece of furniture with earned coins. Every check runs before anything changes, then the coins go out
   * and the stock goes up in the same step. The balance can never go negative.
   */
  buyFurniture(furnitureId: string): ActionResult {
    const check = this.shopStock.checkPurchase(furnitureId, this.shopLevel, this.flagSet, this.coins);
    if (!check.ok) {
      return this.fail(check.reason);
    }
    this.coins -= check.def.price;
    const purchaseId = this.shopStock.commitPurchase(furnitureId);
    this.quests.handle({ type: 'buy', targetId: furnitureId, sourceId: purchaseId });
    this.notice('notice.bought', { itemKey: check.def.nameKey });
    this.emitChanged();
    return { ok: true };
  }

  /** Puts one owned piece into a decoration socket. A socket holds one piece, and only unlocked sockets take one. */
  placeFurniture(furnitureId: string, slotId: string): ActionResult {
    const check = this.shopStock.checkPlacement(furnitureId, slotId, this.shopLevel);
    if (!check.ok) {
      return this.fail(check.reason);
    }
    this.shopStock.commitPlacement(furnitureId, slotId);
    this.quests.handle({ type: 'place', targetId: furnitureId, sourceId: slotId });
    this.notice('notice.placed', { itemKey: check.def.nameKey });
    this.emitChanged();
    return { ok: true };
  }

  /** Accepts an order. Only an order that an active quest asks for can be accepted, and only once. */
  acceptOrder(orderId: string): ActionResult {
    const def = this.orderBoard.def(orderId);
    if (!def) {
      return this.fail('unknown_order');
    }
    if (!this.orderIsRequested(orderId) || !this.orderBoard.accept(orderId)) {
      return this.fail('not_available');
    }
    this.quests.handle({ type: 'accept', targetId: orderId, sourceId: orderId });
    this.notice('notice.order_accepted', { orderKey: def.nameKey });
    this.emitChanged();
    return { ok: true };
  }

  /**
   * Delivers an accepted order: spends the items, pays the coins and reputation, and counts toward the quest. The
   * spend and the payment cannot be split, and an order delivered once cannot pay again.
   */
  deliverOrder(orderId: string): ActionResult {
    const done = this.orderBoard.deliver(orderId, this.inventory);
    if (!done.ok) {
      return this.fail(done.reason);
    }
    this.coins += done.def.rewards.coins;
    this.reputation += done.def.rewards.reputation;
    this.quests.handle({ type: 'deliver', targetId: orderId, sourceId: orderId });
    this.notice('notice.order_delivered', { orderKey: done.def.nameKey, amount: String(done.def.rewards.coins) });
    this.emitChanged();
    return { ok: true };
  }

  /** An order is requested while some active quest still has an unfinished accept objective for it. */
  private orderIsRequested(orderId: string): boolean {
    return this.content.quests.some(
      (quest) =>
        this.quests.statusOf(quest.id) === 'active' &&
        quest.objectives.some((objective) => objective.type === 'accept' && objective.targetId === orderId),
    );
  }

  // ---------- snapshots ----------

  snapshot(): SessionSnapshot {
    const craft = this.crafting.current;
    const shopView = this.shopStock.views(this.shopLevel, this.flagSet);
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
      lantern: this.lantern.snapshot,
      puzzles: [...this.puzzles.values()].map((puzzle) => puzzle.view()),
      miniGame: this.miniGameView(),
      shopSlots: shopView.slots,
      furniture: shopView.furniture,
      orders: this.orderBoard.views(this.inventory).map((order) => ({
        ...order,
        open: order.status === 'open' && this.orderIsRequested(order.id),
      })),
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
