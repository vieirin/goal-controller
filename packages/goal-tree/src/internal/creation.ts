/**
 * Internal tree creation logic: the IR of a model, built with a mapper as
 * goal-tree runs it (`RunMapper`, goal-controller#215).
 */
import { childrenOf, isActorIn, metamodelOf } from '@istar-ts/core';
import { hasIds, ISTAR_KIND_OF } from '@goal-controller/dialect';
import {
  readProperties,
  type PropertyOwner,
  type ReadingContext,
} from '@goal-controller/goal-language';
import { getGoalDetail } from '../parsers/goalNameParser';
import type {
  AnyModel,
  GoalExecutionDetail,
  Node as ModelNode,
  Relation,
} from '../types/';
import type {
  KindModel,
  KindNode,
  KindProps,
  ModelElement,
  Naming,
  Shape,
} from '../types/kindTree';
import type { MapperDialect, PropsOf } from './engineMapper';
import type { KindEngineMapper } from './entries';
import {
  actorRoots,
  modelShapeProblem,
  otherFrameworkOf,
  refinementsOf,
  type Refinement,
} from './roots';
import { runMapperOf, type RunEntry, type RunMapper } from './runMapper';

export { createEngineMapper } from './engineMapper';
export type { GoalExecutionDetail };

/** An element of a model of any framework (goal-controller#185). */
type Node = ModelNode<string>;

/** A node as the builder makes it, before the types say which kind it is. */
type BuiltNode = {
  iStarId: string;
  id: string;
  kind?: string;
  type: string;
  name: string | null;
  children?: BuiltNode[];
  tasks?: BuiltNode[];
  resources?: BuiltNode[];
  properties: { root?: boolean; engine: unknown };
  /** a resource's strings, as they always have been on it */
  rawProps?: Readonly<Record<string, string>>;
};

/**
 * An element's text read in the engine's dialect. In a dialect without ids
 * (no element kind has a prefix) it is not parsed: its id is its piStar
 * id, its name its text (goal-controller#125). In a dialect of another
 * framework (goal-controller#171), or for an element no tree holds, a text
 * without an id (DSM3's own files) keeps its piStar id, and its text is its
 * name.
 */
const readText = (
  node: Node,
  dialect: MapperDialect,
  { lenient = false }: { lenient?: boolean } = {},
) => {
  if (dialect.elements && !hasIds({ elements: dialect.elements }))
    return { id: node.id, goalName: node.name, executionDetail: null };
  if (!otherFrameworkOf(dialect) && !lenient)
    return getGoalDetail({ goalText: node.name, dialect });
  // a text without an id is no error here: the Notation view asks for one
  const detail = getGoalDetail({
    goalText: node.name,
    dialect,
    onSyntaxError: () => {},
  });
  return {
    ...detail,
    id: detail.id || node.id,
    goalName: detail.goalName || node.name.trim(),
  };
};

/** The dialect kind whose properties an element has: iStar's (`goal`, …) for its iStar kind, else its own (a framework's, an extension's). */
const ISTAR_KINDS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(ISTAR_KIND_OF).map(([kind, iStar]) => [iStar, kind]),
);
const dialectKindOf = (kind: string, dialect: MapperDialect): string =>
  otherFrameworkOf(dialect) ? kind : (ISTAR_KINDS[kind] ?? kind);

/**
 * The keys an actor's or a link's `raw` holds: every actor's, every link
 * kind's, whatever its kind (a check reports one on a kind without it, a
 * `context` on a cgm link that has none).
 */
const ownerKeys = (
  dialect: MapperDialect,
  owner: { actor: string } | { link: string },
): string[] =>
  'actor' in owner
    ? (dialect.actors ?? []).map((property) => property.key)
    : Object.values(dialect.links ?? {}).flatMap((list) =>
        list.map((property) => property.key),
      );

/**
 * An element's, an actor's or a link's properties as its mapper is given
 * them (goal-controller#187): those the dialect gives its kind, read as their
 * types (`props`), and as written (`raw`); an actor's and a link's `raw` has
 * every actor's and every link kind's keys (`ownerKeys`).
 */
