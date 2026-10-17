/**
 * What is wrong in a Notation view document or a property field, checked
 * against the model's context, with the definition's problems and severities.
 * The checks that exist without a language server: lines naming no element,
 * notations naming non-children or missing children, constructs contradicting
 * the links, the engine's own property checks (run by name), properties the
 * kind does not read or that do not apply. Nothing here knows an engine.
 */
import {
  actorPropertiesOf,
  evaluateCondition,
  fillTemplate,
  hasIds,
  linkLinesOf,
  linkPropertiesOf,
  propertyOf,
  relationMismatch,
  valueOf,
  type AnyDialect,
  type DefinitionContext,
  type DefinitionContextElement,
  type Severity,
  type WithNotation,
  type PropertyDefinition,
  type ValueConfig,
} from '@goal-controller/dialect';
import { annotatedProperties, readLine, type ElementReading } from './lines.js';
import { ACTOR_LINE_KEY, actorNames, readActorLine } from './actorLine.js';
import { arityText, CALLS, takesOperands, type CallName } from '../catalog.js';
import { isEnabled } from './reading.js';
import { kindOfId, lineScope, scopedKey } from './scope.js';
import {
  fieldPropertyOf,
  unknownNameMessage,
  unknownNames,
  valueProblem,
} from './values.js';
import {
  LINK_LINE_KEY,
  linkOfLine,
  takesPosition,
  targetKey,
  writtenTarget,
  readLinkLine,
  writtenPropertyProblems,
  type LinkLineReading,
} from './linkLine.js';

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

/**
 * What a notation writes that its dialect does not enable (operators, `skip`),
 * and calls with another number of operands than they take.
 */
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
    // a call with as many operands as the language's catalog gives it
    ...notation.operators.flatMap(({ symbol, form, span, operands }) => {
      const arity = form === 'call' ? CALLS[symbol as CallName]?.arity : null;
      return arity && operands !== undefined && !takesOperands(arity, operands)
        ? [
            {
              ...span,
              severity: 'error' as const,
              message: `\`${symbol}\` takes ${arityText(arity)}, not ${operands}`,
            },
          ]
        : [];
    }),
  ];
};

export type Diagnostic = {
  from: number;
  to: number;
  severity: Severity;
  message: string;
  /** the element whose line it is on (the model's), if any */
  elementId?: string;
  /** the property it is about, if any */
  key?: string;
  /** the named check that said it (an engine's), if one did */
  check?: string;
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
  | 'idScope'
> &
  Partial<Pick<AnyDialect, 'links' | 'linkLines' | 'actors' | 'framework'>>;

/**
 * Why a framework's line (KAOS, NFR: goal-controller#171) names no element
 * of its kinds: its id's prefix (`T1`, read as iStar's catalog reads it) is
 * none of theirs. Null: one of its kinds takes it, or an iStar dialect's
 * line (its other prefixes are the diagram's to say, `notInDiagram`).
 */
const foreignPrefix = (definition: Definition, id: string): string | null => {
  if ((definition.framework ?? 'istar-2.0') === 'istar-2.0') return null;
  if (kindOfId(definition, id) !== undefined) return null;
  const prefixes = [
    ...new Set(
      Object.values(definition.elements).flatMap((e) =>
        e?.prefix ? [e.prefix] : [],
      ),
    ),
  ];
  const prefix = /^[A-Z]+/.exec(id)?.[0] ?? id;
  return `${prefix} is no prefix of ${definition.name}'s: its elements are ${prefixes.map((p) => `${p}…`).join(', ')}`;
};

/**
 * What an element line's bracket holds against what its dialect reads there:
 * a cost (`[W = 0.1]`) only on a leaf of a dialect whose leaves have costs,
 * and on such a leaf, nothing else.
 */
const bracketProblem = (
  definition: Definition,
  read: ElementReading,
  leaf: boolean,
): Diagnostic | null => {
  const costs = definition.notation?.leafBracket === 'cost';
  const error = (span: { from: number; to: number }, message: string) => ({
    ...span,
    severity: 'error' as const,
    message,
  });
  if (read.cost && !costs)
    return error(read.cost.span, `A cost is not part of ${definition.name}`);
  if (read.cost && !leaf)
    return error(
      read.cost.span,
      "Only a leaf's bracket holds a cost: a refined element's holds its notation",
    );
  if (costs && leaf && read.notation)
    return error(
      read.notation.span,
      "A leaf's bracket holds its cost: W = 0.1, W = 0.1x or W = x",
    );
  return null;
};

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
 * do not apply (set anyway), the named engine checks' messages, values
 * not of their property's type (or options, bounds, kind of element), and
 * the names a condition compares that the model does not know.
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
    // anchored on the element and the property
    const where = { ...at(key), elementId: self, key };
    if (!evaluateCondition(property.applies, properties, true)) {
      diagnostics.push({
        ...where,
        severity: 'warning',
        message: property.notApplying
          ? fillTemplate(property.notApplying, properties)
          : 'Not read with these properties',
      });
      continue;
    }
    // an engine-owned server serves the value: nothing said of it here
    if (property.servedBy === 'engine') continue;
    // the engine's own message first: it says more than the type does
    const value = valueOf(property, properties);
    const checked =
      property.check && runCheck?.(property.check, properties, self);
    if (checked) {
      diagnostics.push({
        ...where,
        severity: 'error',
        message: checked,
        check: property.check,
      });
      continue;
    }
    const message = valueProblem(value, properties[key]!, context, definition);
    if (message) diagnostics.push({ ...where, severity: 'error', message });
    else if (context)
      for (const unknown of unknownNameProblems(
        value,
        properties[key]!,
        context,
      ))
        diagnostics.push({ ...where, ...unknown });
  }
  return diagnostics;
};

