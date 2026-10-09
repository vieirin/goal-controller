/**
 * What may be typed at a position, from the definition and the model's
 * context: inside a notation, the element's children, `skip` and the
 * operators the dialect enables; on a line under an element, the keys its kind
 * reads (not yet set), then what the key's value type refers to; in an
 * annotation, the dialect's stereotypes, tags and a listed tag's values; in a
 * field, its enum's options, or the ids or names its value refers to.
 */
import {
  constructDefinition,
  propertyOf,
  valueOf,
  type DefinitionContext,
  type AnyDialect,
  type WithNotation,
  type ValueConfig,
} from '@goal-controller/dialect';
import { ASSERTION, CALLS, OCL_OPERATIONS, SKIP } from '../catalog.js';
import { lineId, readPropertyLine } from './lines.js';

export type Completion = {
  label: string;
  type: 'variable' | 'keyword' | 'property' | 'function';
  detail?: string;
  /** what to insert instead of the label, in LSP snippet syntax (`select(${1:v} | ${2:condition})`) */
  snippet?: string;
};

export type CompletionResult = {
  from: number;
  /** where what is replaced ends, when past the position (the rest of a word) */
  to?: number;
  options: Completion[];
};

type Definition = Pick<
  AnyDialect,
  'elements' | 'notation' | 'properties' | 'propertyLineOrder'
>;

const WORD = /[A-Za-z0-9_.]*$/;

/** The operators a dialect enables, with the construct (or modifier) each one is. */
const operatorOptions = ({ notation }: WithNotation): Completion[] => {
  const { operators, standalone = {}, constructs, modifiers = {} } = notation;
  const meaning = (name: string) =>
    constructs[name]?.label ?? modifiers[name]?.label ?? name;
  return [
    ...Object.entries(operators).map(([symbol, name]) => ({
      label: modifiers[name]
        ? `${symbol}${modifiers[name].argument.default}`
        : symbol in CALLS
          ? `${symbol}(`
          : symbol,
      type: 'keyword' as const,
      detail: meaning(name),
    })),
    ...Object.entries(standalone).map(([symbol, name]) => ({
      label: symbol,
      type: 'keyword' as const,
      detail: `${meaning(name)} (standalone)`,
    })),
  ];
};

/** What a dialect's properties list for a key, on any kind (an enum's options). */
const optionsOf = (
  definition: Definition,
  key: string,
  when?: { key: string; equals: string },
): string[] => {
  const found = new Set<string>();
  for (const list of Object.values(definition.properties))
    for (const property of list ?? []) {
      if (property.key !== key) continue;
      const value =
        'when' in property.value
          ? when &&
            property.value.when.key === when.key &&
            property.value.when.equals === when.equals
            ? property.value.matching
            : property.value.otherwise
          : property.value;
      if (value.type === 'enum')
        for (const option of value.options)
          if (option.value) found.add(option.value);
    }
  return [...found];
};

/**
 * Inside an annotation before the id: a stereotype (`<<…`), a tag (`{…`) or a
 * listed tag's value (`{type = …`), from the dialect's options.
 */
const annotationCompletions = (
  definition: Definition,
  before: string,
  lineStart: number,
): CompletionResult | null => {
  const atStart = (open: number) =>
    /^\s*(?:(?:<<[^<>]*>>|\{[^{}]*\})\s*)*$/.test(before.slice(0, open));
  const options = (labels: string[], detail: string): Completion[] =>
    labels.map((label) => ({ label, type: 'keyword' as const, detail }));
  const stereotype = before.lastIndexOf('<<');
  if (stereotype > before.lastIndexOf('>>') && atStart(stereotype)) {
    const written = before.slice(stereotype + 2);
    return {
      from:
        lineStart +
        stereotype +
        2 +
        (written.length - written.trimStart().length),
      options: options(optionsOf(definition, 'stereotype'), 'stereotype'),
    };
  }
  const tag = before.lastIndexOf('{');
  if (tag > before.lastIndexOf('}') && atStart(tag)) {
    const written = before.slice(tag + 1);
    const equals = written.indexOf('=');
    if (equals < 0)
      return {
        from:
          lineStart + tag + 1 + (written.length - written.trimStart().length),
        options: options(optionsOf(definition, 'tag'), 'tagged value'),
      };
    const name = written.slice(0, equals).trim();
    const value = written.slice(equals + 1);
    return {
      from:
        lineStart +
        tag +
        1 +
        equals +
        1 +
        (value.length - value.trimStart().length),
      options: options(
        optionsOf(definition, 'tagValue', { key: 'tag', equals: name }),
        name,
      ),
    };
  }
  return null;
};

