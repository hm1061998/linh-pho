import { useEffect, useState } from 'react';

function canMatch(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

function matches(query: string): boolean {
  return canMatch() && window.matchMedia(query).matches;
}

/** Live value of a CSS media query. Updates when the query changes, for example on rotation. */
export function useMediaQuery(query: string): boolean {
  const [value, setValue] = useState(() => matches(query));

  useEffect(() => {
    if (!canMatch()) {
      return;
    }
    const list = window.matchMedia(query);
    const update = () => setValue(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return value;
}
