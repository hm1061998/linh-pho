import type { Quality } from '../content/gameplayTypes';

/**
 * Turns a 0..1 minigame score into a quality. The thresholds are generous on purpose: a finished craft is never a
 * failure, and a weaker score only means Normal.
 */
export const GOOD_SCORE = 0.6;
export const PERFECT_SCORE = 0.8;

export function clampScore(score: number): number {
  return Math.min(1, Math.max(0, score));
}

export function qualityFromScore(score: number): Quality {
  if (score >= PERFECT_SCORE) {
    return 'perfect';
  }
  if (score >= GOOD_SCORE) {
    return 'good';
  }
  return 'normal';
}
