/**
 * Analytics events the game may report. The names are a closed list, so a typo cannot ship. The shipped adapter does
 * nothing: no data leaves the device, and no third-party service is called. A real adapter needs a privacy review
 * first (docs/PRIVACY.md).
 */
export type AnalyticsEvent = { readonly name: 'chapter.completed'; readonly chapter: 'first_chapter' };

export interface AnalyticsPort {
  track(event: AnalyticsEvent): void;
}

export const NO_ANALYTICS: AnalyticsPort = {
  track: () => undefined,
};
