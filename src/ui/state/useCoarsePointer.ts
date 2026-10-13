import { useEffect, useState } from 'react';

const COARSE_POINTER_QUERY = '(pointer: coarse)';

function matchesCoarsePointer(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(COARSE_POINTER_QUERY).matches;
}

/** True on touch-first devices. Follows changes, for example when a tablet gets a keyboard attached. */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(matchesCoarsePointer);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }
    const query = window.matchMedia(COARSE_POINTER_QUERY);
    const update = () => setCoarse(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return coarse;
}
