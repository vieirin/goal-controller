/**
 * What is wrong in a Notation view document or a property field, checked
 * against the model's context, with the definition's problems and severities.
 * The checks that exist without a language server: lines naming no element,
 * notations naming non-children or missing children, constructs contradicting
 * the links, the engine's own property checks (run by name), properties the
 * kind does not read or that do not apply. Nothing here knows an engine.
 */
import {
  evaluateCondition,
  fillTemplate,
  hasIds,
  propertyOf,
  relationMismatch,
  type AnyDialect,
  type DefinitionContext,
  type DefinitionContextElement,
  type Severity,
  type WithNotation,
} from '@goal-controller/dialect';
import { annotatedProperties, readLine, type ElementReading } from './lines.js';

/**
 * Where an element line cannot be read, in its parts: an annotation (before
 * the id), its declaration (from its `{`). Spans are in the line.
 */
const unreadableParts = (
  read: ElementReading,
  written: string,
  declares: boolean,
): Diagnostic[] => {
  const found = new Map<string, Diagnostic>();
  const brace = written.indexOf('{', read.textSpan.from);
  for (const { offset } of read.errors) {
    if (offset < read.textSpan.from) {
      // the annotation group around it: `<<...>>` or `{...}`
      const from = Math.max(
        written.lastIndexOf('{', offset),
        written.lastIndexOf('<<', offset),
        0,
      );
      const closes = [
        written.indexOf('}', offset),
        written.indexOf('>>', offset),
      ]
        .filter((at) => at >= 0)
        .map((at) => at + (written[at] === '}' ? 1 : 2));
      const to = Math.min(...closes, read.textSpan.from);
      found.set(`${from}`, {
        from,
        to,
        severity: 'error',
        message: 'This annotation cannot be read',
      });
    } else if (declares && brace >= 0 && offset >= brace) {
      found.set('declaration', {
        from: brace,
        to: written.trimEnd().length,
        severity: 'error',
        message: 'This declaration cannot be read',
      });
    }
  }
  return [...found.values()];
};

export type Diagnostic = {
  from: number;
  to: number;
  severity: Severity;
  message: string;
};

/** Runs the engine check a definition names on an element's properties. */
export type RunCheck = (
  check: string,
  properties: Readonly<Record<string, string>>,
  self: string,
) => string | null;

type Definition = Pick<
  AnyDialect,
  'elements' | 'notation' | 'properties' | 'propertyLineOrder' | 'problems'
>;

const problem = (
  definition: Definition,
  kind: keyof AnyDialect['problems'],
  from: number,
  to: number,
  message = definition.problems[kind].message,
): Diagnostic => ({
  from,
  to,
  severity: definition.problems[kind].severity,
  message,
});

/**
 * What the engine says of an element's properties, at a position: properties
 * that do not apply (set anyway), and the named checks' messages.
 */
const propertyDiagnostics = (
  definition: Definition,
  kind: string,
  self: string,
  properties: Readonly<Record<string, string>>,
  keys: Iterable<string>,
  at: (key: string) => { from: number; to: number },
  runCheck: RunCheck | undefined,
): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];
  for (const key of keys) {
    const property = propertyOf(definition, kind, key);
    if (!property || properties[key] === undefined) continue;
    const { from, to } = at(key);
    if (!evaluateCondition(property.applies, properties, true)) {
      diagnostics.push({
        from,
        to,
        severity: 'warning',
        message: property.notApplying
          ? fillTemplate(property.notApplying, properties)
          : 'Not read with these properties',
      });
      continue;
    }
    const message =
      property.check && runCheck?.(property.check, properties, self);
    if (message) diagnostics.push({ from, to, severity: 'error', message });
  }
  return diagnostics;
};

/** An element's properties with what its line declares (an undefined value unsets). */
const withDeclared = (
  stored: Readonly<Record<string, string>>,
  declared: Readonly<Record<string, string | undefined>>,
): Record<string, string> => {
  const merged: Record<string, string> = { ...stored };
  for (const [key, value] of Object.entries(declared))
    if (value === undefined) delete merged[key];
    else merged[key] = value;
  return merged;
};

export type DocumentDiagnosticsOptions = {
  runCheck?: RunCheck;
  /**
   * What the engine's grammar said of each saved element line (by id): shown
   * while the line still reads as saved
   */
  saved?: Readonly<Record<string, { line: string; error: string | null }>>;
};

