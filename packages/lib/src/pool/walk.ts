/**
 * A typed value walked with its schema (or a Langium AST with its
 * language's map), into what it annotates: each annotated value where it
 * is, in the order written, with the objects it sits in. Nothing is
 * resolved here; facts.ts makes the pool's facts of it.
 */
import { GrammarUtils, isAstNode, isReference, type AstNode } from 'langium';
import { safeParse, type $ZodType } from 'zod/v4/core';
import {
  annotationOf,
  type Annotated,
  type Annotation,
  type Kind,
  type Location,
  type NamePart,
} from './protocol';
import type { LangiumParser } from './parsers';
import type { ValuePath } from './read';

/** An object a value sits in (a Langium node is one), and its path. */
export type Frame = { value: object; path: ValuePath };

/** Where a value of the walked value is written, and its text there. */
export type Written = Location & { text: string };

/** What the walk found: an annotated value. */
export type Entity = {
  annotations: Annotation[];
  /** its path in the document's value (a record's key: its entry's) */
  path: ValuePath;
  /** a record's key, not its entry's value */
  isKey?: true;
  /** the objects it sits in, the one it is in last */
  frames: readonly Frame[];
  value: unknown;
  parent: unknown;
  /** where the whole value is written (none: nowhere, as a model's derived value) */
  written?: Written;
  /** as written: the value's text, or that of a key of its parent */
  text: (key?: string | number) => string | undefined;
  /**
   * what a Langium language's kinds define and refer to: the nearest
   * enclosing definition or scope node (lexical scoping; what an annotation
   * says isn't)
   */
  langiumOwner?: Entity;
  /** a definition or cross-reference of a Langium language's kinds */
  lexical?: true;
  /** a Langium scope node (owns members, defines nothing) */
  scopeNode?: true;
};

/** How a walk locates what it finds. */
export type Locator = {
  /** where a path of the value is written (a key's, with `'key'`) */
  at: (path: ValuePath, part?: 'key') => Written | undefined;
};

export const pathKey = (path: ValuePath, isKey?: boolean) =>
  `${JSON.stringify(path)}${isKey ? '#key' : ''}`;

/** The schema under its wrappers, and every annotation on the way. */
const unwrap = (schema: $ZodType) => {
  const marks: Annotation[] = [];
  let current = schema;
  for (;;) {
    const def = current._zod.def as Record<string, unknown> & {
      type: string;
      checks?: object[];
    };
    for (const zodCheck of def.checks ?? []) {
      const annotation = annotationOf(zodCheck);
      if (annotation) marks.push(annotation);
    }
    switch (def.type) {
      case 'optional':
      case 'nullable':
      case 'default':
      case 'prefault':
      case 'nonoptional':
      case 'readonly':
      case 'catch':
        current = def.innerType as $ZodType;
        continue;
      case 'lazy':
        current = (def.getter as () => $ZodType)();
        continue;
      case 'pipe':
        current = def.in as $ZodType;
        continue;
    }
    return { schema: current, def, marks };
  }
};

/** A Langium value: its nodes, with where each is written in the string. */
const parseWritten = (
  parser: LangiumParser,
  text: string,
): {
  root: AstNode;
  errors: { from: number; to: number; message: string }[];
} => {
  const { start } = parser.options;
  const result = parser.grammar.parser.LangiumParser.parse(
    text,
    start ? { rule: start } : undefined,
  );
  const errors = [
    ...result.lexerErrors.map((e) => ({
      from: e.offset,
      to: e.offset + Math.max(e.length, 1),
      message: e.message,
    })),
    ...result.parserErrors.map((e) => {
      const from = Number.isNaN(e.token.startOffset)
        ? text.length
        : e.token.startOffset;
      return {
        from: Math.min(from, Math.max(text.length - 1, 0)),
        to: Math.min(
          Number.isNaN(e.token.endOffset ?? NaN)
            ? from + 1
            : (e.token.endOffset ?? from) + 1,
          text.length,
        ),
        message: e.message,
      };
    }),
  ];
  return { root: result.value, errors };
};

export type SyntaxError = Location & { message: string };

export type Walk = {
  entities: Entity[];
  /** the Langium values' syntax errors */
  syntax: SyntaxError[];
};

/**
 * A typed value's annotated values, walking its schema along (a union: the
 * first option the value is).
 */
