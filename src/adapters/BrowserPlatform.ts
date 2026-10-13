import type { PlatformPort } from '../ports/PlatformPort';

/** The parts of the browser the platform adapter reads. Injected, so tests can describe any device. */
export interface BrowserEnvironment {
  readonly matchMedia?: (query: string) => { readonly matches: boolean };
  readonly language?: string;
}

/** Reads the device from a browser environment. Anything missing counts as a desktop with an unknown language. */
export function platformFrom(env: BrowserEnvironment): PlatformPort {
  let touchFirst = false;
  try {
    touchFirst = env.matchMedia?.('(pointer: coarse)').matches ?? false;
  } catch {
    // Some old engines throw on unknown media queries. Treat the device as a desktop.
    touchFirst = false;
  }
  return { touchFirst, languageTag: env.language ?? '' };
}

/** The platform of the page this code runs in. Called once, at startup. */
export function browserPlatform(): PlatformPort {
  return platformFrom({
    matchMedia: typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? (query) => window.matchMedia(query) : undefined,
    language: typeof navigator !== 'undefined' ? navigator.language : undefined,
  });
}