function propsOf(
  dialect: MapperDialect,
  owner: PropertyOwner,
  customProperties: Readonly<Record<string, string | undefined>>,
  reading: ReadingContext,
): PropsOf<never> {
  const { values, text } = readProperties(
    dialect,
    owner,
    customProperties,
    reading,
  );
  if ('element' in owner) return { props: values, raw: text } as PropsOf<never>;
  const raw: Record<string, string> = {};
  for (const key of ownerKeys(dialect, owner)) {
    const written = customProperties[key];
    if (written !== undefined) raw[key] = written;
  }
  return { props: values, raw } as PropsOf<never>;
}

/** An element's input, as its entry's `mapProps` is given it. */
type ElementInput = Record<string, unknown> & {
  kind: string;
  props: Record<string, unknown>;
  raw: Record<string, string>;
};

/** What an element's entry is given: its kind's properties, ids, name, text and execution detail. */
const inputOf = (
  node: Node,
  mapper: RunMapper,
  read: ReturnType<typeof readText>,
  reading: ReadingContext,
): ElementInput => {
  const { root, uniqueChoice, ...customProperties } =
    node.customProperties || {};
  const stored = { ...customProperties, root };
  return {
    ...(propsOf(
      mapper.dialect,
      { element: dialectKindOf(node.kind, mapper.dialect) },
      stored,
      reading,
    ) as unknown as Pick<ElementInput, 'props' | 'raw'>),
    executionDetail: read.executionDetail,
    id: read.id,
    name: read.goalName,
    text: node.name,
    kind: node.kind,
  };
};

/**
 * Per call: each node's input, for its entry's afterCreation, and what the
 * properties' references resolve against (goal-controller#243).
 */
type CreationContext = {
  inputs: Map<string, ElementInput>;
  reading: ReadingContext;
};

/**
 * The kind of the element an id names, its RT id (as its text reads in the
 * dialect) or its piStar id, as the dialect names kinds (`goal`): what a
 * `reference` resolves against (goal-controller#243). Read once per model,
 * on first use.
 */
const readingOf = (model: AnyModel, mapper: RunMapper): ReadingContext => {
  let kinds: Map<string, string> | undefined;
  const isActor = isActorIn(metamodelOf(model));
  return {
    kindOf: (id) => {
      if (!kinds) {
        kinds = new Map();
        for (const element of model.elements.values()) {
          if (isActor(element)) continue;
          const kind = dialectKindOf(element.kind, mapper.dialect);
          kinds.set(element.id, kind);
          const { id: written } = readText(element as Node, mapper.dialect, {
            lenient: true,
          });
          if (written && !kinds.has(written)) kinds.set(written, kind);
        }
      }
      return kinds.get(id);
    },
  };
};

/** Where a node is: its parent's relation to it, its children, whether it is a root, its actor. */
type Placement = {
  relation: Relation;
  children: BuiltNode[];
  isRoot: boolean;
  actor?: string;
};

/**
 * A node under the iStar reading (`shape: 'istar'`): a goal holds its goals
 * and tasks, a task its tasks and resources, with the reading's checks.
 */
