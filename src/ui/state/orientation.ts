/**
 * A touch-first device held in portrait. Linh Phố is built for landscape, so the game shows a blocking
 * prompt there. Browsers cannot force rotation on phones (the orientation lock only works in fullscreen
 * on some platforms), so the prompt is the enforcement.
 */
export const PORTRAIT_TOUCH_QUERY = '(pointer: coarse) and (orientation: portrait)';