/** Completions in a Notation view document at `pos`, if any apply there. */
export const completionsAt = (
  definition: Definition,
  doc: string,
  pos: number,
  context: DefinitionContext,
): CompletionResult | null => {
  const lines = doc.split('\n');
  let start = 0;
  let index = 0;
  while (index < lines.length - 1 && start + lines[index]!.length < pos) {
    start += lines[index]!.length + 1;
    index++;
  }
  const text = lines[index] ?? '';
  const before = text.slice(0, pos - start);
  const word = WORD.exec(before)?.[0] ?? '';
  const from = pos - word.length;
  const annotated = annotationCompletions(definition, before, start);
  if (annotated) return annotated;
  const id = lineId(definition, text);
  if (id) {
    if (!definition.notation) return null;
    const opened = before.lastIndexOf('[');
    if (opened < 0 || before.lastIndexOf(']') > opened) return null;
    const element = context.elements[id];
    return {
      from,
      options: [
        ...(element?.children ?? []).map((child) => ({
          label: child,
          type: 'variable' as const,
          detail: context.elements[child]?.kind,
        })),
        ...(definition.notation.operand.skip
          ? [{ label: SKIP, type: 'keyword' as const }]
          : []),
        // between operands: the operators this dialect enables, and only those
        ...(word
          ? []
          : operatorOptions(definition as Definition & WithNotation)),
      ],
    };
  }
  // a property line's value: what its property's type refers to
  const valued = /^(\s*)([A-Za-z][A-Za-z0-9_]*)[ \t]+/.exec(before);
  const onKey = before.trim() === word;
  if (!onKey && !valued) return null;
  let above = index - 1;
  let owner: string | null = null;
  const set = new Set<string>();
  for (; above >= 0; above--) {
    owner = lineId(definition, lines[above]!);
    if (owner) break;
    const property = readPropertyLine(definition, lines[above]!);
    if (property) set.add(property.key);
  }
  for (const next of lines.slice(index + 1)) {
    if (lineId(definition, next)) break;
    const property = readPropertyLine(definition, next);
    if (property) set.add(property.key);
  }
  const element = owner ? context.elements[owner] : undefined;
  const owned = element && definition.elements[element.kind];
  if (!element || !owned || owned.declares) return null;
  if (!onKey && valued) {
    const property = propertyOf(definition, element.kind, valued[2]!);
    // an engine-owned server completes the value
    if (!property || property.servedBy === 'engine') return null;
    const valueFrom = valued[0].length;
    const found = fieldCompletionsAt(
      definition,
      valueOf(property, element.properties),
      text.slice(valueFrom),
      before.length - valueFrom,
      context,
      owner ?? undefined,
    );
    return (
      found && {
        ...found,
        from: start + valueFrom + found.from,
        ...(found.to !== undefined && { to: start + valueFrom + found.to }),
      }
    );
  }
  return {
    from,
    options: (definition.properties[element.kind] ?? [])
      .filter((p) => p.inspector !== false && !set.has(p.key))
      .map((p) => ({
        label: p.key,
        type: 'property' as const,
        detail: p.help,
      })),
  };
};

/** Completions in a property field's value at `pos`. */
export const fieldCompletionsAt = (
  definition: Definition,
  value: ValueConfig,
  text: string,
  pos: number,
  context: DefinitionContext,
  /** the element whose value it is (an `ocl` value's scope) */
  elementId?: string,
): CompletionResult | null => {
  const word = WORD.exec(text.slice(0, pos))?.[0] ?? '';
  const from = pos - word.length;
  const ids = (kinds: readonly string[]) =>
    Object.entries(context.elements)
      .filter(([, element]) => kinds.includes(element.kind))
      .map(([id, element]) => ({
        label: id,
        type: 'variable' as const,
        detail: element.kind,
      }));
  if (value.type === 'refList') return { from, options: ids([value.kind]) };
  if (value.type === 'enum')
    return {
      from: text.length - text.trimStart().length,
      options: value.options
        .filter((option) => option.value)
        .map((option) => ({
          label: option.value,
          type: 'keyword' as const,
          detail: option.label,
        })),
    };
  if (value.type === 'assertion') {
    const elements = ids(value.resolves.filter((kind) => kind !== 'variable'));
    const named = new Set(elements.map((option) => option.label));
    return {
      from,
      options: [
        ...elements,
        ...(value.resolves.includes('variable')
          ? context.variables
              .filter((name) => !named.has(name))
              .map((name) => ({
                label: name,
                type: 'variable' as const,
                detail: 'variable',
              }))
          : []),
        ...ASSERTION.bool.map((keyword) => ({
          label: keyword,
          type: 'keyword' as const,
        })),
      ],
    };
  }
  if (value.type === 'ocl')
    return oclCompletions(value, text, pos, context, elementId);
  return null;
};

