import { EventBus } from '../../shared/events/EventBus';
import type { ObjectiveType, QuestDef } from '../content/gameplayTypes';

/**
 * Quest progress from events. Each objective counts distinct sources: one pickup, one craft, or one
 * placement counts once no matter how often its event repeats. A quest completes once, and its
 * rewards are announced once. A completed quest ignores later events.
 */

export type QuestStatus = 'locked' | 'active' | 'completed';

/** A game event that may advance objectives. `sourceId` identifies the instance (pickup id, craft id, ...). */
export interface QuestEvent {
  readonly type: ObjectiveType;
  readonly targetId: string;
  readonly sourceId: string;
}

export interface QuestState {
  readonly status: QuestStatus;
  /** Distinct sources counted so far, per objective id. */
  readonly progress: Readonly<Record<string, readonly string[]>>;
}

export interface ObjectiveView {
  readonly id: string;
  readonly textKey: string;
  readonly progress: number;
  readonly count: number;
  readonly done: boolean;
}

export interface QuestView {
  readonly id: string;
  readonly titleKey: string;
  readonly status: QuestStatus;
  readonly objectives: readonly ObjectiveView[];
}

export type QuestSystemEvent =
  | { readonly type: 'quest.started'; readonly questId: string }
  | { readonly type: 'quest.progressed'; readonly questId: string; readonly objectiveId: string; readonly progress: number }
  | {
      readonly type: 'quest.completed';
      readonly questId: string;
      readonly rewards: { readonly coins: number; readonly reputation: number };
      readonly unlocks: { readonly flags: readonly string[]; readonly shopLevel: number | null };
    };

export class QuestSystem {
  readonly events = new EventBus<QuestSystemEvent>();
  private readonly defs: ReadonlyMap<string, QuestDef>;
  private readonly order: readonly string[];
  private readonly states = new Map<string, { status: QuestStatus; progress: Map<string, string[]> }>();

  constructor(quests: readonly QuestDef[]) {
    this.defs = new Map(quests.map((quest) => [quest.id, quest]));
    this.order = quests.map((quest) => quest.id);
    for (const quest of quests) {
      this.states.set(quest.id, { status: 'locked', progress: new Map() });
    }
  }

  statusOf(questId: string): QuestStatus | null {
    return this.states.get(questId)?.status ?? null;
  }

  /** Activates every auto-start quest whose prerequisites are complete. Call once on a new game. */
  start(): void {
    this.activateReady();
  }

  /** Starts a quest that is not auto-start, for example after a story effect. Ignores anything else. */
  startQuest(questId: string): boolean {
    const state = this.states.get(questId);
    const def = this.defs.get(questId);
    if (!state || !def || state.status !== 'locked' || !this.prerequisitesDone(def)) {
      return false;
    }
    state.status = 'active';
    this.events.emit({ type: 'quest.started', questId });
    return true;
  }

  /** Counts an event against every active quest. Repeated sources are ignored. */
  handle(event: QuestEvent): void {
    for (const questId of this.order) {
      const state = this.states.get(questId);
      const def = this.defs.get(questId);
      if (!state || !def || state.status !== 'active') {
        continue;
      }
      for (const objective of def.objectives) {
        if (objective.type !== event.type || objective.targetId !== event.targetId) {
          continue;
        }
        const sources = state.progress.get(objective.id) ?? [];
        if (sources.length >= objective.count || sources.includes(event.sourceId)) {
          continue;
        }
        sources.push(event.sourceId);
        state.progress.set(objective.id, sources);
        this.events.emit({ type: 'quest.progressed', questId, objectiveId: objective.id, progress: sources.length });
      }
      if (def.objectives.every((objective) => this.objectiveDone(state, objective.id, objective.count))) {
        state.status = 'completed';
        this.events.emit({
          type: 'quest.completed',
          questId,
          rewards: def.rewards,
          unlocks: def.unlocks,
        });
        this.activateReady();
      }
    }
  }

  views(): QuestView[] {
    return this.order.map((questId) => {
      const def = this.defs.get(questId);
      const state = this.states.get(questId);
      if (!def || !state) {
        return { id: questId, titleKey: questId, status: 'locked', objectives: [] };
      }
      return {
        id: def.id,
        titleKey: def.titleKey,
        status: state.status,
        objectives: def.objectives.map((objective) => {
          const progress = state.progress.get(objective.id)?.length ?? 0;
          return {
            id: objective.id,
            textKey: objective.textKey,
            progress: Math.min(progress, objective.count),
            count: objective.count,
            done: progress >= objective.count,
          };
        }),
      };
    });
  }

  /** The first active quest in content order. The HUD tracker shows it. */
  activeView(): QuestView | null {
    return this.views().find((view) => view.status === 'active') ?? null;
  }

  snapshot(): Record<string, QuestState> {
    const result: Record<string, QuestState> = {};
    for (const [questId, state] of this.states) {
      result[questId] = {
        status: state.status,
        progress: Object.fromEntries([...state.progress].map(([id, sources]) => [id, [...sources]])),
      };
    }
    return result;
  }

  /**
   * Replaces progress with a saved snapshot. Unknown quest IDs and objective IDs are ignored, so an old
   * save still loads after content changes. Quest state is not reward-checked here.
   */
  restore(saved: Readonly<Record<string, QuestState>>): void {
    for (const [questId, saveState] of Object.entries(saved)) {
      const state = this.states.get(questId);
      const def = this.defs.get(questId);
      if (!state || !def) {
        continue;
      }
      state.status = saveState.status;
      state.progress = new Map();
      for (const objective of def.objectives) {
        const sources = saveState.progress[objective.id];
        if (sources) {
          state.progress.set(objective.id, [...sources]);
        }
      }
    }
  }

  private objectiveDone(state: { progress: Map<string, string[]> }, objectiveId: string, count: number): boolean {
    return (state.progress.get(objectiveId)?.length ?? 0) >= count;
  }

  private prerequisitesDone(def: QuestDef): boolean {
    return def.prerequisites.every((id) => this.states.get(id)?.status === 'completed');
  }

  private activateReady(): void {
    let changed = true;
    while (changed) {
      changed = false;
      for (const questId of this.order) {
        const state = this.states.get(questId);
        const def = this.defs.get(questId);
        if (state && def && state.status === 'locked' && def.autoStart && this.prerequisitesDone(def)) {
          state.status = 'active';
          this.events.emit({ type: 'quest.started', questId });
          changed = true;
        }
      }
    }
  }
}
