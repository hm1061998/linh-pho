/**
 * Why the game failed to start. The UI maps each code to a player-facing message.
 * Keep this module free of PlayCanvas and DOM imports so it can be unit-tested in Node.
 */
export type GameStartupErrorCode = 'webgl2_unavailable' | 'engine_init_failed';

export class GameStartupError extends Error {
  readonly code: GameStartupErrorCode;

  constructor(code: GameStartupErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'GameStartupError';
    this.code = code;
  }
}

/**
 * Converts a rejection from `createGraphicsDevice()` into a typed startup error.
 * GameApp requests only WebGL2, and the engine rejects with AggregateError only after every
 * requested device type has failed, so an AggregateError here means WebGL2 is unavailable.
 */
export function toGraphicsStartupError(error: unknown): GameStartupError {
  if (error instanceof AggregateError) {
    return new GameStartupError('webgl2_unavailable', 'WebGL2 graphics device could not be created.', {
      cause: error,
    });
  }
  return new GameStartupError('engine_init_failed', 'Graphics device initialization failed.', {
    cause: error,
  });
}