function istarNode(
  node: Node,
  entry: RunEntry,
  mapper: RunMapper,
  context: CreationContext,
  { relation, children, isRoot, actor }: Placement,
): BuiltNode {
  const read = readText(node, mapper.dialect);
  const { id, goalName } = read;
  // every element the engines read is named after its RT id ("G4: …")
  if (!id) {
    throw new Error(
      `[INVALID MODEL]: "${node.name.trim()}" has no id: start its name with one, like G4: ${node.name.trim() || 'name'}`,
    );
  }
  const nodeType = entry.as;
  const isQualityNode = node.kind === 'istar.Quality';

  if (nodeType === 'resource' && children.length > 0) {
    throw new Error(
      `[INVALID MODEL]: Resource node ${goalName} can't have children`,
    );
  }

  const resources = children.filter((child) => child.type === 'resource');
  const tasks = children.filter((child) => child.type === 'task');
  const goals = children.filter(
    (child) => child.type !== 'resource' && child.type !== 'task',
  );

  if (
    !children.length &&
    !tasks.length &&
    nodeType === 'goal' &&
    !isQualityNode &&
    actor !== undefined &&
    !mapper.allowLeafGoals
  ) {
    throw new Error(
      `[INVALID MODEL]: Leaf Goal ${id}:${goalName} has no children or tasks`,
    );
  }

  if (resources.length > 0 && nodeType !== 'task') {
    throw new Error(
      `[INVALID MODEL]: Only tasks can have resources, node ${id}:${goalName} is not a task, it is a ${nodeType} instead`,
    );
  }

  if (goals.length > 0 && nodeType === 'task') {
    throw new Error(
      `[INVALID MODEL]: Task ${id}:${goalName} cannot have goal children. Tasks can only have resources and other tasks as children.`,
    );
  }

  const input = inputOf(node, mapper, read, context.reading);
  context.inputs.set(id, input);
  const base = {
    id,
    // every node says what it is (goal-controller#171, #215)
    kind: node.kind,
    name: goalName,
    iStarId: node.id,
    x: node.x,
    ...(actor !== undefined && { actor }),
    relationToChildren: relation,
    type: nodeType,
  };

  if (nodeType === 'resource')
    return {
      ...base,
      // its strings stay on the node, as they always have
      rawProps: input.raw,
      properties: { engine: entry.mapProps(input) },
    } as BuiltNode;

  if (nodeType === 'task')
    return {
      ...base,
      tasks,
      resources,
      properties: { engine: entry.mapProps(input) },
    } as BuiltNode;

  return {
    ...base,
    children: goals,
    properties: {
      ...(isRoot && { root: true }),
      engine: entry.mapProps(input),
    },
    ...(tasks.length > 0 && { tasks }),
  } as BuiltNode;
}

/** A node under an engine's own naming: its kind, its `as`, every child in `children`. */
function kindNode(
  node: Node,
  entry: RunEntry,
  mapper: RunMapper,
  context: CreationContext,
  { relation, children, isRoot, actor }: Placement,
): BuiltNode {
  const read = readText(node, mapper.dialect);
  if (!read.id) {
    throw new Error(
      `[INVALID MODEL]: "${node.name.trim()}" has no id: start its name with one, like G4: ${node.name.trim() || 'name'}`,
    );
  }
  const input = inputOf(node, mapper, read, context.reading);
  context.inputs.set(read.id, input);
  return {
    id: read.id,
    kind: node.kind,
    name: read.goalName,
    iStarId: node.id,
    x: node.x,
    ...(actor !== undefined && { actor }),
    relationToChildren: relation,
    type: entry.as,
    children,
    properties: {
      ...(isRoot && { root: true }),
      engine: entry.mapProps(input),
    },
  } as BuiltNode;
}

/** Whether a kind is a tree's (it has an entry that is). */
const isTreeKind = (mapper: RunMapper, kind: string): boolean =>
  mapper.entries.get(kind)?.tree === true;

/** A node and its descendants. */
function nodeToTree({
  nodes,
  refinements,
  node,
  mapper,
  context,
  isRoot = false,
  actor,
}: {
  nodes: readonly Node[];
  /** the model's refinements, in its links' order (`refinementsOf`) */
  refinements: readonly Refinement[];
  node: Node;
  mapper: RunMapper;
  context: CreationContext;
  isRoot?: boolean;
  actor?: string;
}): BuiltNode {
  // the refinements into it: its children (goal-controller#125: any other
  // link into it, a qualification, a contribution, a dependency, an
  // extension's, is one of the model's links, not a child)
  const into = refinements.filter(
    (refinement) => refinement.parent === node.id,
  );
  const relations = into.map((refinement) => refinement.relation);
  if (!relations.every((relation) => relation === relations[0])) {
    throw new Error(`
            [INVALID MODEL]: You can't mix and/or relations
        `);
  }
  const children = into
    .map(({ child }) => nodes.find((item) => item.id === child))
    // a kind no tree holds (an extension's) is in the model's elements only
    .filter((child): child is Node => !!child && isTreeKind(mapper, child.kind))
    .map((child) =>
      nodeToTree({ nodes, refinements, node: child, mapper, context, actor }),
    );

  const entry = mapper.entries.get(node.kind)!;
  const placement: Placement = {
    relation: relations[0] ?? 'none',
    children,
    isRoot,
    actor,
  };
  return mapper.shape === 'istar'
    ? istarNode(node, entry, mapper, context, placement)
    : kindNode(node, entry, mapper, context, placement);
}

