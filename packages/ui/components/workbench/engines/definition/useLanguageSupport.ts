'use client';

import type { AnyDialect } from '@goal-controller/dialect';
import { createContext, useContext, useEffect } from 'react';
import {
  ENGINE_CHECKS,
  ENGINE_DIALECTS,
  type DialectEngine,
} from '@/lib/workbench/engineDialects';
import {
  localLanguageSupport,
  type LanguageSupport,
} from '@/lib/workbench/languageSupport';
import { contextOf, savedLines } from '@/lib/workbench/notationDocument';
import { useWorkbench } from '../../WorkbenchContext';

/**
 * A language support for a dialect's definition: the goal language server's
 * client, provided at the workbench's root (GoalLanguageServer). Without one
 * (the worker hasn't started, or failed), the views use the local support
 * their definition gives.
 */
export const LanguageSupportContext = createContext<
  (definition: AnyDialect) => LanguageSupport | null
>(() => null);

// one local support per engine, shared by the Notation view and the inspector
const local = new Map<DialectEngine, LanguageSupport>();
const localFor = (engine: DialectEngine): LanguageSupport => {
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
  const provided = useContext(LanguageSupportContext)(definition as AnyDialect);
  const support = provided ?? localFor(engine);
  const { tree, variables } = useWorkbench();
  useEffect(() => {
    if (!tree) return;
    support.setSaved(savedLines(definition, tree));
    support.setContext(contextOf(definition, tree, variables));
  }, [definition, support, tree, variables]);
  return support;
};
