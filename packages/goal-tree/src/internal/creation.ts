/**
 * Internal tree creation logic
 */
import { childrenOf, isActor, type ElementKind } from '@istar-ts/core';
import { hasIds } from '@goal-controller/dialect';
import { getGoalDetail } from '../parsers/goalNameParser';
import type {
  GoalExecutionDetail,
  GoalModel,
  GoalModelLink,
  GoalNode,
  GoalTree,
  Link,
  Model,
  Node,
  Relation,
  Resource,
} from '../types/';
import type { BaseNode, Task, TreeNode } from '../types/goalTree';
import type {
  EngineMapper,
  MapperDialect,
  RawPropertiesUnion,
  RawProps,
} from './engineMapper';
import {
  actorRoots,
  linkEnds,
  linkRelation,
  modelShapeProblem,
  TREE_KINDS,
} from './roots';
import { allByType } from './traversal';

// Re-export types from engineMapper for backwards compatibility
export { createEngineMapper } from './engineMapper';
export type {
  EngineMapper,
  RawPropertiesUnion,
  RawProps,
} from './engineMapper';
export type { GoalExecutionDetail };

/** Omit over each member of a union (EngineMapper is one, on `skipResource`). */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

/** What building a node reads of a mapper: its node mappers, not the actor, link or after-creation ones. */
type NodeMapper<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine,
  TGoalKeys extends string,
  TTaskKeys extends string,
  TResourceKeys extends string,
  TQualityKeys extends string,
> = DistributiveOmit<
  EngineMapper<
    TGoalEngine,
    TTaskEngine,
    TResourceEngine,
    TGoalKeys,
    TTaskKeys,
    TResourceKeys,
    TQualityKeys
  >,
  | 'afterCreationMapper'
  | 'allowedActorKeys'
  | 'mapActorProps'
  | 'allowedLinkKeys'
  | 'mapLinkProps'
>;

const convertIstarType = ({ kind }: { kind: ElementKind }) => {
  switch (kind) {
    case 'istar.Goal':
      return 'goal';
    case 'istar.Task':
      return 'task';
    case 'istar.Resource':
      return 'resource';
    case 'istar.Quality':
      return 'goal';
    default:
      throw new Error('[INVALID_MODEL]: Invalid node type: ' + kind);
  }
};

/**
 * An element's text read in the engine's dialect. In a dialect without ids
 * (no element kind has a prefix) it is not parsed: its id is its piStar
 * id, its name its text (goal-controller#125).
 */
const readText = (node: Node, dialect: MapperDialect) =>
  dialect.elements && !hasIds({ elements: dialect.elements })
    ? { id: node.id, goalName: node.name, executionDetail: null }
    : getGoalDetail({ goalText: node.name, dialect });

/**
 * Extract raw properties from customProperties based on allowed keys
 * Only includes keys that are in the allowedKeys array
 */
