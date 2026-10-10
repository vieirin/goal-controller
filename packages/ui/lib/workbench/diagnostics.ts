/**
 * The workbench's side of the diagnostics protocol (istar-ts's
 * `GoalDiagnostic`, goal-controller#24): how its producers' problems are
 * merged and grouped, and how a language's or a server's diagnostics become
 * problems. The rule is istar-ts's: a union, one per element, property and
 * message, the most severe kept.
 */
import type { AnyDialect } from '@goal-controller/dialect';
import type { Diagnostic } from '@goal-controller/goal-language';
import { readFieldUri } from '@goal-controller/goal-language/light';
import {
  compareSeverity,
  fromLspDiagnostics,
  groupDiagnostics,
  mergeDiagnostics,
  type DiagnosticRange,
  type GoalDiagnostic,
} from '@istar-ts/core';
import type { PublishedDiagnostics } from './goalLsp';
import { elementOfLine } from './notationDocument';
import { SOURCE, type Problem } from './types';

const anchored = (problem: Problem): problem is GoalDiagnostic =>
  problem.elementId !== undefined;

/**
 * Several producers' problems as one list: the anchored ones merged by
 * istar-ts's rule, those of the file or the run kept once per message; the
 * most severe first.
 */
export const mergeProblems = (
  ...lists: readonly (readonly Problem[])[]
): Problem[] => {
  const model = new Map<string, Problem>();
  for (const problem of lists.flat())
    if (!anchored(problem) && !model.has(problem.message))
      model.set(problem.message, problem);
  return [
    ...model.values(),
    ...mergeDiagnostics(lists.map((list) => list.filter(anchored))),
  ].sort((a, b) => compareSeverity(a.severity, b.severity));
};

/**
 * Problems as the Problems panel shows them: by element (the model's own
 * first), then by who said it, in the order they come.
 */
export const problemGroups = (
  problems: readonly Problem[],
): {
  elementId: string | undefined;
  sources: { source: string; problems: Problem[] }[];
}[] => {
  const bySource = (list: readonly Problem[]) => {
    const sources = new Map<string, Problem[]>();
    for (const problem of list) {
      const source = problem.source ?? SOURCE.workbench;
      sources.set(source, [...(sources.get(source) ?? []), problem]);
    }
    return [...sources].map(([source, problems]) => ({ source, problems }));
  };
  const model = problems.filter((problem) => !anchored(problem));
  return [
    ...(model.length
      ? [{ elementId: undefined, sources: bySource(model) }]
      : []),
    ...[...groupDiagnostics(problems.filter(anchored))].map(
      ([elementId, list]) => ({ elementId, sources: bySource(list) }),
    ),
  ];
};

/** An offset in a text as a zero-based line and character (LSP's). */
const positionIn = (lines: readonly string[], offset: number) => {
  let line = 0;
  let at = offset;
  while (line < lines.length - 1 && at > (lines[line]?.length ?? 0)) {
    at -= (lines[line]?.length ?? 0) + 1;
    line++;
  }
  return { line, character: at };
};

/**
 * The goal language's diagnostics of a text as problems: anchored as the
 * language anchored them, said by the goal language, or by the engine (its
 * name) when one of its named checks did.
 */
export const languageProblems = (
  diagnostics: readonly Diagnostic[],
  engine: string,
  text?: string,
): Problem[] => {
  const lines = text?.split('\n');
  return diagnostics.map(
    ({ from, to, severity, message, elementId, key, check }) => ({
      severity,
      message,
      source: check ? engine : SOURCE.language,
      ...(lines && {
        range: {
          start: positionIn(lines, from),
          end: positionIn(lines, to),
        } satisfies DiagnosticRange,
      }),
      ...(elementId !== undefined && { elementId }),
      ...(key !== undefined && { key }),
    }),
  );
};

/**
 * What a language server published for a document, as problems
 * (istar-ts's `fromLspDiagnostics`): anchored by the diagnostic's `data`
 * (`{ elementId, key?, check? }`, or an engine server's `nodeId`). A server
 * anchoring by `range`, or a diagnostic without data, falls back to the
 * document: a field's URI names its element and property, a Notation
 * document's line its element. Said by the service, or by the engine when
 * one of its named checks did.
 */
export const serverProblems = (
  { uri, diagnostics }: PublishedDiagnostics,
  service: { id: string; anchoring: 'data' | 'range' },
  definition: AnyDialect,
  text: string | undefined,
  /** whether the model has an element of this key (a repeated scoped id's is `G3/T1.1`) */
  has?: (key: string) => boolean,
): Problem[] => {
  const field = readFieldUri(uri);
  const lines = text?.split('\n');
  const byRange = (diagnostic: (typeof diagnostics)[number]) =>
    field?.id ??
    (lines
      ? (elementOfLine(definition, lines, diagnostic.range.start.line, has) ??
        undefined)
      : undefined);
  return fromLspDiagnostics(
    service.anchoring === 'data'
      ? diagnostics
      : diagnostics.map(({ data: _data, ...rest }) => rest),
    { elementIdFor: byRange },
  ).map((diagnostic) => {
    const check = (diagnostic.data as { check?: unknown } | undefined)?.check;
    return {
      ...diagnostic,
      ...(diagnostic.key === undefined && field && { key: field.key }),
      source: typeof check === 'string' ? definition.name : service.id,
    };
  });
};