/**
 * The names a condition compares that the model doesn't know: `info` where
 * it resolves variables (one the model doesn't use yet), else an `error`,
 * as no name but an element's can be right (goal-controller#152).
 */
const unknownNameProblems = (
  value: ValueConfig,
  text: string,
  context: DefinitionContext,
): { severity: 'info' | 'error'; message: string }[] =>
  value.type === 'assertion'
    ? unknownNames(value, text, context).map((name) => ({
        severity: value.resolves.includes('variable') ? 'info' : 'error',
        message: unknownNameMessage(value, name),
      }))
    : [];

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

/** The actors' ids by their names, in the model's order: what an actor line names one by. */
const actorNamesOf = (context: DefinitionContext) =>
  actorNames(
    Object.entries(context.actors ?? {}).map(([iStarId, { name }]) => ({
      iStarId,
      name,
    })),
  );

/**
 * A line's `{key = value}` properties (a link's, an actor's) against what
 * its kind declares: each key's and value's problems, and the engine's named
 * check on a property, its message first, as an element's. `self` is the
 * link's or actor's piStar id (its context's readLink or readActor reads it).
 */
const writtenPropertyDiagnostics = (
  declared: readonly PropertyDefinition[],
  kind: string,
  read: LinkLineReading,
  self: string,
  runCheck: RunCheck | undefined,
  at: (span: { from: number; to: number }) => { from: number; to: number },
  context: DefinitionContext,
  definition: Pick<AnyDialect, 'properties'>,
): Diagnostic[] => {
  const found: Diagnostic[] = [];
  const problems = writtenPropertyProblems(
    declared,
    kind,
    read,
    context,
    definition,
  );
  const written = Object.fromEntries(
    read.properties.map(({ key, value }) => [key, value]),
  );
  for (const [index, property] of read.properties.entries()) {
    const check = declared.find(({ key }) => key === property.key)?.check;
    const own = problems.filter((p) => p.index === index);
    const checked =
      check &&
      !own.some((p) => p.on === 'key') &&
      runCheck?.(check, written, self);
    if (checked) {
      found.push({
        ...at(property.valueSpan),
        severity: 'error',
        message: checked,
        check,
      });
      continue;
    }
    for (const problem of own)
      found.push({
        ...at(problem.on === 'key' ? property.keySpan : property.valueSpan),
        severity: 'error',
        message: problem.message,
      });
    const config = declared.find(({ key }) => key === property.key);
    if (!own.length && config && config.servedBy !== 'engine')
      for (const unknown of unknownNameProblems(
        valueOf(config, written),
        property.value,
        context,
      ))
        found.push({ ...at(property.valueSpan), ...unknown });
  }
  return found;
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
  // the actors the actor lines have named (goal-controller#109)
  const actorsWritten = new Set<string>();
  const lines = doc.split('\n');
  // lines that name no element are their elements' in order (link lines take
  // no position)
  const order = hasIds(definition) ? null : (context.order ?? []);
  if (order) {
    const count = lines.filter((line) =>
      takesPosition(definition, line),
    ).length;
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
    /** the targets its `link` lines name, and how many times */
    linkTargets: Map<string, number>;
  };
  let block: Block | null = null;
  // the indentation of the open block's element line
  let blockIndent = -1;
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

  // each line's diagnostics anchored on the element the line is (or is under)
  let owner: string | undefined;
  const push = (...found: Diagnostic[]) =>
    diagnostics.push(
      ...found.map((d) =>
        owner && d.elementId === undefined ? { ...d, elementId: owner } : d,
      ),
    );
  // the goal lines above, by indentation: an id scoped by its nearest goal
  const scope = lineScope(definition);
  /** an element's id as written, by its key (a repeated scoped id's is `G3/T1.1`) */
  const idOf = (key: string) => context.elements[key]?.id ?? key;
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
    // the line is its element's by position (every line but a link line counts)
    const written_id = read.kind === 'element' ? read.id : null;
    const position =
      order && takesPosition(definition, written) ? order[index++]! : null;
    const named = order
      ? written_id
        ? (context.named?.[written_id] ?? `unknown ${written_id}`)
        : position
      : written_id;
    // the goal an element line is under, and the key its id names there
    const goal =
      named && !order && read.kind === 'element'
        ? scope.enter(indent, named)
        : null;
    const id =
      named && scope.keyOf(goal, named, (key) => key in context.elements);
    const current = (block as Block | null)?.id;
    const ownerId = read.kind === 'element' && id ? id : current;
    owner = ownerId && context.elements[ownerId] ? ownerId : undefined;
    if (id && read.kind === 'element') {
      closeBlock();
      started = true;
      const idSpan = read.idSpan ? at(read.idSpan) : at(read.textSpan);
      // a goal is unique in the model; under `ancestorGoal`, another element under its goal
      const unique = goal !== null ? scopedKey(goal, named!) : id;
      if (seen.has(unique)) {
        push({
          ...idSpan,
          severity: 'error',
          message:
            goal !== null
              ? `Duplicate id ${written_id ?? named} under ${goal}`
              : `Duplicate id ${written_id ?? id}`,
        });
        continue;
      }
      seen.add(unique);
      const element = context.elements[id];
      const foreign =
        !element && written_id && foreignPrefix(definition, written_id);
      if (foreign) {
        push({ ...idSpan, severity: 'error', message: foreign });
        continue;
      }
      if (!element) {
        push(problem(definition, 'notInDiagram', idSpan.from, idSpan.to));
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
        push({ ...d, ...at(d) });
      if (owned && !owned.annotated)
        for (const { span } of read.annotations)
          push({
            ...at(span),
            severity: 'error',
            message: `A ${element.kind} carries no annotations in ${definition.name}`,
          });
      if (owned && !owned.declares && read.declaration)
        push({
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
            push({
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
        push(
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
          push(
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
      block = {
        id,
        element,
        lines: new Map(),
        values: new Map(),
        linkTargets: new Map(),
      };
      blockIndent = indent;
      if (savedError) {
        push({
          ...at(read.textSpan),
          severity: 'error',
          message: `Not valid for this engine: ${was.error}`,
        });
        continue;
      }
      const bracket = bracketProblem(
        definition,
        read,
        element.children.length === 0,
      );
      if (bracket) push({ ...bracket, ...at(bracket) });
      if (!definition.notation || !read.notation || bracket) continue;
      const notated = definition as Definition & WithNotation;
      const notationSpan = at(read.notation.span);
      push(
        ...disabled(notated, read.notation).map((d) => ({ ...d, ...at(d) })),
      );
      const listed: string[] = [];
      for (const ref of read.notation.refs) {
        listed.push(ref.id);
        if (!element.children.some((child) => idOf(child) === ref.id)) {
          const span = at(ref.span);
          push(problem(definition, 'notAChild', span.from, span.to));
        }
      }
      const mismatch = relationMismatch(
        notated,
        element.construct,
        element.relation,
      );
      if (mismatch)
        push(
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
          if (!listed.includes(idOf(child)))
            push(
              problem(
                definition,
                'missingFromNotation',
                notationSpan.from,
                notationSpan.to,
                `${definition.problems.missingFromNotation.message}: ${idOf(child)}`,
              ),
            );
      continue;
    }
    if (!written.trim()) continue;
    const span = {
      from: lineFrom + indent,
      to: lineFrom + written.trimEnd().length,
    };
    // an actor's properties (goal-controller#109), wherever the line is: no element's
    if (
      definition.actors &&
      read.kind === 'property' &&
      !read.errors.length &&
      read.key === ACTOR_LINE_KEY
    ) {
      owner = undefined;
      const valueAt = (at_: { from: number; to: number }) =>
        at({
          from: read.valueSpan.from + at_.from,
          to: read.valueSpan.from + at_.to,
        });
      const actor = readActorLine(read.value);
      if ('error' in actor) {
        push({
          ...valueAt(actor.error),
          severity: 'error',
          message: actor.error.message,
        });
        continue;
      }
      const named = targetKey(
        actorNamesOf(context),
        actor.value.target,
        'actor',
      );
      const found = 'key' in named ? context.actors?.[named.key] : undefined;
      if ('error' in named || !found)
        push({
          ...valueAt(actor.value.targetSpan),
          severity: 'error',
          message:
            'error' in named ? named.error : `No actor ${actor.value.target}`,
        });
      else if (actorsWritten.has(named.key))
        push({
          ...valueAt(actor.value.targetSpan),
          severity: 'error',
          message: `The actor ${actor.value.target} is written twice`,
        });
      else {
        actorsWritten.add(named.key);
        push(
          ...writtenPropertyDiagnostics(
            actorPropertiesOf(definition, found.kind),
            found.kind,
            actor.value,
            named.key,
            runCheck,
            valueAt,
            context,
            definition,
          ),
        );
      }
      continue;
    }
    // a line that reads as nothing, where an element line would be (not
    // under the element above): no element's
    if (
      !order &&
      block &&
      indent <= blockIndent &&
      (read.kind !== 'property' || read.errors.length)
    ) {
      owner = undefined;
      push({ ...span, severity: 'error', message: 'Not an element line' });
      continue;
    }
    if (!started) {
      push({
        ...span,
        severity: 'error',
        message: 'A property belongs under an element line',
      });
      continue;
    }
    if (!block) continue;
    if (read.kind !== 'property' || read.errors.length) {
      push({
        ...span,
        severity: 'error',
        message: 'Not a property line',
      });
      continue;
    }
    const keySpan = at(read.keySpan);
    // a link's properties, under its source (goal-controller#107)
    if (linkLinesOf(definition) && read.key === LINK_LINE_KEY) {
      const valueAt = (span: { from: number; to: number }) =>
        at({
          from: read.valueSpan.from + span.from,
          to: read.valueSpan.from + span.to,
        });
      const link = readLinkLine(read.value);
      if ('error' in link) {
        push({
          ...valueAt(link.error),
          severity: 'error',
          message: link.error.message,
        });
        continue;
      }
      const { target, targetSpan } = link.value;
      const links = Object.entries(context.links ?? {}).map(([iStarId, l]) => ({
        ...l,
        iStarId,
      }));
      // its target's key: the id written, or (without ids) the element its text names
      const named = targetKey(context.names, target);
      const key = 'key' in named ? named.key : null;
      // the source as its line names it: its id, or (without ids) its quoted text
      const source = context.names
        ? writtenTarget(context.names, block.id)
        : idOf(block.id);
      const found = key ? linkOfLine(definition, links, block.id, key) : [];
      const linesTo = key ? (block.linkTargets.get(key) ?? 0) : 0;
      if (key) block.linkTargets.set(key, linesTo + 1);
      if (!key || !(key in context.elements))
        push({
          ...valueAt(targetSpan),
          severity: 'error',
          message: 'error' in named ? named.error : `No element ${target}`,
        });
      else if (found.length === 0)
        push({
          ...valueAt(targetSpan),
          severity: 'error',
          message: `No link from ${source} to ${target} has properties in ${definition.name}`,
        });
      else if (found.length > 1)
        push({
          ...valueAt(targetSpan),
          severity: 'error',
          message: `Links of ${found.length} kinds join ${source} to ${target}: which one this line is can't be told`,
        });
      else if (linesTo > 0)
        push({
          ...valueAt(targetSpan),
          severity: 'error',
          message: `The link to ${target} is written twice`,
        });
      else {
        const [{ kind, iStarId }] = found as [(typeof found)[number]];
        push(
          ...writtenPropertyDiagnostics(
            linkPropertiesOf(definition, kind),
            kind,
            link.value,
            iStarId,
            runCheck,
            valueAt,
            context,
            definition,
          ),
        );
      }
      continue;
    }
    if (!propertyOf(definition, block.element.kind, read.key)) {
      push({
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
  if (!element) {
    // a link's or an actor's field (goal-controller#152): as its line reads it
    const field = fieldPropertyOf(definition, context, self, key);
    if (!field) return [];
    const span = { from: 0, to: value.length };
    return writtenPropertyDiagnostics(
      [field.property],
      field.kind,
      {
        target: '',
        targetSpan: { from: 0, to: 0 },
        properties: [{ key, value, keySpan: span, valueSpan: span }],
      },
      self,
      runCheck,
      (at) => at,
      context,
      definition,
    );
  }
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
