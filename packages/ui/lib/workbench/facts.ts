/**
 * The relational core's demo in the workbench (goal-controller#61), behind a
 * flag (`?facts=1`, or `localStorage['goal-workbench:facts'] = '1'`): one pool
 * of the open project's facts (@goal-controller/facts), run in the page, its
 * services (go to definition, references, rename, hover) in the Notation view
 * and the resource tabs, its diagnostics in the Problems panel. Without the
 * flag, nothing here runs.
 */
import { useSyncExternalStore } from 'react';
import type { AnyDialect } from '@goal-controller/dialect';
import {
  FactPool,
  poolFor,
  type PoolDiagnostic,
  type PoolDocument,
  type PoolEdit,
  type PoolLocation,
  type RenameResult,
} from '@goal-controller/facts';
import type { GoalView, GoalViewNode } from '@goal-controller/goal-tree';
import { lineKeys } from './notationDocument';
import type { Problem } from './types';

/** The Problems panel's group of the pool's diagnostics. */
export const FACTS_SOURCE = 'facts';

const FLAG = 'goal-workbench:facts';

/** Whether the demo is on: `?facts=1`, or the stored flag (`?facts=0` turns it off). */
export const factsEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const asked = new URLSearchParams(window.location.search).get('facts');
    if (asked !== null)
      window.localStorage.setItem(FLAG, asked === '1' ? '1' : '0');
    return window.localStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
};

/** A model field's document: `model:<key>:<field>`. */
const MODEL_FIELD = /^model:(.*):([^:]*)$/;
export const modelField = (document: string) => {
  const match = MODEL_FIELD.exec(document);
  return match ? { key: match[1]!, field: match[2]! } : null;
};

/** Where a model field's text is in its element's text (id, name, notation). */
const elementSegments = (node: GoalViewNode) => {
  const segments: { field: string; from: number; text: string }[] = [];
  const id = node.text.indexOf(node.id);
  if (id >= 0) segments.push({ field: 'id', from: id, text: node.id });
  const afterId = id >= 0 ? id + node.id.length : 0;
  const name = node.text.indexOf(node.name, afterId);
  if (name >= 0) segments.push({ field: 'name', from: name, text: node.name });
  if (node.notation) {
    const notation = node.text.indexOf(
      node.notation,
      node.text.indexOf('[', afterId),
    );
    if (notation >= 0)
      segments.push({ field: 'notation', from: notation, text: node.notation });
  }
  return segments;
};

/** A span of the Notation view's text that is a model field's (`base` is the field's offset 0 there). */
export type FieldSpan = {
  document: string;
  base: number;
  from: number;
  to: number;
};

/**
 * The model fields the Notation view's text shows, where: an element line's
 * id, name and notation, and each property line's value.
 */
export const notationSpans = (
  definition: AnyDialect,
  tree: GoalView,
  text: string,
): FieldSpan[] => {
  const lines = text.split('\n');
  const keys = lineKeys(definition, lines, (key) => tree.nodes.has(key));
  const spans: FieldSpan[] = [];
  let offset = 0;
  let element: string | null = null;
  lines.forEach((line, i) => {
    const key = keys[i];
    const node = key ? tree.nodes.get(key) : undefined;
    if (key && node) {
      element = key;
      // the element line: its id, name and notation, in that order
      let cursor = 0;
      for (const segment of elementSegments(node)) {
        const start =
          segment.field === 'notation' ? line.indexOf('[', cursor) : cursor;
        const from = start < 0 ? -1 : line.indexOf(segment.text, start);
        if (from < 0) continue;
        cursor = from + segment.text.length;
        const base = offset + from;
        spans.push({
          document: `model:${key}:${segment.field}`,
          base,
          from: base,
          to: base + segment.text.length,
        });
      }
    } else if (element) {
      // a property line: `Key value`
      const match = /^(\s*)(\S+)(\s+)(.*)$/.exec(line);
      const value = match && tree.nodes.get(element)?.properties[match[2]!];
      if (match && value !== undefined && match[4] === value) {
        const base =
          offset + match[1]!.length + match[2]!.length + match[3]!.length;
        spans.push({
          document: `model:${element}:${match[2]}`,
          base,
          from: base,
          to: base + value.length,
        });
      }
    }
    offset += line.length + 1;
  });
  return spans;
};

/** Where in the view a location is (null: not shown there). */
export const spanOf = (spans: readonly FieldSpan[], at: PoolLocation) => {
  const span = spans.find((s) => s.document === at.document);
  return span ? { from: span.base + at.from, to: span.base + at.to } : null;
};

/** The pool's document and offset at a position of the view. */
export const fieldAt = (spans: readonly FieldSpan[], position: number) => {
  const span = spans.find((s) => s.from <= position && position <= s.to);
  return span
    ? { document: span.document, offset: position - span.base }
    : null;
};

/** What the workbench does for the session: where to go, and how to write a rename. */
export type FactsHost = {
  navigate(location: PoolLocation): void;
  apply(edits: readonly PoolEdit[]): void;
};

/** A request to show a range in a tab (the Notation view, a resource's). */
export type Reveal = { tab: string; from: number; to: number; seq: number };

