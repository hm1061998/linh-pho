import { useMediaQuery } from './useMediaQuery';

/** Touch-first device (phone or tablet). */
export const COARSE_POINTER_QUERY = '(pointer: coarse)';

/**
 * True on touch-first devices. Follows changes, for example when a tablet gets a keyboard attached.
 */
export function useCoarsePointer(): boolean {
  return useMediaQuery(COARSE_POINTER_QUERY);
}
