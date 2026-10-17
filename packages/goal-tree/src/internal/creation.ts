/**
 * Internal tree creation logic
 */
import { childrenOf, isActor } from '@istar-ts/core';
import { hasIds, ISTAR_KIND_OF } from '@goal-controller/dialect';
import {
  readProperties,
  type PropertyOwner,
} from '@goal-controller/goal-language';
import { getGoalDetail } from '../parsers/goalNameParser';
import type {
  GoalExecutionDetail,
  GoalModel,
  GoalModelLink,
  GoalNode,
  GoalTree,
  Model,
  Node,
  Relation,
  Resource,
} from '../types/';
import type { BaseNode, Task, TreeNode } from '../types/goalTree';
import {
  anyMapper,
  type AnyEngineMapper,
  type EngineMapper,
  type MapperDialect,
  type NodePropertiesUnion,
  type PropsOf,
  type ResourcePropsInput,
} from './engineMapper';
import {
  actorRoots,
  modelShapeProblem,
  nodeTypeOf,
  otherFrameworkOf,
  refinementsOf,
  type Refinement,
} from './roots';
import { allByType } from './traversal';

// Re-export types from engineMapper for backwards compatibility
export { createEngineMapper } from './engineMapper';
export type { EngineMapper, NodePropertiesUnion } from './engineMapper';
export type { GoalExecutionDetail };

/** What building a node reads of a mapper: its node mappers, not the actor, link or after-creation ones. */
type NodeMapper<TGoalEngine, TTaskEngine, TResourceEngine> = Omit<
  AnyEngineMapper<TGoalEngine, TTaskEngine, TResourceEngine>,
  'afterCreationMapper' | 'mapActorProps' | 'mapLinkProps'
>;

/**
 * An element's text read in the engine's dialect. In a dialect without ids
 * (no element kind has a prefix) it is not parsed: its id is its piStar
 * id, its name its text (goal-controller#125). In a dialect of another
 * framework (goal-controller#171) a text without an id (DSM3's own files)
 * keeps its piStar id, and its text is its name.
 */
const readText = (node: Node, dialect: MapperDialect) => {
  if (dialect.elements && !hasIds({ elements: dialect.elements }))
    return { id: node.id, goalName: node.name, executionDetail: null };
  if (!otherFrameworkOf(dialect))
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
): PropsOf<never> {
  const { values, text } = readProperties(dialect, owner, customProperties);
  if ('element' in owner) return { props: values, raw: text } as PropsOf<never>;
  const raw: Record<string, string> = {};
  for (const key of ownerKeys(dialect, owner)) {
    const written = customProperties[key];
    if (written !== undefined) raw[key] = written;
  }
  return { props: values, raw } as PropsOf<never>;
}

/**
 * Context object for tree creation - avoids module-level state
 * that could cause race conditions with concurrent calls
 */
type CreationContext = {
  /** Storage for raw properties with discriminated union, used by afterCreationMapper */
  rawPropertiesMap: Map<string, NodePropertiesUnion>;
};

function createResource<TResourceEngine>(
  resource: BaseNode,
  input: ResourcePropsInput,
  mapResourceProps: (props: ResourcePropsInput) => TResourceEngine,
): Resource<TResourceEngine> {
  return {
    ...resource,
    type: 'resource',
    properties: {
      engine: mapResourceProps(input),
    },
  };
}

function convertNonGoalChildren<TGoalEngine, TTaskEngine, TResourceEngine>(
  children: Array<TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>>,
) {
  return children.reduce<{
    resources: Array<Resource<TResourceEngine>>;
    children: Array<GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>>;
    tasks: Array<Task<TTaskEngine, TResourceEngine>>;
  }>(
    (acc, child) => {
      if (child.type === 'resource') {
        return {
          ...acc,
          resources: [...acc.resources, child],
        };
      }
      if (child.type === 'task') {
        return {
          ...acc,
          tasks: [...acc.tasks, child],
        };
      }
      return { ...acc, children: [...acc.children, child] };
    },
    {
      resources: [],
      children: [],
      tasks: [],
    },
  );
}

