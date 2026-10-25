'use client';

import type { AnyDialect } from '@goal-controller/dialect';
import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
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
import { poolEditOperations } from '@/lib/workbench/poolDocuments';
import type { PoolHost } from '@/lib/workbench/poolSupport';
import { useWorkbench } from '../../WorkbenchContext';
import { useEditModel } from '../shared/inspector';

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
export const useLanguageSupport = (engine: DialectEngine): LanguageSupport =>
  useOptionalLanguageSupport(engine)!;

/** The same, for a mode that may have no engine's (null then): a resource's tab. */
export const useOptionalLanguageSupport = (
  engine: DialectEngine | null,
): LanguageSupport | null => {
  const definition = engine && ENGINE_DIALECTS[engine];
  const supportOf = useContext(LanguageSupportContext);
  const support =
    engine && definition ? supportOf(engine, definition as AnyDialect) : null;
  const wb = useWorkbench();
  const { tree, variables, text, projectResources } = wb;
  useEffect(() => {
    if (!tree || !support || !definition) return;
    support.setSaved(savedLines(definition, tree));
    // the project's resources, parsed, go with the model (goal/context)
    support.setContext(
      contextOf(definition, tree, variables, projectResources),
    );
  }, [definition, support, tree, variables, projectResources]);
  // a service that reads the model file itself (an engine's server)
  useEffect(() => support?.setModelText?.(text), [support, text]);

  return support;
};

/**
 * A service that reads the project's files (a definition pool) is told
 * about them here, once for the workbench whatever tab is shown: the open
 * model and every resource, and how it opens a location or renames.
 */
export const useProjectWorkspace = (engine: DialectEngine | null): void => {
  const definition = engine && ENGINE_DIALECTS[engine];
  const supportOf = useContext(LanguageSupportContext);
  const support =
    engine && definition ? supportOf(engine, definition as AnyDialect) : null;
  const wb = useWorkbench();
  const { tree } = wb;
  const { resourceSlots, resourceTexts } = wb;
  const resources = useMemo(
    () =>
      resourceSlots.flatMap((slot) =>
        slot.paths.flatMap((path) =>
          resourceTexts[path] === undefined
            ? []
            : [{ kind: slot.kind, path, text: resourceTexts[path]! }],
        ),
      ),
    [resourceSlots, resourceTexts],
  );
  const latest = useRef(wb);
  latest.current = wb;
  const edit = useEditModel();
  const latestEdit = useRef(edit);
  latestEdit.current = edit;
  const host = useMemo<PoolHost>(
    () => ({
      navigate: (location) => latest.current.revealLocation(location),
      applyEdits: (edits) => {
        const now = latest.current;
        // a project read from a store that can't be written (an example's)
        if (
          edits.some((e) => !e.document.startsWith('model:')) &&
          (now.project?.store.readOnly ?? true)
        )
          return 'The project’s files are read only: make a browser copy to rename across them';
        const { resources: changed, operations } = poolEditOperations(edits, {
          resources: now.resourceTexts,
          tree: now.tree,
        });
        for (const [path, next] of Object.entries(changed))
          now.setResourceText(path, next);
        if (operations.length > 0) void latestEdit.current(...operations);
        return null;
      },
    }),
    [],
  );
  useEffect(
    () => support?.setWorkspace?.({ tree, resources }, host),
    [support, tree, resources, host],
  );
};
