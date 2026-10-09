'use client';

import type { AnyDialect } from '@goal-controller/dialect';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { goalClient, onGoalServerFailure } from '@/lib/workbench/goalLsp';
import type { LanguageSupport } from '@/lib/workbench/languageSupport';
import {
  languageServicesFor,
  multiplexSupport,
  type ServiceMode,
} from '@/lib/workbench/languageServices';
import { LanguageSupportContext } from './useLanguageSupport';

/**
 * Provides every view (the dialect engines' and piStar-ext's) the language
 * services of its mode, multiplexed (`languageServices.ts`): one support per
 * mode and definition for the page. The shared goal-language worker starts
 * here; if it fails, the supports are made again with its local fallback.
 */
export function LanguageServices({ children }: { children: ReactNode }) {
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    goalClient();
    return onGoalServerFailure(() => setGeneration((g) => g + 1));
  }, []);
  const [supports] = useState(
    () => new Map<string, WeakMap<AnyDialect, LanguageSupport>>(),
  );
  const provide = useCallback(
    (mode: ServiceMode, definition: AnyDialect): LanguageSupport => {
      const key = `${generation}:${mode}`;
      const byDefinition = supports.get(key) ?? new WeakMap();
      supports.set(key, byDefinition);
      let support = byDefinition.get(definition);
      if (!support) {
        support = multiplexSupport(definition, languageServicesFor(mode));
        byDefinition.set(definition, support);
      }
      return support;
    },
    [generation, supports],
  );
  return (
    <LanguageSupportContext.Provider value={provide}>
      {children}
    </LanguageSupportContext.Provider>
  );
}