export const walkValue = (
  schema: $ZodType,
  root: unknown,
  locator: Locator,
  path: ValuePath = [],
  frames: readonly Frame[] = [],
  walk: Walk = { entities: [], syntax: [] },
): Walk => {
  const visit = (
    schema: $ZodType,
    value: unknown,
    path: ValuePath,
    frames: readonly Frame[],
    parent: unknown,
    isKey?: true,
  ): void => {
    const { def, marks } = unwrap(schema);
    const text = (key?: string | number) =>
      (key === undefined
        ? locator.at(path, isKey && 'key')
        : locator.at([...path, key])
      )?.text;
    const written = locator.at(path, isKey && 'key');
    const writtenIn = marks.filter(
      (m): m is Extract<Annotation, { written: unknown }> => 'written' in m,
    );
    const others = marks.filter((m) => !('written' in m));
    if (others.length)
      walk.entities.push({
        annotations: others,
        path,
        ...(isKey && { isKey }),
        frames,
        value,
        parent,
        written,
        text,
      });
    if (typeof value === 'string' && written)
      for (const { written: parser, part } of writtenIn)
        walkLangium(
          parser as LangiumParser,
          value,
          written,
          part,
          path,
          frames,
          walk,
        );
    if (def.type === 'union') {
      const option = (def.options as $ZodType[]).find(
        (o) => safeParse(o, value).success,
      );
      if (option) visit(option, value, path, frames, parent, isKey);
      return;
    }
    if (def.type === 'intersection') {
      visit(def.left as $ZodType, value, path, frames, parent, isKey);
      visit(def.right as $ZodType, value, path, frames, parent, isKey);
      return;
    }
    if (value === null || typeof value !== 'object' || isKey) return;
    switch (def.type) {
      case 'object': {
        const inside = [...frames, { value, path }];
        const shape = def.shape as Record<string, $ZodType>;
        for (const [key, child] of Object.entries(shape))
          if (key in value)
            visit(
              child,
              (value as Record<string, unknown>)[key],
              [...path, key],
              inside,
              value,
            );
        return;
      }
      case 'record': {
        const inside = [...frames, { value, path }];
        for (const [key, child] of Object.entries(value)) {
          visit(
            def.keyType as $ZodType,
            key,
            [...path, key],
            inside,
            value,
            true,
          );
          visit(
            def.valueType as $ZodType,
            child,
            [...path, key],
            inside,
            value,
          );
        }
        return;
      }
      case 'array':
        if (Array.isArray(value))
          value.forEach((item, index) =>
            visit(
              def.element as $ZodType,
              item,
              [...path, index],
              frames,
              value,
            ),
          );
        return;
      case 'tuple':
        if (Array.isArray(value))
          (def.items as $ZodType[]).forEach((item, index) =>
            visit(item, value[index], [...path, index], frames, value),
          );
        return;
    }
  };
  visit(schema, root, path, frames, undefined);
  return walk;
};

/** A string's part, where it starts in the string (all of it: none given). */
export const partOf = (text: string, part: NamePart | undefined) =>
  part ? part(text) : { text, offset: 0 };

/**
 * A Langium value written in a string of the typed value (or a Langium
 * file, `written` the whole text): its nodes, their annotations and the
 * language's kinds, at their offsets.
 */
