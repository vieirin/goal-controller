'use client';

import type { DialectDefinition } from '@goal-controller/dialect';
import { createContext, useContext, useEffect } from 'react';
import {
  ENGINE_CHECKS,
  ENGINE_DIALECTS,
  type DialectEngine,
} from '@/lib/workbench/engineDialects';
import {
  localLanguageSupport,
  type LanguageSupport,
  type LocalLanguageSupport,
} from '@/lib/workbench/languageSupport';
import { contextOf, savedLines } from '@/lib/workbench/notationDocument';
import { useWorkbench } from '../../WorkbenchContext';

/**
 * A language support for an engine's definition (e.g. a language server's client),
 * provided by whoever starts one. None is provided in this phase: the views use the
 * local support their definition gives.
 */
export const LanguageSupportContext = createContext<
  (definition: DialectDefinition) => LanguageSupport | null
>(() => null);

// one local support per engine, shared by the Notation view and the inspector
const local = new Map<DialectEngine, LocalLanguageSupport>();
const localFor = (engine: DialectEngine): LocalLanguageSupport => {
  let support = local.get(engine);
  if (!support) {
    support = localLanguageSupport(
      ENGINE_DIALECTS[engine],
      ENGINE_CHECKS[engine],
    );
    local.set(engine, support);
  }
  return support;
};

/** The engine's language support, told about the model as it changes. */
export const useLanguageSupport = (engine: DialectEngine): LanguageSupport => {
  const definition = ENGINE_DIALECTS[engine];
  const provided = useContext(LanguageSupportContext)(definition);
  const support = provided ?? localFor(engine);
  const { tree, variables } = useWorkbench();
  useEffect(() => {
    if (!tree) return;
    support.setContext(contextOf(definition, tree, variables));
    if (!provided)
      (support as LocalLanguageSupport).setSaved(savedLines(definition, tree));
  }, [definition, support, provided, tree, variables]);
  return support;
};
