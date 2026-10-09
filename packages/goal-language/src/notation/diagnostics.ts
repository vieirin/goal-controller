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
  valueOf,
  type AnyDialect,
  type DefinitionContext,
  type DefinitionContextElement,
  type Severity,
  type WithNotation,
} from '@goal-controller/dialect';
import { annotatedProperties, readLine, type ElementReading } from './lines.js';
import { isEnabled } from './reading.js';
import { valueProblem } from './values.js';

/**
 * Where an element line cannot be read, in its parts: an annotation (before
 * the id), its declaration (from its `{`). Spans are in the line.
 */
const unreadableParts = (
  read: ElementReading,
  written: string,
  declares: boolean,
  /** whether to report what the element's text cannot read (not while the engine's error shows) */
  text: boolean,
): Diagnostic[] => {
  const found = new Map<string, Diagnostic>();
  const brace = written.indexOf('{', read.textSpan.from);
  for (const error of read.errors) {
    const { offset } = error;
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
    } else if (text && !found.has('text')) {
      // the first thing the line cannot read (what follows depends on it)
      const at = Math.min(offset, Math.max(read.textSpan.to - 1, 0));
      const image = written.slice(offset, offset + error.length).trim();
      found.set('text', {
        from: at,
        to: Math.max(at + 1, Math.min(offset + error.length, written.length)),
        severity: 'error',
        message: error.message.startsWith('token recognition error')
          ? `Not part of the goal language: ${error.message.slice(error.message.indexOf("'"))}`
          : image
            ? `Unexpected ${image}`
            : 'The line ends before it is complete',
      });
    }
  }
  return [...found.values()];
};

/** What a notation writes that its dialect does not enable: operators, `skip`. */
const disabled = (
  definition: Pick<AnyDialect, 'name'> & WithNotation,
  notation: NonNullable<ElementReading['notation']>,
): Diagnostic[] => {
  const { operand } = definition.notation;
  return [
    // the same rule readNotation reads a notation's constructs with
    ...notation.operators.flatMap(({ symbol, form, span }) =>
      isEnabled(definition, symbol, form)
        ? []
        : [
            {
              ...span,
              severity: 'error' as const,
              message:
                form === 'standalone'
                  ? `A standalone \`${symbol}\` is not a construct of ${definition.name}`
                  : `\`${symbol}\` is not an operator of ${definition.name}`,
            },
          ],
    ),
    ...(operand.skip
      ? []
      : notation.skips.map((span) => ({
          ...span,
          severity: 'error' as const,
          message: `\`skip\` is not an operand of ${definition.name}`,
        }))),
  ];
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
  | 'name'
  | 'elements'
  | 'notation'
  | 'properties'
  | 'propertyLineOrder'
  | 'problems'
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
 * What is wrong with an element's properties, at a position: properties that
 * do not apply (set anyway), the named engine checks' messages, and values
 * not of their property's type (or options, bounds, kind of element).
 */
const propertyDiagnostics = (
  definition: Definition,
  kind: string,
  self: string,
  properties: Readonly<Record<string, string>>,
  keys: Iterable<string>,
  at: (key: string) => { from: number; to: number },
  runCheck: RunCheck | undefined,
  context: DefinitionContext | undefined,
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
    // the engine's own message first: it says more than the type does
    const message =
      (property.check && runCheck?.(property.check, properties, self)) ||
      valueProblem(valueOf(property, properties), properties[key]!, context);
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
        context,
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
    // a line without ids' definition: an id written names its element, else
    // the line is its element's by position (every line counts)
    const written_id = read.kind === 'element' ? read.id : null;
    const position = order && written.trim() ? order[index++]! : null;
    const id = order
      ? written_id
        ? (context.named?.[written_id] ?? `unknown ${written_id}`)
        : position
      : written_id;
    if (id && read.kind === 'element') {
      closeBlock();
      started = true;
      const idSpan = read.idSpan ? at(read.idSpan) : at(read.textSpan);
      if (seen.has(id)) {
        diagnostics.push({
          ...idSpan,
          severity: 'error',
          message: `Duplicate id ${written_id ?? id}`,
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
      const was = saved[id];
      const savedError = !!was?.error && was.line === read.text;
      for (const d of unreadableParts(
        read,
        written,
        !!owned?.declares,
        !savedError,
      ))
        diagnostics.push({ ...d, ...at(d) });
      if (owned && !owned.annotated)
        for (const { span } of read.annotations)
          diagnostics.push({
            ...at(span),
            severity: 'error',
            message: `A ${element.kind} carries no annotations in ${definition.name}`,
          });
      if (owned && !owned.declares && read.declaration)
        diagnostics.push({
          ...at(read.declaration.span),
          severity: 'error',
          message: `A ${element.kind} declares nothing on its line in ${definition.name}`,
        });
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
            context,
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
              context,
            ),
          );
        }
        continue;
      }
      if (!owned) continue;
      block = { id, element, lines: new Map(), values: new Map() };
      if (savedError) {
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
      diagnostics.push(
        ...disabled(notated, read.notation).map((d) => ({ ...d, ...at(d) })),
      );
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
    context,
  );
};