function createNode<TGoalEngine, TTaskEngine, TResourceEngine>({
  node,
  relation,
  children,
  mapper,
  context,
  isRoot = false,
  actor,
}: {
  node: Node;
  relation: Relation;
  children: Array<TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>>;
  mapper: NodeMapper<TGoalEngine, TTaskEngine, TResourceEngine>;
  context: CreationContext;
  /** True for the actor's structurally resolved root goal. */
  isRoot?: boolean;
  /** the actor it is in (none: a dependum) */
  actor?: string;
}): TreeNode<TGoalEngine, TTaskEngine, TResourceEngine> | null {
  const { id, goalName, executionDetail } = readText(node, mapper.dialect);
  // every element the engines read is named after its RT id ("G4: …")
  if (!id) {
    throw new Error(
      `[INVALID MODEL]: "${node.name.trim()}" has no id: start its name with one, like G4: ${node.name.trim() || 'name'}`,
    );
  }

  const nodeType = nodeTypeOf(node.kind, mapper.dialect);
  if (!nodeType)
    throw new Error('[INVALID_MODEL]: Invalid node type: ' + node.kind);
  const isQualityNode = node.kind === 'istar.Quality';
  // a framework's node says what it is (goal-controller#171): its type is how a tree holds it
  const kind = otherFrameworkOf(mapper.dialect) ? { kind: node.kind } : {};
  // the properties its kind has in the dialect (goal-controller#187)
  const element = { element: dialectKindOf(node.kind, mapper.dialect) };

  if (nodeType === 'resource' && children.length > 0) {
    throw new Error(
      `[INVALID MODEL]: Resource node ${goalName} can't have children`,
    );
  }

  const { root, uniqueChoice, ...customProperties } =
    node.customProperties || {};
  const stored = { ...customProperties, root };

  const {
    resources,
    tasks,
    children: filteredChildren,
  } = convertNonGoalChildren<TGoalEngine, TTaskEngine, TResourceEngine>(
    children,
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

  if (filteredChildren.length > 0 && nodeType === 'task') {
    throw new Error(
      `[INVALID MODEL]: Task ${id}:${goalName} cannot have goal children. Tasks can only have resources and other tasks as children.`,
    );
  }

  if (nodeType === 'resource') {
    // Skip resource if skipResource is true
    if (mapper.skipResource === true) {
      return null;
    }

    const props = propsOf(mapper.dialect, element, stored);

    // Store properties for afterCreationMapper
    context.rawPropertiesMap.set(id, {
      nodeType: 'resource',
      kind: node.kind,
      ...props,
    });

    // its strings stay on the node, as they always have
    const resourceNode: BaseNode & {
      rawProps: Readonly<Record<string, string>>;
    } = {
      id,
      ...kind,
      name: goalName,
      iStarId: node.id,
      x: node.x,
      ...(actor !== undefined && { actor }),
      relationToChildren: relation,
      type: 'resource',
      rawProps: props.raw,
    };
    return createResource(
      resourceNode,
      { ...props, id },
      mapper.mapResourceProps!,
    );
  }

  if (nodeType === 'task') {
    const props = propsOf(mapper.dialect, element, stored);

    // Store properties for afterCreationMapper
    context.rawPropertiesMap.set(id, {
      nodeType: 'task',
      kind: node.kind,
      ...props,
    });

    const taskNode: Task<TTaskEngine, TResourceEngine> = {
      id,
      ...kind,
      name: goalName,
      iStarId: node.id,
      x: node.x,
      ...(actor !== undefined && { actor }),
      relationToChildren: relation,
      type: 'task',
      tasks,
      resources,
      properties: {
        engine: mapper.mapTaskProps({
          ...props,
          name: goalName,
          id,
          text: node.name,
          kind: node.kind,
        }),
      },
    };
    return taskNode;
  }

  if (nodeType === 'goal') {
    // Qualities still map as goals (isQuality), with their kind's properties
    const props = propsOf(mapper.dialect, element, stored);

    // Store properties for afterCreationMapper
    context.rawPropertiesMap.set(id, {
      nodeType: 'goal',
      kind: node.kind,
      ...props,
    });

    const goalNode: GoalNode<TGoalEngine, TTaskEngine, TResourceEngine> = {
      id,
      ...kind,
      name: goalName,
      iStarId: node.id,
      x: node.x,
      ...(actor !== undefined && { actor }),
      relationToChildren: relation,
      type: 'goal',
      children: filteredChildren,
      properties: {
        ...(isRoot && { root: true }),
        isQuality: isQualityNode,
        engine: mapper.mapGoalProps({
          ...props,
          executionDetail,
          id,
          text: node.name,
          kind: node.kind,
        }),
      },
      ...(tasks.length > 0 && { tasks }),
    };
    return goalNode;
  }

  throw new Error(
    `[INVALID_MODEL]: Unsupported node type: ${nodeType as string}`,
  );
}

function nodeChildren<TGoalEngine, TTaskEngine, TResourceEngine>({
  nodes,
  id,
  refinements,
  mapper,
  context,
  actor,
}: {
  nodes: readonly Node[];
  /** the model's refinements, in its links' order (`refinementsOf`) */
  refinements: readonly Refinement[];
  id?: string;
  actor?: string;
  mapper: NodeMapper<TGoalEngine, TTaskEngine, TResourceEngine>;
  context: CreationContext;
}): [Array<TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>>, Relation] {
  if (!id) {
    return [[], 'none'];
  }

  // the refinements into it: its children (goal-controller#125: any other
  // link into it, a qualification, a contribution, a dependency, an
  // extension's, is one of the model's links, not a child)
  const nodeLinks = refinements.filter(
    (refinement) => refinement.parent === id,
  );

  const relations = nodeLinks.map((refinement) => refinement.relation);

  const allEqual = relations.every((v) => v === relations[0]);
  if (!allEqual) {
    throw new Error(`
            [INVALID MODEL]: You can't mix and/or relations
        `);
  }

  const children = nodeLinks
    .map(
      ({
        child: childNodeId,
      }): TreeNode<TGoalEngine, TTaskEngine, TResourceEngine> | undefined => {
        const node = nodes.find((item) => item.id === childNodeId);
        // a kind no tree holds (an extension's) is in the model's elements only
        if (!node || !nodeTypeOf(node.kind, mapper.dialect)) {
          return undefined;
        }

        const [granChildren, relation] = nodeChildren({
          nodes,
          id: node.id,
          refinements,
          mapper,
          context,
          actor,
        });

        // createNode returns null for skipped resources
        const createdNode = createNode({
          node,
          relation,
          children: granChildren,
          mapper,
          context,
          actor,
        });

        return createdNode ?? undefined;
      },
    )
    .filter(
      (n): n is TreeNode<TGoalEngine, TTaskEngine, TResourceEngine> => !!n,
    );

  return [children, relations[0] ?? 'none'];
}

function nodeToTree<TGoalEngine, TTaskEngine, TResourceEngine>({
  nodes,
  refinements,
  node,
  mapper,
  context,
  isRoot = false,
  actor,
}: {
  nodes: readonly Node[];
  refinements: readonly Refinement[];
  node: Node;
  mapper: NodeMapper<TGoalEngine, TTaskEngine, TResourceEngine>;
  context: CreationContext;
  isRoot?: boolean;
  actor?: string;
}): TreeNode<TGoalEngine, TTaskEngine, TResourceEngine> | null {
  const [children, relation] = nodeChildren({
    nodes,
    id: node.id,
    refinements,
    mapper,
    context,
    actor,
  });

  return createNode({
    node,
    children,
    relation,
    mapper,
    context,
    isRoot,
    actor,
  });
}

type FullMapper<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine,
  TActorEngine,
  TLinkEngine,
> = AnyEngineMapper<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine,
  TActorEngine,
  TLinkEngine
>;

function runAfterCreationMapper<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine,
  TActorEngine,
  TLinkEngine,
>(
  model: GoalModel<
    TGoalEngine,
    TTaskEngine,
    TResourceEngine,
    TActorEngine,
    TLinkEngine
  >,
  mapper: FullMapper<
    TGoalEngine,
    TTaskEngine,
    TResourceEngine,
    TActorEngine,
    TLinkEngine
  >,
  context: CreationContext,
): GoalModel<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine,
  TActorEngine,
  TLinkEngine
> {
  const { afterCreationMapper } = mapper;
  // If no afterCreationMapper is provided, return the model as-is
  if (!afterCreationMapper) {
    return model;
  }

  const everyTree = [
    ...model.actors.flatMap((actor) => actor.trees),
    ...model.dependums,
    ...model.paper,
  ];
  const nodeMap = new Map<
    string,
    TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>
  >();
  [
    ...allByType(everyTree, 'goal'),
    ...allByType(everyTree, 'task'),
    ...allByType(everyTree, 'resource'),
  ].forEach((node) => {
    nodeMap.set(node.id, node);
  });

  const processGoal = (
    goal: GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>,
  ): GoalNode<TGoalEngine, TTaskEngine, TResourceEngine> => {
    // Get raw properties - discriminated union with nodeType: 'goal' | 'task' | 'resource'
    const defaultRawProperties: NodePropertiesUnion = {
      nodeType: 'goal',
      kind: goal.kind ?? 'istar.Goal',
      props: {},
      raw: {},
    };
    const rawProperties =
      context.rawPropertiesMap.get(goal.id) ?? defaultRawProperties;

    const resolvedChildren = goal.children?.map(processGoal);

    // Call afterCreationMapper to transform engine props
    // Validate that rawProperties.nodeType matches the node type before casting
    if (rawProperties.nodeType !== 'goal') {
      // If this happens, just return the original engine
      // This should not occur in practice, but provides safety
      return {
        ...goal,
        properties: {
          ...goal.properties,
        },
        ...(resolvedChildren && { children: resolvedChildren }),
      };
    }

    const updatedEngine = afterCreationMapper({
      node: goal,
      allNodes: nodeMap,
      rawProperties,
      model,
    });

    // Runtime validation before type assertion
    if (typeof updatedEngine !== 'object' || updatedEngine === null) {
      throw new Error(
        `[INVALID_MAPPER]: afterCreationMapper for goal ${goal.id} must return an object`,
      );
    }

    return {
      ...goal,
      properties: {
        ...goal.properties,
        engine: updatedEngine as TGoalEngine,
      },
      ...(resolvedChildren && { children: resolvedChildren }),
    };
  };

  // Process only goal nodes (top-level nodes in tree are goals)
  const processTrees = (
    trees: Array<TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>>,
  ) => trees.map((node) => (node.type === 'goal' ? processGoal(node) : node));

  return {
    ...model,
    actors: model.actors.map((actor) => ({
      ...actor,
      trees: processTrees(actor.trees),
    })),
    dependums: processTrees(model.dependums),
    paper: processTrees(model.paper),
  };
}

/**
 * Build the typed IR of an iStar model (goal-controller#125): its actors, each
 * holding one tree per root (`actorRoots`), every link with the engine's
 * properties, the dependums, the trees on the paper (a framework without
 * actors, goal-controller#171), and every element as written. Any shape: the
 * caller checks the engine's (`modelShapeProblem`). `dependums: false`
 * maps none (`convertToTree`: an engine that reads the trees never maps one).
 */
export function buildGoalModel<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine,
  TDialect extends MapperDialect = MapperDialect,
  TActorEngine = {},
  TLinkEngine = {},
>(
  model: Model,
  typed: EngineMapper<
    TGoalEngine,
    TTaskEngine,
    TResourceEngine,
    TDialect,
    TActorEngine,
    TLinkEngine
  >,
  { dependums: withDependums = true }: { dependums?: boolean } = {},
): GoalModel<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine,
  TActorEngine,
  TLinkEngine
> {
  const mapper = anyMapper(typed);
  // Create per-call context to avoid race conditions with concurrent calls
  const context: CreationContext = {
    rawPropertiesMap: new Map(),
  };
  const isTree = (
    node: TreeNode<TGoalEngine, TTaskEngine, TResourceEngine> | null,
  ): node is TreeNode<TGoalEngine, TTaskEngine, TResourceEngine> =>
    node !== null;

  const iStarLinks = [...model.links.values()];
  const elements = [...model.elements.values()];
  const { byLink: refinementOfLink, hubs } = refinementsOf(
    model,
    mapper.dialect,
  );
  const refinements = [...refinementOfLink.values()];

  const actors = elements.filter(isActor).map((actor) => {
    const nodes = childrenOf(model, actor.id);
    const trees = actorRoots(model, actor.id, mapper.dialect)
      .map((root) =>
        nodeToTree({
          nodes,
          node: root,
          refinements,
          mapper,
          context,
          isRoot: true,
          actor: actor.id,
        }),
      )
      .filter(isTree);
    const engine = mapper.mapActorProps?.({
      ...propsOf(
        mapper.dialect,
        { actor: actor.kind },
        actor.customProperties ?? {},
      ),
      kind: actor.kind,
      id: actor.id,
      name: actor.name,
    });
    return {
      id: actor.id,
      name: actor.name,
      kind: actor.kind,
      properties: { engine: (engine ?? {}) as TActorEngine },
      trees,
      elements: nodes.map((node) => node.id),
    };
  });

  const links = iStarLinks.map((link): GoalModelLink<TLinkEngine> => {
    const engine = mapper.mapLinkProps?.({
      ...propsOf(
        mapper.dialect,
        { link: link.kind },
        link.customProperties ?? {},
      ),
      kind: link.kind,
      id: link.id,
    });
    return {
      id: link.id,
      kind: link.kind,
      source: link.source,
      target: link.target,
      relation: refinementOfLink.get(link.id)?.relation ?? null,
      ...(link.label !== undefined && { label: link.label }),
      properties: { engine: (engine ?? {}) as TLinkEngine },
    };
  });

  // a dependum is in no actor and refines nothing; one with no id (its name
  // reads none) is in `elements` only
  const dependums = elements
    .filter(
      (element): element is Node =>
        withDependums &&
        element.isDependum === true &&
        nodeTypeOf(element.kind, mapper.dialect) !== null &&
        !!readText(element as Node, mapper.dialect).id,
    )
    .map((node) =>
      nodeToTree({ nodes: [], node, refinements, mapper, context }),
    )
    .filter(isTree);

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
          nodeTypeOf(element.kind, mapper.dialect) !== null,
      )
    : [];
  const children = new Set(refinements.map((refinement) => refinement.child));
  const paper = onPaper
    .filter((node) => !children.has(node.id))
    .map((node) =>
      nodeToTree({
        nodes: onPaper,
        node,
        refinements,
        mapper,
        context,
        isRoot: true,
      }),
    )
    .filter(isTree);

  return runAfterCreationMapper(
    {
      actors,
      links,
      dependums,
      paper,
      elements: elements
        .filter((element) => !isActor(element))
        .map((element) => ({
          id: element.id,
          kind: element.kind,
          name: element.name,
          ...(element.parent !== undefined && { actor: element.parent }),
          properties: { ...element.customProperties },
        })),
    },
    mapper,
    context,
  );
}

/**
 * Convert an iStar model to a GoalTree with engine-specific properties: the
 * trees of its `GoalModel`, flat. Throws when the model is outside the shape
 * the engine reads (`model` on its dialect; default one actor, one root).
 */
export function convertToTree<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine,
  TDialect extends MapperDialect = MapperDialect,
  TActorEngine = {},
  TLinkEngine = {},
>(
  model: Model,
  typed: EngineMapper<
    TGoalEngine,
    TTaskEngine,
    TResourceEngine,
    TDialect,
    TActorEngine,
    TLinkEngine
  >,
): GoalTree<TGoalEngine, TTaskEngine, TResourceEngine> {
  const mapper = anyMapper(typed);
  const problem = modelShapeProblem(model, mapper.dialect);
  if (problem) {
    throw new Error(`[INVALID_MODEL]: ${problem}`);
  }
  const { actors, paper } = buildGoalModel(model, typed, {
    dependums: false,
  });
  return [...actors.flatMap((actor) => actor.trees), ...paper];
}