/** The diagnostics of a whole Notation view document. */
export const documentDiagnostics = (
  definition: Definition,
  doc: string,
  context: DefinitionContext,
  { runCheck, saved = {} }: DocumentDiagnosticsOptions = {},
): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];
  const seen = new Set<string>();
  const lines = doc.split('\n');
  // lines that name no element are their elements' in order
  const order = hasIds(definition) ? null : (context.order ?? []);
  if (order) {
    const count = lines.filter((line) => line.trim()).length;
    if (count !== order.length)
      return [
        {
          from: 0,
          to: doc.length,
          severity: 'error',
          message: `${count} lines for ${order.length} elements: each line is an element's, in order (add or remove elements in the diagram)`,
        },
      ];
  }
  let index = 0;
  type Block = {
    id: string;
    element: DefinitionContextElement;
    lines: Map<string, { from: number; to: number }>;
    values: Map<string, string>;
  };
  let block: Block | null = null;
  let started = false;
  const closeBlock = () => {
    if (!block) return;
    const { id, element, lines, values } = block;
    // what the document sets: its property lines replace the stored ones
    const properties: Record<string, string> = {};
    for (const [key, value] of Object.entries(element.properties))
      if (!definition.propertyLineOrder.includes(key)) properties[key] = value;
    for (const [key, value] of values) properties[key] = value;
    diagnostics.push(
      ...propertyDiagnostics(
        definition,
        element.kind,
        id,
        properties,
        lines.keys(),
        (key) => lines.get(key)!,
        runCheck,
      ),
    );
    block = null;
  };

  let offset = 0;
  for (const written of lines) {
    const lineFrom = offset;
    offset += written.length + 1;
    const indent = written.length - written.trimStart().length;
    const read = readLine(definition, written);
    const at = (span: { from: number; to: number }) => ({
      from: lineFrom + span.from,
      to: lineFrom + span.to,
    });
    const id = order
      ? written.trim()
        ? order[index++]!
        : null
      : read.kind === 'element'
        ? read.id
        : null;
    if (id && read.kind === 'element') {
      closeBlock();
      started = true;
      const idSpan = read.idSpan ? at(read.idSpan) : at(read.textSpan);
      if (seen.has(id)) {
        diagnostics.push({
          ...idSpan,
          severity: 'error',
          message: `Duplicate id ${id}`,
        });
        continue;
      }
      seen.add(id);
      const element = context.elements[id];
      if (!element) {
        diagnostics.push(
          problem(definition, 'notInDiagram', idSpan.from, idSpan.to),
        );
        continue;
      }
      const owned = definition.elements[element.kind];
      for (const d of unreadableParts(read, written, !!owned?.declares))
        diagnostics.push({ ...d, ...at(d) });
      if (owned?.annotated) {
        const spans = new Map<string, { from: number; to: number }>();
        const kinds = new Set<string>();
        for (const { properties, span } of read.annotations) {
          const kind = 'stereotype' in properties ? 'stereotype' : 'tag';
          if (kinds.has(kind)) {
            diagnostics.push({
              ...at(span),
              severity: 'error',
              message:
                kind === 'stereotype'
                  ? 'An element has one stereotype: this one is not read'
                  : 'An element has one tagged value: this one is not read',
            });
            continue;
          }
          kinds.add(kind);
          for (const key of Object.keys(properties)) spans.set(key, at(span));
        }
        diagnostics.push(
          ...propertyDiagnostics(
            definition,
            element.kind,
            id,
            withDeclared(element.properties, annotatedProperties(read)),
            spans.keys(),
            (key) => spans.get(key)!,
            runCheck,
          ),
        );
      }
      if (owned?.declares) {
        if (read.declaration) {
          const span = at(read.declaration.span);
          diagnostics.push(
            ...propertyDiagnostics(
              definition,
              element.kind,
              id,
              withDeclared(element.properties, read.declaration.properties),
              Object.keys(read.declaration.properties),
              () => span,
              runCheck,
            ),
          );
        }
        continue;
      }
      if (!owned) continue;
      block = { id, element, lines: new Map(), values: new Map() };
      const was = saved[id];
      if (was?.error && was.line === read.text) {
        diagnostics.push({
          ...at(read.textSpan),
          severity: 'error',
          message: `Not valid for this engine: ${was.error}`,
        });
        continue;
      }
      if (!definition.notation || !read.notation) continue;
      const notated = definition as Definition & WithNotation;
      const notationSpan = at(read.notation.span);
      const listed: string[] = [];
      for (const ref of read.notation.refs) {
        listed.push(ref.id);
        if (!element.children.includes(ref.id)) {
          const span = at(ref.span);
          diagnostics.push(
            problem(definition, 'notAChild', span.from, span.to),
          );
        }
      }
      const mismatch = relationMismatch(
        notated,
        element.construct,
        element.relation,
      );
      if (mismatch)
        diagnostics.push(
          problem(
            definition,
            'relationMismatch',
            notationSpan.from,
            notationSpan.to,
            mismatch,
          ),
        );
      if (listed.length > 0)
        for (const child of element.children)
          if (!listed.includes(child))
            diagnostics.push(
              problem(
                definition,
                'missingFromNotation',
                notationSpan.from,
                notationSpan.to,
                `${definition.problems.missingFromNotation.message}: ${child}`,
              ),
            );
      continue;
    }
    if (!written.trim()) continue;
    const span = {
      from: lineFrom + indent,
      to: lineFrom + written.trimEnd().length,
    };
    if (!started) {
      diagnostics.push({
        ...span,
        severity: 'error',
        message: 'A property belongs under an element line',
      });
      continue;
    }
    if (!block) continue;
    if (read.kind !== 'property' || read.errors.length) {
      diagnostics.push({
        ...span,
        severity: 'error',
        message: 'Not a property line',
      });
      continue;
    }
    const keySpan = at(read.keySpan);
    if (!propertyOf(definition, block.element.kind, read.key)) {
      diagnostics.push({
        ...keySpan,
        severity: 'warning',
        message: `Not read for a ${block.element.kind}`,
      });
      continue;
    }
    block.lines.set(read.key, span);
    block.values.set(read.key, read.value);
  }
  closeBlock();
  return diagnostics;
};

/** The diagnostics of one property field (the whole value). */
export const fieldDiagnostics = (
  definition: Definition,
  context: DefinitionContext,
  self: string,
  key: string,
  value: string,
  runCheck: RunCheck | undefined,
): Diagnostic[] => {
  const element = context.elements[self];
  if (!element) return [];
  return propertyDiagnostics(
    definition,
    element.kind,
    self,
    { ...element.properties, [key]: value },
    [key],
    () => ({ from: 0, to: value.length }),
    runCheck,
  );
};