/** The open project's pool, its diagnostics, and what was asked to be shown. */
class FactsSession {
  pool: FactPool | null = null;
  definition: AnyDialect | null = null;
  tree: GoalView | null = null;
  diagnostics: readonly PoolDiagnostic[] = [];
  problems: readonly Problem[] = [];
  reveal: Reveal | null = null;
  host: FactsHost | null = null;
  version = 0;
  private readonly listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private changed() {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }

  /** The project now: its model's view and its resources' texts. */
  update(
    definition: AnyDialect | null,
    tree: GoalView | null,
    resources: readonly { kind: string; path: string; text: string }[],
  ) {
    if (definition !== this.definition) {
      const setup = definition && poolFor(definition);
      this.pool = setup ? new FactPool(setup) : null;
      this.definition = definition;
    }
    this.tree = tree;
    if (!this.pool) {
      this.diagnostics = [];
      this.problems = [];
      this.changed();
      return;
    }
    const documents: PoolDocument[] = [
      ...(tree ? [{ id: 'model', kind: 'model', value: tree }] : []),
      ...resources.map(({ kind, path, text }) => ({ id: path, kind, text })),
    ];
    this.pool.update(documents);
    this.diagnostics = this.pool
      .diagnostics()
      .filter((d) => !this.reportedElsewhere(d));
    this.problems = this.diagnostics.map((d) => this.problemOf(d));
    this.changed();
  }

  /**
   * What the goal language already reports of the model (#61 R6): an unknown
   * world class or variable in a property, an id not among a goal's
   * children. The pool's own diagnostics are its source's (`facts`).
   */
  private reportedElsewhere(diagnostic: PoolDiagnostic): boolean {
    if (
      diagnostic.code !== 'unresolved' ||
      !modelField(diagnostic.location.document)
    )
      return false;
    const pool = this.pool!;
    const id = pool.idAt(
      diagnostic.location.document,
      diagnostic.location.from,
    );
    const kinds = id
      ? pool.db.query('refers', [id]).map((t) => String(t[1]))
      : [];
    return kinds.some((kind) =>
      ['world.class', 'gm.child', 'edge.variable'].includes(kind),
    );
  }

  private problemOf(diagnostic: PoolDiagnostic): Problem {
    const { location, severity, message } = diagnostic;
    const field = modelField(location.document);
    if (field) {
      const known = ['id', 'name', 'notation'].includes(field.field);
      return {
        elementId: field.key,
        ...(!known && { key: field.field }),
        severity,
        message,
        source: FACTS_SOURCE,
      };
    }
    const text = this.pool!.textOf(location.document) ?? '';
    const before = text.slice(0, location.from);
    const line = before.split('\n').length;
    const column = location.from - before.lastIndexOf('\n');
    return {
      severity,
      message: `${location.document.split('/').pop()}:${line}:${column}: ${message}`,
      source: FACTS_SOURCE,
      line,
      column,
    };
  }

  /** Show a range in a tab (its editor selects it). */
  show(tab: string, from: number, to: number) {
    this.reveal = { tab, from, to, seq: (this.reveal?.seq ?? 0) + 1 };
    this.changed();
  }

  navigate(location: PoolLocation) {
    this.host?.navigate(location);
  }

  rename(document: string, offset: number, newName: string): RenameResult {
    const result = this.pool?.renameAt(document, offset, newName) ?? {
      refused: 'No pool',
    };
    if ('edits' in result) this.host?.apply(result.edits);
    return result;
  }
}

export const factsSession = new FactsSession();

/** Re-renders on every change of the session (its pool, diagnostics, reveal). */
export const useFactsSession = (): FactsSession => {
  useSyncExternalStore(
    factsSession.subscribe,
    () => factsSession.version,
    () => 0,
  );
  return factsSession;
};

/** Edits applied to a text (any order). */
export const applyEdits = (
  text: string,
  edits: readonly { from: number; to: number; text: string }[],
) =>
  [...edits]
    .sort((a, b) => b.from - a.from)
    .reduce(
      (out, edit) => out.slice(0, edit.from) + edit.text + out.slice(edit.to),
      text,
    );

/**
 * A rename's edits of the model's fields, as each element's new text (its
 * id, name or notation edited in place) and properties.
 */
export const modelChanges = (tree: GoalView, edits: readonly PoolEdit[]) => {
  const byElement = new Map<string, Map<string, PoolEdit[]>>();
  for (const edit of edits) {
    const field = modelField(edit.document);
    if (!field) continue;
    const fields = byElement.get(field.key) ?? new Map<string, PoolEdit[]>();
    fields.set(field.field, [...(fields.get(field.field) ?? []), edit]);
    byElement.set(field.key, fields);
  }
  return [...byElement].flatMap(([key, fields]) => {
    const node = tree.nodes.get(key);
    if (!node) return [];
    const segments = elementSegments(node).filter((s) => fields.has(s.field));
    const text = segments.length
      ? segments
          .sort((a, b) => b.from - a.from)
          .reduce(
            (out, s) =>
              out.slice(0, s.from) +
              applyEdits(s.text, fields.get(s.field)!) +
              out.slice(s.from + s.text.length),
            node.text,
          )
      : null;
    const properties = [...fields]
      .filter(([field]) => !['id', 'name', 'notation'].includes(field))
      .map(
        ([field, list]) =>
          [field, applyEdits(node.properties[field] ?? '', list)] as const,
      );
    return [{ iStarId: node.iStarId, text, properties }];
  });
};
