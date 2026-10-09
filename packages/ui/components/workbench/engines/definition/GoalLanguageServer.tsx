'use client';

import type { LSPClient } from '@codemirror/lsp-client';
import type { AnyDialect } from '@goal-controller/dialect';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { goalClient, onGoalServerFailure } from '@/lib/workbench/goalLsp';
import type { LanguageSupport } from '@/lib/workbench/languageSupport';
import { serverLanguageSupport } from '@/lib/workbench/serverLanguageSupport';
import { LanguageSupportContext } from './useLanguageSupport';

// one support per definition object, for every view on the page
const supports = new WeakMap<object, LanguageSupport>();

/**
 * Provides the goal language server's support to every dialect's views (the
 * engines' and piStar-ext's). Until the worker runs, or if it fails, none is
 * provided: the views use their local support.
 */
export function GoalLanguageServer({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<LSPClient | null>(null);
  useEffect(() => {
    setClient(goalClient());
    return onGoalServerFailure(() => setClient(null));
  }, []);
  const provide = useCallback(
    (definition: AnyDialect): LanguageSupport | null => {
      if (!client) return null;
      let support = supports.get(definition);
      if (!support) {
        support = serverLanguageSupport(definition, client);
        supports.set(definition, support);
      }
      return support;
    },
    [client],
  );
  return (
    <LanguageSupportContext.Provider value={provide}>
      {children}
    </LanguageSupportContext.Provider>
  );
}
