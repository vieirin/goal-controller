'use client';

import type { AnyDialect } from '@goal-controller/dialect';
import { createContext, useContext, useEffect } from 'react';
import {
  ENGINE_DIALECTS,
  type DialectEngine,
} from '@/lib/workbench/engineDialects';
import type { LanguageSupport } from '@/lib/workbench/languageSupport';
import {
  languageServicesFor,
  multiplexSupport,
  type ServiceMode,
} from '@/lib/workbench/languageServices';
import { contextOf, savedLines } from '@/lib/workbench/notationDocument';
import { useWorkbench } from '../../WorkbenchContext';

// one support per mode and definition when no provider is there (tests, other hosts)
const fallback = new Map<ServiceMode, WeakMap<AnyDialect, LanguageSupport>>();

/**
 * The language support a view of a mode gets: its language services,
 * multiplexed (lib/workbench/languageServices.ts), provided at the
 * workbench's root (LanguageServices).
 */
export const LanguageSupportContext = createContext<
  (mode: ServiceMode, definition: AnyDialect) => LanguageSupport
>((mode, definition) => {
  const byDefinition = fallback.get(mode) ?? new WeakMap();
  fallback.set(mode, byDefinition);
  let support = byDefinition.get(definition);
  if (!support) {
    support = multiplexSupport(definition, languageServicesFor(mode));
    byDefinition.set(definition, support);
  }
  return support;
});

/** The engine's language support, told about the model as it changes. */
export const useLanguageSupport = (engine: DialectEngine): LanguageSupport => {
  const definition = ENGINE_DIALECTS[engine];
  const support = useContext(LanguageSupportContext)(
    engine,
    definition as AnyDialect,
  );
  const { tree, variables, text } = useWorkbench();
  useEffect(() => {
    if (!tree) return;
    support.setSaved(savedLines(definition, tree));
    support.setContext(contextOf(definition, tree, variables));
  }, [definition, support, tree, variables]);
  // a service that reads the model file itself (an engine's server)
  useEffect(() => support.setModelText?.(text), [support, text]);
  return support;
};