function extractRawProps<TKeys extends string>(
  customProperties: Record<string, string | undefined>,
  allowedKeys: readonly TKeys[],
): RawProps<TKeys> {
  const result: Partial<Record<TKeys, string>> = {};
  for (const key of allowedKeys) {
    const value = customProperties[key];
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Context object for tree creation - avoids module-level state
 * that could cause race conditions with concurrent calls
 */
type CreationContext<
  TGoalKeys extends string,
  TTaskKeys extends string,
  TResourceKeys extends string,
> = {
  /** Storage for raw properties with discriminated union, used by afterCreationMapper */
  rawPropertiesMap: Map<
    string,
    RawPropertiesUnion<TGoalKeys, TTaskKeys, TResourceKeys>
  >;
};

function createResource<TResourceEngine, TResourceKeys extends string>(
  resource: BaseNode & { rawProps: RawProps<TResourceKeys> },
  mapResourceProps: (props: {
    raw: RawProps<TResourceKeys>;
    id: string;
  }) => TResourceEngine,
): Resource<TResourceEngine> {
  return {
    ...resource,
    type: 'resource',
    properties: {
      engine: mapResourceProps({ raw: resource.rawProps, id: resource.id }),
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

function createNode<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine,
  TGoalKeys extends string,
  TTaskKeys extends string,
  TResourceKeys extends string,
  TQualityKeys extends string,
>({
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
  mapper: NodeMapper<
    TGoalEngine,
    TTaskEngine,
    TResourceEngine,
    TGoalKeys,
    TTaskKeys,
    TResourceKeys,
    TQualityKeys
  >;
  context: CreationContext<TGoalKeys, TTaskKeys, TResourceKeys>;
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

  const nodeType = convertIstarType({ kind: node.kind });
  const isQualityNode = node.kind === 'istar.Quality';

  if (nodeType === 'resource' && children.length > 0) {
    throw new Error(
      `[INVALID MODEL]: Resource node ${goalName} can't have children`,
    );
  }

  const { root, uniqueChoice, ...customProperties } =
    node.customProperties || {};

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

    // Extract raw props using allowed keys from mapper
    const rawResourceProps = extractRawProps(
      { ...customProperties, root },
      mapper.allowedResourceKeys,
    );

    // Store raw properties for afterCreationMapper
    context.rawPropertiesMap.set(id, {
      nodeType: 'resource',
      raw: rawResourceProps,
    });

    const resourceNode: BaseNode & { rawProps: RawProps<TResourceKeys> } = {
      id,
      name: goalName,
      iStarId: node.id,
      x: node.x,
      ...(actor !== undefined && { actor }),
      relationToChildren: relation,
      type: 'resource',
      rawProps: rawResourceProps,
    };
    return createResource(resourceNode, mapper.mapResourceProps);
  }

  if (nodeType === 'task') {
    // Extract raw props using allowed keys from mapper
    const rawTaskProps = extractRawProps(
      { ...customProperties, root },
      mapper.allowedTaskKeys,
    );

    // Store raw properties for afterCreationMapper
    context.rawPropertiesMap.set(id, { nodeType: 'task', raw: rawTaskProps });

    const taskNode: Task<TTaskEngine, TResourceEngine> = {
      id,
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
          raw: rawTaskProps,
          name: goalName,
          id,
          text: node.name,
        }),
      },
    };
    return taskNode;
  }

  if (nodeType === 'goal') {
    // Qualities still map as goals (isQuality); only which raw keys are read differs
    const allowedKeys: readonly (TGoalKeys | TQualityKeys)[] = isQualityNode
      ? (mapper.allowedQualityKeys ?? [])
      : mapper.allowedGoalKeys;
    const rawGoalProps = extractRawProps(
      { ...customProperties, root },
      allowedKeys,
    );

    // Store raw properties for afterCreationMapper
    context.rawPropertiesMap.set(id, {
      nodeType: 'goal',
      raw: rawGoalProps as RawProps<TGoalKeys>,
    });

    const goalNode: GoalNode<TGoalEngine, TTaskEngine, TResourceEngine> = {
      id,
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
          raw: rawGoalProps,
          executionDetail,
          id,
          text: node.name,
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

function nodeChildren<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine,
  TGoalKeys extends string,
  TTaskKeys extends string,
  TResourceKeys extends string,
  TQualityKeys extends string,
>({
  nodes,
  id,
  links,
  mapper,
  context,
  actor,
}: {
  nodes: readonly Node[];
  links: readonly Link[];
  id?: string;
  actor?: string;
  mapper: NodeMapper<
    TGoalEngine,
    TTaskEngine,
    TResourceEngine,
    TGoalKeys,
    TTaskKeys,
    TResourceKeys,
    TQualityKeys
  >;
  context: CreationContext<TGoalKeys, TTaskKeys, TResourceKeys>;
}): [Array<TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>>, Relation] {
  if (!id) {
    return [[], 'none'];
  }

  // the refinements into it: its children (goal-controller#125: any other
  // link into it, a qualification, a contribution, a dependency, an
  // extension's, is one of the model's links, not a child)
  const nodeLinks = links.filter(
    (link) => link.target === id && linkRelation(link) !== null,
  );

  const relations = nodeLinks.map((link) => linkRelation(link)!);

  const allEqual = relations.every((v) => v === relations[0]);
  if (!allEqual) {
    throw new Error(`
            [INVALID MODEL]: You can't mix and/or relations
        `);
  }

  const children = nodeLinks
    .map(
      (
        link,
      ): TreeNode<TGoalEngine, TTaskEngine, TResourceEngine> | undefined => {
        const [, childNodeId] = linkEnds(link);

        const node = nodes.find((item) => item.id === childNodeId);
        // a kind no tree holds (an extension's) is in the model's elements only
        if (!node || !TREE_KINDS.has(node.kind)) {
          return undefined;
        }

        const [granChildren, relation] = nodeChildren({
          nodes,
          id: node.id,
          links,
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

function nodeToTree<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine,
  TGoalKeys extends string,
  TTaskKeys extends string,
  TResourceKeys extends string,
  TQualityKeys extends string,
>({
  nodes,
  iStarLinks,
  node,
  mapper,
  context,
  isRoot = false,
  actor,
}: {
  nodes: readonly Node[];
  iStarLinks: readonly Link[];
  node: Node;
  mapper: NodeMapper<
    TGoalEngine,
    TTaskEngine,
    TResourceEngine,
    TGoalKeys,
    TTaskKeys,
    TResourceKeys,
    TQualityKeys
  >;
  context: CreationContext<TGoalKeys, TTaskKeys, TResourceKeys>;
  isRoot?: boolean;
  actor?: string;
}): TreeNode<TGoalEngine, TTaskEngine, TResourceEngine> | null {
  const [children, relation] = nodeChildren({
    nodes,
    id: node.id,
    links: iStarLinks,
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
  TGoalKeys extends string,
  TTaskKeys extends string,
  TResourceKeys extends string,
  TQualityKeys extends string,
  TActorEngine,
  TLinkEngine,
  TActorKeys extends string,
  TLinkKeys extends string,
> = EngineMapper<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine,
  TGoalKeys,
  TTaskKeys,
  TResourceKeys,
  TQualityKeys,
  TActorEngine,
  TLinkEngine,
  TActorKeys,
  TLinkKeys
>;

function runAfterCreationMapper<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine,
  TGoalKeys extends string,
  TTaskKeys extends string,
  TResourceKeys extends string,
  TQualityKeys extends string,
  TActorEngine,
  TLinkEngine,
  TActorKeys extends string,
  TLinkKeys extends string,
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
    TGoalKeys,
    TTaskKeys,
    TResourceKeys,
    TQualityKeys,
    TActorEngine,
    TLinkEngine,
    TActorKeys,
    TLinkKeys
  >,
  context: CreationContext<TGoalKeys, TTaskKeys, TResourceKeys>,
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
    const defaultRawProperties: RawPropertiesUnion<
      TGoalKeys,
      TTaskKeys,
      TResourceKeys
    > = {
      nodeType: 'goal',
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
  };
}

/**
 * Build the typed IR of an iStar model (goal-controller#125): its actors, each
 * holding one tree per root (`actorRoots`), every link with the engine's
 * properties, the dependums, and every element as written. Any shape: the
 * caller checks the engine's (`modelShapeProblem`). `dependums: false`
 * maps none (`convertToTree`: an engine that reads the trees never maps one).
 */
export function buildGoalModel<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine,
  TGoalKeys extends string = string,
  TTaskKeys extends string = string,
  TResourceKeys extends string = string,
  TQualityKeys extends string = never,
  TActorEngine = {},
  TLinkEngine = {},
  TActorKeys extends string = never,
  TLinkKeys extends string = never,
>(
  model: Model,
  mapper: FullMapper<
    TGoalEngine,
    TTaskEngine,
    TResourceEngine,
    TGoalKeys,
    TTaskKeys,
    TResourceKeys,
    TQualityKeys,
    TActorEngine,
    TLinkEngine,
    TActorKeys,
    TLinkKeys
  >,
  { dependums: withDependums = true }: { dependums?: boolean } = {},
): GoalModel<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine,
  TActorEngine,
  TLinkEngine
> {
  // Create per-call context to avoid race conditions with concurrent calls
  const context: CreationContext<TGoalKeys, TTaskKeys, TResourceKeys> = {
    rawPropertiesMap: new Map(),
  };
  const isTree = (
    node: TreeNode<TGoalEngine, TTaskEngine, TResourceEngine> | null,
  ): node is TreeNode<TGoalEngine, TTaskEngine, TResourceEngine> =>
    node !== null;

  const iStarLinks = [...model.links.values()];
  const elements = [...model.elements.values()];

  const actors = elements.filter(isActor).map((actor) => {
    const nodes = childrenOf(model, actor.id);
    const trees = actorRoots(model, actor.id, mapper.dialect)
      .map((root) =>
        nodeToTree({
          nodes,
          node: root,
          iStarLinks,
          mapper,
          context,
          isRoot: true,
          actor: actor.id,
        }),
      )
      .filter(isTree);
    const engine = mapper.mapActorProps?.({
      raw: extractRawProps(
        actor.customProperties ?? {},
        mapper.allowedActorKeys ?? [],
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
      raw: extractRawProps(
        link.customProperties ?? {},
        mapper.allowedLinkKeys ?? [],
      ),
      kind: link.kind,
      id: link.id,
    });
    return {
      id: link.id,
      kind: link.kind,
      source: link.source,
      target: link.target,
      relation: linkRelation(link),
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
        TREE_KINDS.has(element.kind) &&
        !!readText(element as Node, mapper.dialect).id,
    )
    .map((node) => nodeToTree({ nodes: [], node, iStarLinks, mapper, context }))
    .filter(isTree);

  return runAfterCreationMapper(
    {
      actors,
      links,
      dependums,
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
  TGoalKeys extends string = string,
  TTaskKeys extends string = string,
  TResourceKeys extends string = string,
  TQualityKeys extends string = never,
  TActorEngine = {},
  TLinkEngine = {},
  TActorKeys extends string = never,
  TLinkKeys extends string = never,
>(
  model: Model,
  mapper: FullMapper<
    TGoalEngine,
    TTaskEngine,
    TResourceEngine,
    TGoalKeys,
    TTaskKeys,
    TResourceKeys,
    TQualityKeys,
    TActorEngine,
    TLinkEngine,
    TActorKeys,
    TLinkKeys
  >,
): GoalTree<TGoalEngine, TTaskEngine, TResourceEngine> {
  const problem = modelShapeProblem(model, mapper.dialect);
  if (problem) {
    throw new Error(`[INVALID_MODEL]: ${problem}`);
  }
  return buildGoalModel(model, mapper, { dependums: false }).actors.flatMap(
    (actor) => actor.trees,
  );
}
