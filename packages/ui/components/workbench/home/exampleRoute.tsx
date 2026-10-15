'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type { ProjectIndexEntry } from '@/lib/project';
import { useExamples, useOpenExample } from '../Explorer';
import { useWorkbench } from '../WorkbenchContext';

/** The search parameter naming the example open: its index path (`mutrose/medicine-delivery`). */
export const EXAMPLE_PARAM = 'example';

type ExampleRouteValue = {
  /** goes to an example: a page of its own, so the browser's back is the start screen */
  show: (example: ProjectIndexEntry) => void;
  /** the example being fetched (its index path) */
  opening: string | null;
  /** why the last example asked for didn't open */
  error: string | null;
};

const ExampleRouteContext = createContext<ExampleRouteValue | null>(null);

export const useExampleRoute = (): ExampleRouteValue => {
  const value = useContext(ExampleRouteContext);
  if (!value) throw new Error('useExampleRoute outside ExampleRoute');
  return value;
};

/**
 * An example open is the URL's: `?example=<path>` opens it (a link, a reload,
 * forward), and leaving it (back) closes it to the start screen, as Recent
 * keeps it. The URL follows the workbench too: another model opened, or this
 * one closed, and it names no example.
 */
export function ExampleRoute({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const wb = useWorkbench();
  const examples = useExamples();
  const { open, opening, error } = useOpenExample();
  const wanted = params.get(EXAMPLE_PARAM);
  // the example the URL opened, and (once open) the file it opened as
  const shown = useRef<{ path: string; fileName?: string } | null>(null);
  const latest = useRef({ wb, open, params });
  latest.current = { wb, open, params };

  /** this URL, naming `example` (none: no example) */
  const urlWith = useCallback(
    (example: string | null) => {
      const next = new URLSearchParams(latest.current.params.toString());
      if (example) next.set(EXAMPLE_PARAM, example);
      else next.delete(EXAMPLE_PARAM);
      // a path's slashes kept: `?example=mutrose/medicine-delivery`
      const query = next.toString().replace(/%2F/gi, '/');
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname],
  );

  // URL → workbench
  useEffect(() => {
    if (!wanted) {
      if (!shown.current) return;
      shown.current = null;
      latest.current.wb.closeModel();
      return;
    }
    if (shown.current?.path === wanted || !examples.data) return;
    const entry = examples.data.find((example) => example.path === wanted);
    if (!entry) {
      // no such example (any more): the start screen
      router.replace(urlWith(null));
      return;
    }
    shown.current = { path: wanted };
    void latest.current.open(entry).then((fileName) => {
      if (shown.current?.path !== wanted) return;
      if (fileName) shown.current = { path: wanted, fileName };
      else {
        // it didn't open (the start screen says why): the URL is the start screen's
        shown.current = null;
        router.replace(urlWith(null));
      }
    });
  }, [wanted, examples.data, router, urlWith]);

  // workbench → URL: the example the URL names is no longer the model open
  useEffect(() => {
    const current = shown.current;
    if (!current?.fileName) return;
    if (wb.hasModel && wb.fileName === current.fileName) return;
    shown.current = null;
    router.replace(urlWith(null));
  }, [wb.hasModel, wb.fileName, router, urlWith]);

  const show = useCallback(
    (example: ProjectIndexEntry) => router.push(urlWith(example.path)),
    [router, urlWith],
  );

  return (
    <ExampleRouteContext.Provider value={{ show, opening, error }}>
      {children}
    </ExampleRouteContext.Provider>
  );
}
