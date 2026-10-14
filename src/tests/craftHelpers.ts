import { GAME_CONTENT } from '../content';
import type { GameSession } from '../domain/GameSession';
import { ASSEMBLY_SOCKET_IDS } from '../domain/minigame/AssemblyGame';

/**
 * Plays the minigames through the same session calls the panel makes. Tests use these instead of reaching into
 * the domain, so they exercise the real path: begin the craft, play the minigame, the session finishes it.
 */

/** Fits every socket's part. `offset` is the drop distance in snap radii: 0 is dead centre. The last fit completes the craft. */
export function fitFrame(session: GameSession, offset = 0): void {
  for (const socketId of ASSEMBLY_SOCKET_IDS) {
    const step = session.assemblyPlace(socketId, offset);
    if (!step.ok) {
      throw new Error(`fit ${socketId} refused: ${step.reason}`);
    }
  }
}

/** Lights the engraving ring in the solved order of the puzzle at the station. The puzzle must already be solved. */
export function engraveInSolvedOrder(session: GameSession, stationId: string): void {
  const puzzle = GAME_CONTENT.puzzles.find((candidate) => candidate.stationId === stationId);
  if (!puzzle) {
    throw new Error(`no puzzle at ${stationId}`);
  }
  for (const markId of puzzle.solution) {
    const step = session.engravingTap(markId);
    if (!step.ok) {
      throw new Error(`mark ${markId} refused: ${step.reason}`);
    }
  }
}
