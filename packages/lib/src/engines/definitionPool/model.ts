/**
 * A goal model in the pool, for any dialect: its elements (by their ids),
 * and the children each element's notation lists. Each element's field is a
 * document of its own (`model:<key>:<field>`), so a location doesn't depend
 * on how a view lays the model out. A dialect adds what its fields mean
 * through hooks: what an element is (its type), and what a property defines
 * or refers to.
 */
import type {
  AnyDialect,
  DocumentNode,
  DocumentTree,
} from '@goal-controller/dialect';
import {
  goalServices,
  parseWith,
  withoutBracketSpaces,
} from '@goal-controller/goal-language';
import type {
  PoolDefinition,
  PoolDocument,
  PoolFacts,
  PoolKind,
  PoolLocation,
  PoolProvider,
  PoolReference,
} from './types';

/** The provider's namespace: `gm.goal`, `gm.task`, … */
export const MODEL_PROVIDER = 'gm';

/** A model field's document id. */
export const modelFieldDocument = (element: string, field: string) =>
  `model:${element}:${field}`;

/** The element and field of a model document id (null: not the model's). */
export const modelFieldOf = (
  document: string,
): { element: string; field: string } | null => {
  const match = /^model:(.*):([^:]*)$/.exec(document);
  return match ? { element: match[1]!, field: match[2]! } : null;
};

/** The id of an element's definition (by its key: a scoped id stays apart). */
export const elementDefinitionId = (node: { kind: string }, key: string) =>
  `${MODEL_PROVIDER}.${node.kind}:${key}`;

/** What a field reader is given, besides the field's text. */
export type ModelFieldContext = {
  /** the element's key, and its node */
  key: string;
  node: DocumentNode;
  /** the element's definition id */
  self: string;
  /** a location in this field's document */
  at(from: number, to: number): PoolLocation;
  /** kept across one model's extraction (a variable declared at its first use) */
  state: Map<string, unknown>;
};

/** What a property's text defines and refers to. */
export type ModelFieldReader = (
  text: string,
  context: ModelFieldContext,
) => PoolFacts;

export type ModelProviderHooks = {
  /** the dialect: its ids' notation (whitespace) and its properties */
  dialect: Pick<AnyDialect, 'notation'>;
  /** kinds the dialect defines in the model, besides its elements' (`variable`) */
  kinds?: Readonly<Record<string, PoolKind>>;
  /** what its fields refer to, in other providers */
  refers?: readonly string[];
  /** what an element is, besides its id: its type, a word on it */
  element?: (
    node: DocumentNode,
    key: string,
  ) => Pick<PoolDefinition, 'type' | 'detail'> | undefined;
  /** how a property's text is read (none: not read) */
  field?: (node: DocumentNode, key: string) => ModelFieldReader | undefined;
};

/** The ids an element's notation lists, where they are written in it. */
const notationIds = (
  dialect: ModelProviderHooks['dialect'],
  notation: string,
): { id: string; from: number; to: number }[] => {
  // read as an element line's bracket, without its spaces where the dialect
  // ignores them (`T1.1 2` is T1.12)
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
      const ref = value.ref as {
        $refText: string;
        $refNode?: { offset: number };
      };
      if (ref.$refNode)
        found.push({ id: ref.$refText, from: ref.$refNode.offset });
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
 * A goal-model provider: each element defined by its id (global: a
 * condition may name it), each child a member of its parent (`gm.child`),
 * which the parent's notation refers to; and what the dialect's hooks read
 * of its fields.
 */
export const createModelProvider = (
  hooks: ModelProviderHooks,
): PoolProvider => ({
  id: MODEL_PROVIDER,
  documents: { model: true },
  kinds: {
    goal: { label: 'Goal' },
    task: { label: 'Task' },
    resource: { label: 'Resource' },
    quality: { label: 'Quality' },
    child: { label: 'child', scope: 'owner' },
    ...hooks.kinds,
  },
  refers: hooks.refers,
  extract: (document: PoolDocument): PoolFacts => {
    const tree = document.value as DocumentTree | undefined;
    const definitions: PoolDefinition[] = [];
    const references: PoolReference[] = [];
    const state = new Map<string, unknown>();
    for (const [key, node] of tree?.nodes ?? []) {
      const at = (field: string) => (from: number, to: number) => ({
        document: modelFieldDocument(key, field),
        from,
        to,
      });
      const self = elementDefinitionId(node, key);
      definitions.push({
        id: self,
        kind: `${MODEL_PROVIDER}.${node.kind}`,
        name: node.id,
        location: at('id')(0, node.id.length),
        detail: node.name,
        ...hooks.element?.(node, key),
      });
      // its children, as its notation names them
      for (const child of node.children) {
        const childNode = tree!.nodes.get(child);
        if (childNode)
          definitions.push({
            id: `${MODEL_PROVIDER}.child:${key}>${child}`,
            kind: `${MODEL_PROVIDER}.child`,
            name: childNode.id,
            // where the child is: its own id
            location: {
              document: modelFieldDocument(child, 'id'),
              from: 0,
              to: childNode.id.length,
            },
            owner: self,
          });
      }
      if (node.notation)
        for (const { id, from, to } of notationIds(
          hooks.dialect,
          node.notation,
        ))
          references.push({
            kinds: [`${MODEL_PROVIDER}.child`],
            name: id,
            location: at('notation')(from, to),
            scope: { owner: self },
            // the goal language says an id that is no child (`notAChild`)
            silent: true,
          });
      for (const [field, text] of Object.entries(node.properties)) {
        const read = hooks.field?.(node, field);
        if (!read) continue;
        const facts = read(text, { key, node, self, at: at(field), state });
        definitions.push(...facts.definitions);
        references.push(...facts.references);
      }
    }
    return { definitions, references };
  },
  // ids are the diagram's (and the engines' outputs'): not renamed here
  renameText: (definition, newName) =>
    definition.kind.startsWith(`${MODEL_PROVIDER}.`) &&
    Object.keys(hooks.kinds ?? {}).some(
      (kind) => definition.kind === `${MODEL_PROVIDER}.${kind}`,
    ) &&
    /^[A-Za-z_][A-Za-z0-9_]*$/.test(newName)
      ? newName
      : null,
});
