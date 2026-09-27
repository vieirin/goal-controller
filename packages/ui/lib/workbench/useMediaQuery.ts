'use client';

import { useEffect, useState } from 'react';

/** Tracks a CSS media query (client only). */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
};

/** Phones and narrow windows get the single-view layout. */
export const useIsMobile = (): boolean => useMediaQuery('(max-width: 767px)');
