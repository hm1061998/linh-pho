/**
 * Shared types for the crafting minigames. A minigame owns only its own progress. It never touches the inventory:
 * the craft reserves the inputs when it starts and commits or releases them when it ends.
 */

export type MiniGameStatus = 'playing' | 'complete';

/** Why a minigame refused an action. A refusal is feedback for the player, and nothing is lost. */
export type MiniGameRefusal =
  | 'no_minigame'
  | 'finished'
  | 'unknown_socket'
  | 'already_filled'
  | 'miss'
  | 'unknown_mark'
  | 'wrong_mark';

export type MiniGameStep = { readonly ok: true; readonly status: MiniGameStatus } | { readonly ok: false; readonly reason: MiniGameRefusal };
