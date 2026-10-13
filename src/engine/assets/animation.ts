/**
 * Which animation a model should play. The requested clip wins when the model has it. Otherwise the idle loop plays.
 * If the model has no idle either, nothing plays and the model stays still. A missing clip is never an error: the
 * game must run with any subset of its models.
 */
export function resolveAnimation(requested: string | null, available: readonly string[], idle: string | null): string | null {
  if (requested !== null && available.includes(requested)) {
    return requested;
  }
  if (idle !== null && available.includes(idle)) {
    return idle;
  }
  return null;
}
