/**
 * A goal model's facts, for any engine (goal-controller#75): each element
 * defined by its id (`gm.goal`, `gm.task`, …, a member of its parent), and
 * the ids its notation lists, references among its children. Each field is a
 * document of its own (`model:<key>:<field>`), so a location doesn't depend on
 * how a view lays the model out. An engine adds what its fields mean through
 * hooks: an element's type, what its name or a property refers to.
 */
import type { AnyDialect } from '@goal-controller/dialect';
import {
  goalServices,
  parseWith,
  withoutBracketSpaces,
} from '@goal-controller/goal-language';
import type { GoalView, GoalViewNode } from '@goal-controller/goal-tree';
import type {
  DocumentFacts,
  KindDefinition,
  RuleDefinition,
  RuleLocation,
  RuleReference,
  RuleRelation,
} from './facts';

/** An element's definition id. */
export const elementId = (key: string) => `gm:${key}`;

/** A model field's document. */
export const modelField = (key: string, field: string) =>
  `model:${key}:${field}`;

/** The element and field of a model field's document (null: not one). */
export const modelFieldOf = (
  document: string,
): { key: string; field: string } | null => {
  const match = /^model:(.*):([^:]*)$/.exec(document);
  return match ? { key: match[1]!, field: match[2]! } : null;
};

/** The goal model's kinds: its elements', and a notation's child. */
export const GOAL_MODEL_KINDS: Readonly<Record<string, KindDefinition>> = {
  'gm.goal': { label: 'goal' },
  'gm.task': { label: 'task' },
  'gm.resource': { label: 'resource' },
  'gm.quality': { label: 'quality' },
  // a notation's id: among the element's children (goalModel.rls)
  'gm.child': { label: 'child', scope: 'rules' },
};

/** What a field's reader writes its facts with. */
export type FieldContext = {
  node: GoalViewNode;
  /** the element's definition id */
  self: string;
  /** the field's document */
  document: string;
  at(from: number, to: number): RuleLocation;
  define(definition: RuleDefinition): void;
  /** a reference, with its id in the field (`m0`, `m1`, …) */
  refer(
    kinds: string[],
    name: string,
    location: RuleLocation,
    scope?: RuleReference['scope'],
  ): RuleReference;
  relate(relation: RuleRelation): void;
};

export type FieldReader = (text: string, context: FieldContext) => void;

/** What an engine reads of its model's fields, beside ids and notations. */
export type ModelHooks = {
  /** an element's type, when it declares one (Edge's int resources) */
  elementType?(node: GoalViewNode): string | undefined;
  /** what an element's name refers to (MutRoSe: a task's HDDL task) */
  name?: FieldReader;
  /** how a property is read (none: not read) */
  field?(node: GoalViewNode, key: string): FieldReader | undefined;
};

/** The facts of one field's text. */
const fieldFacts = (
  document: string,
  text: string,
  node: GoalViewNode,
  read: FieldReader,
): DocumentFacts => {
  const facts: DocumentFacts & { relations: RuleRelation[] } = {
    document,
    text,
    definitions: [],
    references: [],
    relations: [],
  };
  let counter = 0;
  read(text, {
    node,
    self: elementId(node.key),
    document,
    at: (from, to) => ({ document, from, to }),
    define: (definition) => facts.definitions.push(definition),
    refer: (kinds, name, location, scope) => {
      const reference: RuleReference = {
        kinds,
        name,
        location,
        id: `m${counter++}`,
        ...(scope && { scope }),
      };
      facts.references.push(reference);
      return reference;
    },
    relate: (relation) => facts.relations.push(relation),
  });
  return facts;
};

/** The ids a notation lists, where they are written in it. */
const notationIds = (
  dialect: Pick<AnyDialect, 'notation'>,
  notation: string,
): { id: string; from: number; to: number }[] => {
  // read as an element line's bracket, without its spaces where the dialect
  // ignores them (GODA's `T1.1 2` is T1.12)
  const prefix = 'G0: x [';
  const line = `${prefix}${notation}]`;
  const read =
    dialect.notation?.whitespace === 'ignore'
      ? withoutBracketSpaces(line)
      : { text: line, origin: (offset: number) => offset };
  const parsed = parseWith(goalServices(), 'elementLine', read.text);
  const found: { id: string; from: number }[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const value = node as Record<string, unknown>;
    if (value.$type === 'RtRef') {
      // a reference: its text and node (its `ref` getter would link it)
      const reference = value.ref as {
        $refText: string;
        $refNode?: { offset: number };
      };
      if (reference.$refNode)
        found.push({ id: reference.$refText, from: reference.$refNode.offset });
      return;
    }
    for (const [key, child] of Object.entries(value))
      if (!key.startsWith('$'))
        (Array.isArray(child) ? child : [child]).forEach(visit);
  };
  if (!parsed.parserErrors.length) visit(parsed.value);
  return found
    .filter(({ from }) => from >= prefix.length)
    .map(({ id, from }) => ({
      id,
      from: read.origin(from) - prefix.length,
      to: read.origin(from + id.length - 1) + 1 - prefix.length,
    }));
};

/**
 * A goal model's facts, field by field: each element's id, name and
 * notation, then the properties the engine's hooks read.
 */
export const readGoalModel = (
  view: GoalView,
  dialect: Pick<AnyDialect, 'notation'>,
  hooks: ModelHooks = {},
): DocumentFacts[] => {
  const documents: DocumentFacts[] = [];
  for (const node of view.nodes.values()) {
    const self = elementId(node.key);
    const type = hooks.elementType?.(node);
    documents.push(
      fieldFacts(modelField(node.key, 'id'), node.id, node, (text, c) => {
        c.define({
          id: self,
          kind: `gm.${node.kind}`,
          name: text,
          location: c.at(0, text.length),
          ...(node.parent && { owner: elementId(node.parent) }),
          ...(type && { type }),
        });
        c.relate(['gm_element', self]);
      }),
    );
    documents.push(
      fieldFacts(
        modelField(node.key, 'name'),
        node.name,
        node,
        hooks.name ?? (() => {}),
      ),
    );
    if (node.notation)
      documents.push(
        fieldFacts(
          modelField(node.key, 'notation'),
          node.notation,
          node,
          (text, c) => {
            for (const { id, from, to } of notationIds(dialect, text))
              c.refer(['gm.child'], id, c.at(from, to), { owner: self });
          },
        ),
      );
    for (const [key, text] of Object.entries(node.properties)) {
      const read = hooks.field?.(node, key);
      if (read)
        documents.push(fieldFacts(modelField(node.key, key), text, node, read));
    }
  }
  return documents;
};
