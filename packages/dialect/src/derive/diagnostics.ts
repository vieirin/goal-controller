/**
 * What is wrong in a Notation view document or a property field, checked
 * against the model's context, with the definition's problems and severities.
 * The checks that exist without a language server: lines naming no element,
 * notations naming non-children or missing children, constructs contradicting
 * the links, the engine's own property checks (run by name), properties the
 * kind does not read or that do not apply. Nothing here knows an engine.
 */
import {
  hasIds,
  type AnyDialect,
  type DefinitionContext,
  type DefinitionContextElement,
  type Severity,
  type WithNotation,
} from '../schema';
import {
  annotationsOf,
  lineId,
  declarationOf,
  readDeclaration,
  readElementLine,
  readAnnotations,
  readPropertyLine,
  splitAnnotations,
} from './lines';
import { relationMismatch, operandPattern } from './operators';
import { evaluateCondition, fillTemplate, propertyOf } from './properties';

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
  | 'elements'
  | 'notation'
  | 'properties'
  | 'propertyLine'
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
    const id = order
      ? written.trim()
        ? order[index++]!
        : null
      : lineId(definition, written);
    if (id) {
      closeBlock();
      started = true;
      // the line after its annotations, from restFrom on in the document
      const {
        groups,
        rest: text,
        offset: restOffset,
      } = splitAnnotations(definition, written);
      const restFrom = lineFrom + restOffset;
      const idFrom = restFrom + text.indexOf(id);
      const idTo = idFrom + id.length;
      if (seen.has(id)) {
        diagnostics.push({
          from: idFrom,
          to: idTo,
          severity: 'error',
          message: `Duplicate id ${id}`,
        });
        continue;
      }
      seen.add(id);
      const element = context.elements[id];
      if (!element) {
        diagnostics.push(problem(definition, 'notInDiagram', idFrom, idTo));
        continue;
      }
      const annotated = readAnnotations(
        annotationsOf(definition, element.kind),
        groups.map((group) => group.text),
      );
      const spans = new Map<string, { from: number; to: number }>();
      annotated.read.forEach((read, index) => {
        const { text: group, from } = groups[index]!;
        const span = {
          from: lineFrom + from,
          to: lineFrom + from + group.length,
        };
        if (!read)
          diagnostics.push({
            ...span,
            severity: 'error',
            message: 'This annotation cannot be read',
          });
        else for (const key of Object.keys(read)) spans.set(key, span);
      });
      diagnostics.push(
        ...propertyDiagnostics(
          definition,
          element.kind,
          id,
          withDeclared(element.properties, annotated.properties),
          [...spans.keys()].filter(
            (key) => annotated.properties[key] !== undefined,
          ),
          (key) => spans.get(key)!,
          runCheck,
        ),
      );
      const declaration = declarationOf(definition, element.kind);
      if (declaration) {
        const { declared, properties } = readDeclaration(declaration, text);
        const [declOpen] = declaration.delimiters;
        const from = restFrom + text.lastIndexOf(declOpen);
        const span = { from, to: restFrom + text.trimEnd().length };
        if (declared && !properties) {
          diagnostics.push({
            ...span,
            severity: 'error',
            message: 'This declaration cannot be read',
          });
        } else if (properties) {
          diagnostics.push(
            ...propertyDiagnostics(
              definition,
              element.kind,
              id,
              withDeclared(element.properties, properties),
              Object.keys(properties),
              () => span,
              runCheck,
            ),
          );
        }
        continue;
      }
      if (!definition.elements[element.kind]) continue;
      block = { id, element, lines: new Map(), values: new Map() };
      const was = saved[id];
      if (was?.error && was.line === text.trim()) {
        diagnostics.push({
          from: restFrom + text.length - text.trimStart().length,
          to: restFrom + text.trimEnd().length,
          severity: 'error',
          message: `Not valid for this engine: ${was.error}`,
        });
        continue;
      }
      if (!definition.notation || !readElementLine(definition, text)?.notation)
        continue;
      const notated = definition as Definition & WithNotation;
      const operand = new RegExp(operandPattern(notated), 'g');
      const [open, close] = notated.notation.delimiters;
      const openAt = text.indexOf(open);
      const notationFrom = restFrom + openAt + open.length;
      const notationTo = restFrom + text.lastIndexOf(close);
      const listed: string[] = [];
      const inner = text.slice(openAt + open.length, notationTo - restFrom);
      for (const match of inner.matchAll(operand)) {
        listed.push(match[0]);
        if (!element.children.includes(match[0])) {
          const from = notationFrom + match.index!;
          diagnostics.push(
            problem(definition, 'notAChild', from, from + match[0].length),
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
            notationFrom,
            notationTo,
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
                notationFrom,
                notationTo,
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
    const property = readPropertyLine(definition, written);
    if (!started) {
      diagnostics.push({
        ...span,
        severity: 'error',
        message: 'A property belongs under an element line',
      });
      continue;
    }
    if (!block) continue;
    if (!property) {
      diagnostics.push({
        ...span,
        severity: 'error',
        message: 'Not a property line',
      });
      continue;
    }
    const keyTo = span.from + property.key.length;
    if (!propertyOf(definition, block.element.kind, property.key)) {
      diagnostics.push({
        from: span.from,
        to: keyTo,
        severity: 'warning',
        message: `Not read for a ${block.element.kind}`,
      });
      continue;
    }
    block.lines.set(property.key, span);
    block.values.set(property.key, property.value);
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
