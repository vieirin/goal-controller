/**
 * The rule layer's diagnostics in the workbench (goal-controller#75): the
 * open project (its model's view, its resources' texts) is checked in the
 * rules worker, debounced, off the typing path; a newer edit's answer
 * replaces an older one's, and an older answer arriving late is dropped. The
 * diagnostics are kept here for the views: Problems (source `rules`), the
 * resource tabs and the Notation view underline theirs.
 */
import { useSyncExternalStore } from 'react';
import type { AnyDialect } from '@goal-controller/dialect';
import type { GoalView } from '@goal-controller/goal-tree';
import {
  modelFieldOf,
  type RuleDiagnostic,
  type RuleLocation,
  type RuleProject,
} from '@goal-controller/lib';
import type { DialectEngine } from './engineDialects';
import { lineKeys } from './notationDocument';
import type { RulesAnswer, RulesRequest } from './rulesWorker';
import type { Problem } from './types';

/** The Problems panel's group of the rules' diagnostics. */
export const RULES_SOURCE = 'rules';

/** How long an edit waits for the next before the rules run (ms). */
const DEBOUNCE_MS = 300;

/**
 * What the workbench already reports of the model: an unknown world class
 * (MutRoSe's checks), an id no child of its goal (the goal language), an
 * unknown or undeclared variable (the goal language, MutRoSe's scope
 * checks). The rules' `unresolved` of those, in the model, is dropped.
 */
const REPORTED_ELSEWHERE = new Set([
  'world.class',
  'gm.child',
  'edge.variable',
  'gm.variable',
]);

type State = {
  diagnostics: readonly RuleDiagnostic[];
  /** the texts the diagnostics were found in, by document */
  texts: Readonly<Record<string, string>>;
  /** the last run's time in the worker (ms) */
  ms: number | null;
  error: string | null;
};

let state: State = { diagnostics: [], texts: {}, ms: null, error: null };
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  listeners.forEach((listener) => listener());
};

/** Calls a listener whenever the diagnostics change; returns how to stop. */
export const subscribeRuleDiagnostics = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The rules' diagnostics now (outside React: an editor's linter). */
export const ruleDiagnostics = (): State => state;

/** The rules' diagnostics now, re-rendering when they change. */
export const useRuleDiagnostics = (): State =>
  useSyncExternalStore(
    subscribeRuleDiagnostics,
    ruleDiagnostics,
    ruleDiagnostics,
  );

let worker: Worker | null | undefined;
const rulesWorker = (): Worker | null => {
  // no worker where the page is prerendered
  if (typeof Worker === 'undefined') return null;
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./rulesWorker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = ({ data }: MessageEvent<RulesAnswer>) => {
      // an older edit's answer, arriving after a newer one was asked: dropped
      if (data.seq !== latest) return;
      if ('error' in data) set({ ...state, error: data.error });
      else
        set({
          diagnostics: data.diagnostics,
          texts: pendingTexts,
          ms: data.ms,
          error: null,
        });
    };
  } catch {
    worker = null;
  }
  return worker;
};

let latest = 0;
let pendingTexts: Record<string, string> = {};
let timer: ReturnType<typeof setTimeout> | null = null;

/** The texts a project's diagnostics can be located in: its resources', its model fields'. */
const textsOf = (project: RuleProject): Record<string, string> => {
  const texts: Record<string, string> = {};
  for (const { path, text } of project.resources) texts[path] = text;
  for (const node of project.model?.nodes.values() ?? []) {
    texts[`model:${node.key}:id`] = node.id;
    texts[`model:${node.key}:name`] = node.name;
    if (node.notation) texts[`model:${node.key}:notation`] = node.notation;
    for (const [key, value] of Object.entries(node.properties))
      texts[`model:${node.key}:${key}`] = value;
  }
  return texts;
};

/**
 * Checks the project after a pause in its edits (none for an engine without
 * rules, or without a model): every call replaces the one before it.
 */