const NAME = /[A-Za-z_][A-Za-z0-9_]*/;

/**
 * The names an `ocl` value may use at a position: those its text binds
 * around it (`r` in `select(r:Room | `, while that parenthesis is open), those its `declaredBy` properties
 * declare on the element and its ancestors, and the model's variables.
 */
const oclScope = (
  value: Extract<ValueConfig, { type: 'ocl' }>,
  before: string,
  context: DefinitionContext,
  self: string | undefined,
): Completion[] => {
  const found = new Map<string, Completion>();
  const add = (label: string, detail: string) => {
    if (!found.has(label))
      found.set(label, { label, type: 'variable', detail });
  };
  // a binding is in scope while its parenthesis is open: `r` in
  // `exists(r | r.ok) and x->select(q | ‸`, `q` only
  const open: number[] = [];
  for (const [at, char] of [...before].entries())
    if (char === '(') open.push(at);
    else if (char === ')') open.pop();
  for (const binding of before.matchAll(
    new RegExp(
      `\\(\\s*(${NAME.source})\\s*(?::\\s*(${NAME.source}))?\\s*\\|`,
      'g',
    ),
  ))
    if (open.includes(binding.index))
      add(binding[1]!, binding[2] ?? 'bound here');
  const parents = new Map<string, string>();
  for (const [id, element] of Object.entries(context.elements))
    for (const child of element.children ?? []) parents.set(child, id);
  for (let id = self, seen = 0; id && seen < 1000; id = parents.get(id), seen++)
    for (const key of value.declaredBy ?? [])
      for (const declared of (
        context.elements[id]?.properties[key] ?? ''
      ).split(',')) {
        const [name, type] = declared.split(':').map((part) => part.trim());
        if (name && new RegExp(`^${NAME.source}$`).test(name))
          add(name, type ? `${type} (${key} of ${id})` : `${key} of ${id}`);
      }
  for (const name of context.variables) add(name, 'variable');
  return [...found.values()];
};

/**
 * Completions in an `ocl` value: after `->`, the collection operations
 * (with their templates, unless their arguments follow already); elsewhere (after `.`, on a name), the names in
 * scope.
 */
const oclCompletions = (
  value: Extract<ValueConfig, { type: 'ocl' }>,
  text: string,
  pos: number,
  context: DefinitionContext,
  self?: string,
): CompletionResult | null => {
  const before = text.slice(0, pos);
  // a name: after `r.`, what follows the dot
  const word = /[A-Za-z0-9_]*$/.exec(before)?.[0] ?? '';
  const from = pos - word.length;
  const ahead = before.slice(0, from).trimEnd();
  // inside a string (`assertion condition "…"`): nothing
  if ((before.match(/"/g)?.length ?? 0) % 2 === 1) return null;
  if (ahead.endsWith('->')) {
    // its arguments already written (`->sel‸(r | …)`): the name only
    const after = text.slice(pos);
    const rest = /^[A-Za-z0-9_]*/.exec(after)![0];
    const called = /^\s*\(/.test(after.slice(rest.length));
    return {
      from,
      // the whole name: `->sel‸ect(` becomes `->forAll(`, not `->forAllect(`
      ...(rest && { to: pos + rest.length }),
      options: OCL_OPERATIONS.map(({ name, snippet, help }) => ({
        label: name,
        type: 'function' as const,
        detail: help,
        ...(!called && { snippet }),
      })),
    };
  }
  const options = oclScope(value, before, context, self);
  return options.length ? { from, options } : null;
};

/**
 * An inspector field's completions: its element's property, read with its
 * value type. None when an engine-owned server serves the value
 * (`servedBy: 'engine'`).
 */
export const fieldCompletions = (
  definition: Definition,
  context: DefinitionContext,
  elementId: string,
  key: string,
  text: string,
  pos: number,
): CompletionResult | null => {
  const element = context.elements[elementId];
  const property = element && propertyOf(definition, element.kind, key);
  if (!property || property.servedBy === 'engine') return null;
  return fieldCompletionsAt(
    definition,
    valueOf(property, element.properties),
    text,
    pos,
    context,
    elementId,
  );
};

/** A construct's hover text: `Sequence — does every child, one after another`. */
export const constructHint = (
  definition: WithNotation,
  construct: string,
): string | null => {
  const found = constructDefinition(definition, construct);
  return found ? `${found.label} — ${found.help}` : null;
};