/** A node's children of every kind: its goals, tasks and resources. */
const childNodes = (node: BuiltNode): BuiltNode[] => [
  ...(node.children ?? []),
  ...(node.tasks ?? []),
  ...(node.resources ?? []),
];

/**
 * Each node whose entry has an `afterCreation`, given the whole IR: its
 * engine properties as it returns them (a dependency resolved by id).
 * Updates each node in place so `allNodes.get(id)` stays the tree's own
 * object (goal-controller#233): a spread rebuild left the map on the
 * pre-afterCreation copies.
 */
function runAfterCreation(
  model: KindModel<KindProps, Naming, unknown, unknown, Shape>,
  mapper: RunMapper,
  context: CreationContext,
): KindModel<KindProps, Naming, unknown, unknown, Shape> {
  if (![...mapper.entries.values()].some((entry) => entry.afterCreation))
    return model;

  const trees = [
    ...model.actors.flatMap((actor) => actor.trees),
    ...model.dependums,
    ...model.paper,
  ] as unknown as BuiltNode[];
  // every node by id, the first of a shared one (in a tree's order)
  const allNodes = new Map<string, BuiltNode>();
  const collect = (node: BuiltNode) => {
    if (!allNodes.has(node.id)) allNodes.set(node.id, node);
    childNodes(node).forEach(collect);
  };
  trees.forEach(collect);

  // children first: a node is given its
  // children as built (and, in place, already afterCreation'd)
  const processed = (node: BuiltNode): void => {
    childNodes(node).forEach(processed);
    const after = mapper.entries.get(node.kind ?? '')?.afterCreation;
    const input = context.inputs.get(node.id);
    if (after && input) {
      node.properties.engine = after({
        node,
        input,
        allNodes: allNodes as never,
        model,
      });
    }
  };
  trees.forEach(processed);
  return model;
}

