import { useSyncExternalStore } from 'react';
import { getLanguage, subscribeLanguage } from '../../content';

/** The active language. Components re-render when it changes, so the whole HUD switches at once. */
export function useLanguage() {
  return useSyncExternalStore(subscribeLanguage, getLanguage);
}
