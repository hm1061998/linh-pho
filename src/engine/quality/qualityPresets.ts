import type { QualityChoice } from '../../domain/save/SaveDocument';

/**
 * Quality presets. A preset decides how many device pixels the scene draws. It is the one knob that is already
 * wired end to end. Shadows, particle counts, and lightmaps wait for the real asset pipeline (Module 09 brief), and
 * the presets will grow then, not before.
 */

export type QualityPreset = Exclude<QualityChoice, 'auto'>;

export interface QualityProfile {
  /** The highest device-pixel ratio the canvas renders at. Lower means cheaper frames, softer image. */
  readonly pixelRatioCap: number;
}

export const QUALITY_PROFILES: Readonly<Record<QualityPreset, QualityProfile>> = {
  low: { pixelRatioCap: 1 },
  mobile: { pixelRatioCap: 1.5 },
  high: { pixelRatioCap: 2 },
};

/** The preset to use. An explicit choice always wins. `auto` follows the pointer: touch devices get the mobile preset. */
export function resolveQualityPreset(choice: QualityChoice, coarsePointer: boolean): QualityPreset {
  if (choice !== 'auto') {
    return choice;
  }
  return coarsePointer ? 'mobile' : 'high';
}

/** True on touch-first devices. Missing `matchMedia` (old browsers, tests) counts as a fine pointer. */
export function isCoarsePointer(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}
