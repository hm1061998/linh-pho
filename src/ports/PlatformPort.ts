/**
 * What the device offers, as far as the game needs it. The game asks this port instead of reading the browser
 * directly, so the rules about touch and language can be tested with a fake device.
 */
export interface PlatformPort {
  /** True on touch-first devices, where the pointer is coarse. */
  readonly touchFirst: boolean;
  /** The browser's preferred language tag, such as "vi-VN". Empty when unknown. */
  readonly languageTag: string;
}
