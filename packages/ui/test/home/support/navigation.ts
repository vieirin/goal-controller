/**
 * next/navigation in memory, for the tests: one URL, its router's push and
 * replace changing it, and the hooks re-rendering on a change, as the app's
 * router does. `location.set` stands for the browser's back and forward.
 */
import { useMemo, useSyncExternalStore } from 'react';
import { vi } from 'vitest';

let url = new URL('http://localhost/');
const subscribers = new Set<() => void>();
const subscribe = (notify: () => void) => {
  subscribers.add(notify);
  return () => void subscribers.delete(notify);
};

export const location = {
  /** where the app is: its path and search */
  get href() {
    return `${url.pathname}${url.search}`;
  },
  set(to: string) {
    url = new URL(to, url);
    subscribers.forEach((notify) => notify());
  },
};

export const router = {
  push: vi.fn((to: string) => location.set(to)),
  replace: vi.fn((to: string) => location.set(to)),
};

export const useRouter = () => router;
export const usePathname = () =>
  useSyncExternalStore(subscribe, () => url.pathname);
export const useSearchParams = () => {
  const search = useSyncExternalStore(subscribe, () => url.search);
  return useMemo(() => new URLSearchParams(search), [search]);
};
