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
  /** Ambient occlusion and bloom (see render/PostEffects.ts). Off where their cost has not been measured. */
  readonly postEffects: boolean;
}

export const QUALITY_PROFILES: Readonly<Record<QualityPreset, QualityProfile>> = {
  low: { pixelRatioCap: 1, postEffects: false },
  mobile: { pixelRatioCap: 1.5, postEffects: false },
  high: { pixelRatioCap: 2, postEffects: true },
};

/** The preset to use. An explicit choice always wins. `auto` follows the device: touch-first gets the mobile preset. */
export function resolveQualityPreset(choice: QualityChoice, touchFirst: boolean): QualityPreset {
  if (choice !== 'auto') {
    return choice;
  }
  return touchFirst ? 'mobile' : 'high';
}