export const checkRulesSoon = (
  engine: DialectEngine | null,
  project: RuleProject | null,
): void => {
  if (timer) clearTimeout(timer);
  latest += 1;
  const seq = latest;
  if (!engine || !project?.model) {
    set({ diagnostics: [], texts: {}, ms: null, error: null });
    return;
  }
  timer = setTimeout(() => {
    timer = null;
    const target = rulesWorker();
    if (!target) return;
    pendingTexts = textsOf(project);
    target.postMessage({ seq, engine, project } satisfies RulesRequest);
  }, DEBOUNCE_MS);
};

/** Whether the workbench reports a diagnostic already (see REPORTED_ELSEWHERE). */
const reportedElsewhere = (
  diagnostic: RuleDiagnostic,
  kinds: readonly string[],
) =>
  diagnostic.check === 'unresolved' &&
  modelFieldOf(diagnostic.location.document) !== null &&
  kinds.some((kind) => REPORTED_ELSEWHERE.has(kind));

/** The rules' diagnostics the views show (the workbench's own dropped). */
export const shownDiagnostics = (
  diagnostics: readonly RuleDiagnostic[],
): RuleDiagnostic[] =>
  diagnostics.filter((d) => !reportedElsewhere(d, d.kinds ?? []));

/** A diagnostic as a problem: an element's (and property's), or a file's line. */
export const ruleProblem = (
  diagnostic: RuleDiagnostic,
  texts: Readonly<Record<string, string>>,
): Problem => {
  const { location, severity, message } = diagnostic;
  const field = modelFieldOf(location.document);
  if (field)
    return {
      elementId: field.key,
      ...(!['id', 'name', 'notation'].includes(field.field) && {
        key: field.field,
      }),
      severity,
      message,
      source: RULES_SOURCE,
    };
  const before = (texts[location.document] ?? '').slice(0, location.from);
  const line = before.split('\n').length;
  const column = location.from - before.lastIndexOf('\n');
  return {
    severity,
    message: `${location.document.split('/').pop()}:${line}:${column}: ${message}`,
    source: RULES_SOURCE,
    line,
    column,
  };
};

/** Where a model field's text is in the Notation view's text, by field document. */
export const notationSpans = (
  definition: AnyDialect,
  tree: GoalView,
  text: string,
): Map<string, number> => {
  const lines = text.split('\n');
  const keys = lineKeys(definition, lines, (key) => tree.nodes.has(key));
  const spans = new Map<string, number>();
  let offset = 0;
  let element: string | null = null;
  lines.forEach((line, i) => {
    const key = keys[i];
    const node = key ? tree.nodes.get(key) : undefined;
    if (key && node) {
      element = key;
      // the element line: its id, name and notation, in that order
      let cursor = 0;
      for (const [field, value] of [
        ['id', node.id],
        ['name', node.name],
        ['notation', node.notation],
      ] as const) {
        if (!value) continue;
        const start = field === 'notation' ? line.indexOf('[', cursor) : cursor;
        const from = start < 0 ? -1 : line.indexOf(value, start);
        if (from < 0) continue;
        cursor = from + value.length;
        spans.set(`model:${key}:${field}`, offset + from);
      }
    } else if (element) {
      // a property line: `Key value`
      const match = /^(\s*)(\S+)(\s+)(.*)$/.exec(line);
      const value = match && tree.nodes.get(element)?.properties[match[2]!];
      if (match && value !== undefined && match[4] === value)
        spans.set(
          `model:${element}:${match[2]}`,
          offset + match[1]!.length + match[2]!.length + match[3]!.length,
        );
    }
    offset += line.length + 1;
  });
  return spans;
};

/** A location in the Notation view's text (null: not shown there). */
export const inNotation = (
  spans: ReadonlyMap<string, number>,
  location: RuleLocation,
): { from: number; to: number } | null => {
  const base = spans.get(location.document);
  return base === undefined
    ? null
    : { from: base + location.from, to: base + location.to };
};
