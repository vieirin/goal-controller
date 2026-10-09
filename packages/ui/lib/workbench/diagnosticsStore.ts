/**
 * What the language services say of the open documents (the Notation view,
 * the inspector's fields, the model a server reads), in istar-ts's
 * diagnostics store: one source per service (`goal language`, an engine
 * server's id) or engine (its named checks). A service publishes per
 * document, a publication replacing its last one for that document, as an
 * LSP server's `publishDiagnostics` does; the store holds each source's
 * union. The workbench merges `getAll()` with its other problems.
 */
import { createDiagnosticsStore } from '@istar-ts/core';
import { useSyncExternalStore } from 'react';
import { SOURCE, type Problem } from './types';

export const serviceDiagnostics = createDiagnosticsStore();

/** By service and document: what each said last. */
const published = new Map<string, readonly Problem[]>();
const slice = (service: string, document: string) =>
  `${service}\u0000${document}`;

/** Every source's union, published to the store (a source gone is cleared). */
const republish = () => {
  const bySource = new Map<string, Problem[]>();
  for (const problems of published.values())
    for (const problem of problems) {
      // the store holds diagnostics about elements; the file's are the workbench's
      if (problem.elementId === undefined) continue;
      const source = problem.source ?? SOURCE.language;
      bySource.set(source, [...(bySource.get(source) ?? []), problem]);
    }
  for (const source of serviceDiagnostics.sources())
    if (!bySource.has(source)) serviceDiagnostics.clear(source);
  for (const [source, problems] of bySource)
    serviceDiagnostics.publish(
      source,
      problems.map((problem) => ({
        ...problem,
        elementId: problem.elementId!,
      })),
    );
};

/** A service's diagnostics of a document: they replace its last ones there. */
export const publishDiagnostics = (
  service: string,
  document: string,
  diagnostics: readonly Problem[],
): void => {
  const id = slice(service, document);
  if (!published.has(id) && diagnostics.length === 0) return;
  if (diagnostics.length === 0) published.delete(id);
  else published.set(id, diagnostics);
  republish();
};

/** Forgets what every service said of a document (closed in its editor). */
export const forgetDocument = (document: string): void => {
  for (const id of published.keys())
    if (id.endsWith(`\u0000${document}`)) published.delete(id);
  republish();
};

/** Everything the services say now, re-rendering when it changes. */
export const useServiceDiagnostics = (): readonly Problem[] =>
  useSyncExternalStore(
    (listener) => serviceDiagnostics.subscribe(listener),
    () => serviceDiagnostics.getAll(),
    () => serviceDiagnostics.getAll(),
  );