export const walkLangium = (
  parser: LangiumParser,
  value: string,
  written: Written,
  part: NamePart | undefined,
  path: ValuePath,
  frames: readonly Frame[],
  walk: Walk,
): AstNode | undefined => {
  const piece = partOf(value, part);
  if (!piece) return undefined;
  const base = written.from + piece.offset;
  const { root, errors } = parseWritten(parser, piece.text);
  for (const error of errors)
    walk.syntax.push({
      document: written.document,
      from: base + error.from,
      to: base + error.to,
      message: error.message,
    });
  const { kinds = {}, annotate = {}, scopes = [] } = parser.options;
  const reflection = parser.grammar.shared.AstReflection;
  const at = (from: number, to: number, text: string): Written => ({
    document: written.document,
    from: base + from,
    to: base + to,
    text,
  });
  /** the kinds a cross-reference's type is: its own, or its mapped subtypes' */
  const kindsOf = (type: string): Kind[] =>
    kinds[type]
      ? [kinds[type]!]
      : reflection
          .getAllSubTypes(type)
          .flatMap((sub) => (kinds[sub] ? [kinds[sub]!] : []));

  const node = (
    ast: AstNode,
    path: ValuePath,
    frames: readonly Frame[],
    owner: Entity | undefined,
    parent: unknown,
  ): void => {
    const inside = [...frames, { value: ast, path }];
    const cst = ast.$cstNode;
    const textOf = (key?: string | number): string | undefined => {
      if (key === undefined) return cst?.text;
      const child = GrammarUtils.findNodeForProperty(cst, String(key));
      return child?.text;
    };
    const mapped = annotate[ast.$type] ?? {};
    const marksOf = (property: string): Annotation[] => {
      const declared = mapped[property];
      return (typeof declared === 'function' ? declared(ast) : (declared ?? []))
        .map((m: Annotated) => annotationOf(m))
        .filter((m): m is Annotation => m !== undefined);
    };
    let self = owner;
    // a mapped kind's definition takes the options of the same `defines` on its name
    let merged: Annotation | undefined;
    const kind = kinds[ast.$type];
    const name = (ast as { name?: unknown }).name;
    if (kind && typeof name === 'string') {
      const nameNode = GrammarUtils.findNodeForProperty(cst, 'name');
      if (nameNode) {
        merged = marksOf('name').find(
          (m) => 'defines' in m && m.defines === kind,
        );
        self = {
          annotations: [{ ...merged, defines: kind }],
          path: [...path, 'name'],
          frames: inside,
          value: name,
          parent: ast,
          written: at(nameNode.offset, nameNode.end, nameNode.text),
          text: (key) => (key === undefined ? nameNode.text : textOf(key)),
          langiumOwner: owner,
          lexical: true,
        };
        walk.entities.push(self);
      }
    } else if (scopes.includes(ast.$type) && cst) {
      self = {
        annotations: [],
        path,
        frames,
        value: ast,
        parent,
        text: textOf,
        langiumOwner: owner,
        scopeNode: true,
      };
      walk.entities.push(self);
    }
    for (const [property, child] of Object.entries(ast)) {
      if (property.startsWith('$')) continue;
      const marks = marksOf(property).filter((m) => m !== merged);
      const items = Array.isArray(child) ? child : [child];
      items.forEach((item: unknown, index) => {
        const itemPath = Array.isArray(child)
          ? [...path, property, index]
          : [...path, property];
        const at$ = Array.isArray(child) ? index : undefined;
        if (isReference(item)) {
          const ref = item.$refNode;
          const refKinds = kindsOf(
            reflection.getReferenceType({
              reference: item,
              container: ast,
              property,
              ...(at$ !== undefined && { index: at$ }),
            }),
          );
          // a `refersTo` on the property says it instead of the grammar
          const own = marks.some((m) => 'refersTo' in m);
          const lexical = !own && refKinds.length > 0;
          const annotations: Annotation[] = [
            ...(lexical ? [{ refersTo: refKinds }] : []),
            ...marks,
          ];
          if (ref && annotations.length)
            walk.entities.push({
              annotations,
              path: itemPath,
              frames: inside,
              value: item.$refText,
              parent: ast,
              written: at(ref.offset, ref.end, ref.text),
              text: () => ref.text,
              langiumOwner: self,
              ...(lexical && { lexical: true as const }),
            });
          return;
        }
        if (isAstNode(item)) {
          const itemCst = item.$cstNode;
          if (marks.length && itemCst)
            walk.entities.push({
              annotations: marks,
              path: itemPath,
              frames: inside,
              value: item,
              parent: ast,
              written: at(itemCst.offset, itemCst.end, itemCst.text),
              text: () => itemCst.text,
            });
          node(item, itemPath, inside, self, ast);
          return;
        }
        if (!marks.length) return;
        const leaf = GrammarUtils.findNodeForProperty(cst, property, at$);
        if (!leaf) return;
        walk.entities.push({
          annotations: marks,
          path: itemPath,
          frames: inside,
          value: item,
          parent: ast,
          written: at(leaf.offset, leaf.end, leaf.text),
          text: (key) => (key === undefined ? leaf.text : textOf(key)),
        });
      });
    }
  };
  node(root, path, frames, undefined, undefined);
  return root;
};
