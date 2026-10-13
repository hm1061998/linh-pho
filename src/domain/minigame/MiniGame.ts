import type { Quality } from '../content/gameplayTypes';
import type { AssemblyGame } from './AssemblyGame';
import type { EngravingGame } from './EngravingGame';
import type { MiniGameStatus } from './types';

/**
 * A recipe with no minigame of its own. It is complete as soon as the craft begins, so the craft finishes at once.
 */
export class ConfirmGame {
  readonly kind = 'confirm' as const;
  readonly status: MiniGameStatus = 'complete';
  readonly quality: Quality = 'normal';
}

export type MiniGame = AssemblyGame | EngravingGame | ConfirmGame;