/** The IR, for a mapper as goal-tree runs it. */
function build(
  model: AnyModel,
  mapper: RunMapper,
  { dependums: withDependums = true }: { dependums?: boolean } = {},
): KindModel<KindProps, Naming, unknown, unknown, Shape> {
  // an actor by the model's own root, not iStar's (goal-controller#185)
  const isActor = isActorIn(metamodelOf(model));
  const context: CreationContext = {
    inputs: new Map(),
    reading: readingOf(model, mapper),
  };

  const iStarLinks = [...model.links.values()];
  const elements = [...model.elements.values()];
  const { byLink: refinementOfLink, hubs } = refinementsOf(
    model,
    mapper.dialect,
  );
  const refinements = [...refinementOfLink.values()];
  const treeKind = (kind: string) => isTreeKind(mapper, kind);

  const actors = elements.filter(isActor).map((actor) => {
    const nodes = childrenOf(model, actor.id);
    const roots = actorRoots(model, actor.id, mapper.dialect, {
      isTreeKind: treeKind,
      shape: mapper.shape,
    });
    const trees = roots.map((root) =>
      nodeToTree({
        nodes,
        node: root,
        refinements,
        mapper,
        context,
        isRoot: true,
        actor: actor.id,
      }),
    );
    const engine = mapper.mapActorProps?.({
      ...propsOf(
        mapper.dialect,
        { actor: actor.kind },
        actor.customProperties ?? {},
        context.reading,
      ),
      kind: actor.kind,
      id: actor.id,
      name: actor.name,
    } as never);
    return {
      id: actor.id,
      name: actor.name,
      kind: actor.kind,
      properties: { engine: engine ?? {} },
      roots: roots.map((root) => root.id),
      trees,
      elements: nodes.map((node) => node.id),
    };
  });

  const links = iStarLinks.map((link) => {
    const engine = mapper.linkMapper(link.kind)?.({
      ...propsOf(
        mapper.dialect,
        { link: link.kind },
        link.customProperties ?? {},
        context.reading,
      ),
      kind: link.kind,
      id: link.id,
    } as never);
    return {
      id: link.id,
      kind: link.kind,
      source: link.source,
      target: link.target,
      relation: refinementOfLink.get(link.id)?.relation ?? null,
      ...(link.label !== undefined && { label: link.label }),
      properties: { engine: engine ?? {} },
    };
  });

  // a dependum is in no actor and refines nothing; one with no id (its name
  // reads none) is in `elements` only
  const dependums = elements
    .filter(
      (element): element is Node =>
        withDependums &&
        element.isDependum === true &&
        treeKind(element.kind) &&
        !!readText(element as Node, mapper.dialect).id,
    )
    .map((node) =>
      nodeToTree({ nodes: [], node, refinements, mapper, context }),
    );

  // a framework without actors (goal-controller#171): its trees lie on the
  // paper, one per element of a tree kind that refines nothing (a hub is no
  // node: its legs refine its end's target)
  const onPaper = otherFrameworkOf(mapper.dialect)
    ? elements.filter(
        (element): element is Node =>
          !isActor(element) &&
          element.parent === undefined &&
          !element.isDependum &&
          !hubs.has(element.id) &&
          treeKind(element.kind),
      )
    : [];
  const children = new Set(refinements.map((refinement) => refinement.child));
  const paperRoots = onPaper.filter((node) => !children.has(node.id));
  const paper = paperRoots.map((node) =>
    nodeToTree({
      nodes: onPaper,
      node,
      refinements,
      mapper,
      context,
      isRoot: true,
    }),
  );

  // with entries, an element says what its kind is to the engine, and one
  // no tree holds has its engine properties (goal-controller#215)
  const modelElements = elements
    .filter((element) => !isActor(element))
    .map((element): ModelElement => {
      const written = {
        id: element.id,
        kind: element.kind,
        name: element.name,
        ...(element.parent !== undefined && { actor: element.parent }),
        properties: { ...element.customProperties },
      };
      const entry = mapper.entries.get(element.kind);
      if (!entry) return written;
      if (entry.tree) return { ...written, as: entry.as } as ModelElement;
      const read = readText(element as Node, mapper.dialect, {
        lenient: true,
      });
      return {
        ...written,
        as: entry.as,
        engine: entry.mapProps(
          inputOf(element as Node, mapper, read, context.reading),
        ),
      } as ModelElement;
    });

  return runAfterCreation(
    {
      actors: actors as never,
      links,
      dependums: dependums as never,
      paper: paper as never,
      roots: [
        ...actors.flatMap((actor) => actor.roots),
        ...paperRoots.map((node) => node.id),
      ],
      refinements: [...refinementOfLink.entries()].map(
        ([link, refinement]) => ({ link, ...refinement }),
      ),
      elements: modelElements,
    },
    mapper,
    context,
  );
}

/**
 * Build the typed IR of an iStar model (goal-controller#125): its actors, each
 * holding one tree per root (`actorRoots`), every link with the engine's
 * properties, the dependums, the trees on the paper (a framework without
 * actors, goal-controller#171), every root, the refinements, and every
 * element. Any shape: the caller checks the engine's (`modelShapeProblem`).
 * `dependums: false` maps none (`convertToTree`: an engine that reads the
 * trees never maps one).
 */
export function buildGoalModel<D, P, N, A, L, S extends Shape>(
  model: AnyModel,
  mapper: KindEngineMapper<D, P, N, A, L, S>,
  options?: { dependums?: boolean },
): KindModel<P, N, A, L, S>;
export function buildGoalModel(
  model: AnyModel,
  mapper: KindEngineMapper,
  options: { dependums?: boolean } = {},
): unknown {
  return build(model, runMapperOf(mapper), options);
}

/**
 * Convert an iStar model to a GoalTree with engine-specific properties: the
 * trees of its `GoalModel`, flat. Throws when the model is outside the shape
 * the engine reads (`model` on its dialect; default one actor, one root).
 */
export function convertToTree<D, P, N, A, L, S extends Shape>(
  model: AnyModel,
  mapper: KindEngineMapper<D, P, N, A, L, S>,
): Array<KindNode<P, N, S>>;
export function convertToTree(
  model: AnyModel,
  mapper: KindEngineMapper,
): unknown {
  const run = runMapperOf(mapper);
  const problem = modelShapeProblem(model, run.dialect);
  if (problem) {
    throw new Error(`[INVALID_MODEL]: ${problem}`);
  }
  const { actors, paper } = build(model, run, { dependums: false });
  return [...actors.flatMap((actor) => actor.trees), ...paper];
}
