/**
 * Internal tree creation logic
 */
import { getGoalDetail } from '../parsers/goalNameParser';
import type {
  Actor,
  GoalExecutionDetail,
  GoalNode,
  GoalTree,
  Link,
  Model,
  Node,
  NodeType,
  Relation,
  Resource,
} from '../types/';
import type { BaseNode, Task, TreeNode } from '../types/goalTree';
import { allByType } from './traversal';

/**
 * Raw custom properties extracted from the iStar model
 * Generic type that creates a Record of allowed keys to optional string values
 */
export type RawProps<TKeys extends string> = Partial<Record<TKeys, string>>;

/**
 * Discriminated union for raw properties in afterCreationMapper
 * Allows the hook to handle goals, tasks, and resources with type-safe access
 */
export type RawPropertiesUnion<
  TGoalKeys extends string,
  TTaskKeys extends string,
  TResourceKeys extends string,
> =
  | { type: 'goal'; raw: RawProps<TGoalKeys> }
  | { type: 'task'; raw: RawProps<TTaskKeys> }
  | { type: 'resource'; raw: RawProps<TResourceKeys> };

export type { GoalExecutionDetail };

/**
 * Resource mapper configuration - discriminated union
 * Either skip resources entirely, or provide a mapper function
 */
type ResourceMapperConfig<TResourceEngine, TResourceKeys extends string> =
  | {
      skipResource: true;
      mapResourceProps?: never;
      allowedResourceKeys?: never;
    }
  | {
      skipResource?: false;
      mapResourceProps: (props: {
        raw: RawProps<TResourceKeys>;
      }) => TResourceEngine;
      allowedResourceKeys: readonly TResourceKeys[];
    };

/**
 * Engine mapper interface for creating engine-specific properties
 * TGoalKeys, TTaskKeys, TResourceKeys define which custom properties are extracted
 */
export type EngineMapper<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine = unknown,
  TGoalKeys extends string = string,
  TTaskKeys extends string = string,
  TResourceKeys extends string = string,
> = {
  /**
   * Allowed keys for goal custom properties
   */
  allowedGoalKeys: readonly TGoalKeys[];

  /**
   * Allowed keys for task custom properties
   */
  allowedTaskKeys: readonly TTaskKeys[];

  /**
   * Map raw goal properties to engine-specific goal properties
   */
  mapGoalProps: (props: {
    raw: RawProps<TGoalKeys>;
    executionDetail: GoalExecutionDetail | null;
  }) => TGoalEngine;

  /**
   * Map raw task properties to engine-specific task properties
   */
  mapTaskProps: (props: { raw: RawProps<TTaskKeys> }) => TTaskEngine;

  /**
   * Optional: Transform props after tree is created (e.g., resolve dependsOn)
   * Called for each node after the full tree is built
   * rawProperties is a discriminated union with type: 'goal' | 'task' | 'resource'
   */
  afterCreationMapper?: (props: {
    node: TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>;
    allNodes: Map<string, TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>>;
    rawProperties: RawPropertiesUnion<TGoalKeys, TTaskKeys, TResourceKeys>;
  }) => TGoalEngine | TTaskEngine | TResourceEngine;
} & ResourceMapperConfig<TResourceEngine, TResourceKeys>;

/**
 * Curried helper to create an engine mapper with full type inference.
 * First call provides the keys (inferring key types), second call provides the mappers.
 *
 * @example
 * const mapper = createEngineMapper({
 *   allowedGoalKeys: ['utility', 'cost'] as const,
 *   allowedTaskKeys: ['maxRetries'] as const,
 *   allowedResourceKeys: ['type', 'value'] as const,
 * })({
 *   mapGoalProps: ({ raw }) => ({ utility: raw.utility }), // raw is typed!
 *   mapTaskProps: ({ raw }) => ({ retries: raw.maxRetries }),
 *   mapResourceProps: ({ raw }) => ({ type: raw.type }),
 * });
 */
export function createEngineMapper<
  TGoalKeys extends string,
  TTaskKeys extends string,
  TResourceKeys extends string = never,
>(
  keys: {
    allowedGoalKeys: readonly TGoalKeys[];
    allowedTaskKeys: readonly TTaskKeys[];
  } & (
    | { allowedResourceKeys: readonly TResourceKeys[]; skipResource?: false }
    | { allowedResourceKeys?: undefined; skipResource: true }
  ),
) {
  return <TGoalEngine, TTaskEngine, TResourceEngine = never>(
    mappers: {
      mapGoalProps: (props: {
        raw: RawProps<TGoalKeys>;
        executionDetail: GoalExecutionDetail | null;
      }) => TGoalEngine;
      mapTaskProps: (props: { raw: RawProps<TTaskKeys> }) => TTaskEngine;
      afterCreationMapper?: (props: {
        node: TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>;
        allNodes: Map<
          string,
          TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>
        >;
        rawProperties: RawPropertiesUnion<TGoalKeys, TTaskKeys, TResourceKeys>;
      }) => TGoalEngine | TTaskEngine | TResourceEngine;
    } & (
      | {
          mapResourceProps: (props: {
            raw: RawProps<TResourceKeys>;
          }) => TResourceEngine;
        }
      | { mapResourceProps?: never }
    ),
  ): EngineMapper<
    TGoalEngine,
    TTaskEngine,
    TResourceEngine,
    TGoalKeys,
    TTaskKeys,
    TResourceKeys
  > => {
    const skipResource = keys.allowedResourceKeys === undefined;
    if (skipResource || !mappers.mapResourceProps) {
      const result: EngineMapper<
        TGoalEngine,
        TTaskEngine,
        TResourceEngine,
        TGoalKeys,
        TTaskKeys,
        TResourceKeys
      > = {
        ...keys,
        ...mappers,
        skipResource: true,
        mapResourceProps: undefined,
        allowedResourceKeys: undefined,
      };
      return result;
    }
    const result: EngineMapper<
      TGoalEngine,
      TTaskEngine,
      TResourceEngine,
      TGoalKeys,
      TTaskKeys,
      TResourceKeys
    > = {
      ...keys,
      ...mappers,
      mapResourceProps: mappers.mapResourceProps,
    };
    return result;
  };
}

const convertIstarType = ({ type }: { type: NodeType }) => {
  switch (type) {
    case 'istar.Goal':
      return 'goal';
    case 'istar.Task':
      return 'task';
    case 'istar.Resource':
      return 'resource';
    case 'istar.Quality':
      return 'goal';
    default:
      throw new Error('Invalid node type: ' + type);
  }
};

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
  }) => TResourceEngine,
): Resource<TResourceEngine> {
  return {
    ...resource,
    type: 'resource',
    properties: {
      engine: mapResourceProps({ raw: resource.rawProps }),
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
>({
  node,
  relation,
  children,
  mapper,
  context,
}: {
  node: Node;
  relation: Relation;
  children: Array<TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>>;
  mapper: EngineMapper<
    TGoalEngine,
    TTaskEngine,
    TResourceEngine,
    TGoalKeys,
    TTaskKeys,
    TResourceKeys
  >;
  context: CreationContext<TGoalKeys, TTaskKeys, TResourceKeys>;
}): TreeNode<TGoalEngine, TTaskEngine, TResourceEngine> | null {
  const { id, goalName, executionDetail } = getGoalDetail({
    goalText: node.text,
  });

  const nodeType = convertIstarType({ type: node.type });
  const isQualityNode = node.type === 'istar.Quality';

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
    !isQualityNode
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
      type: 'resource',
      raw: rawResourceProps,
    });

    const resourceNode: BaseNode & { rawProps: RawProps<TResourceKeys> } = {
      id,
      name: goalName,
      iStarId: node.id,
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
    context.rawPropertiesMap.set(id, { type: 'task', raw: rawTaskProps });

    const taskNode: Task<TTaskEngine, TResourceEngine> = {
      id,
      name: goalName,
      iStarId: node.id,
      relationToChildren: relation,
      type: 'task',
      tasks,
      resources,
      properties: {
        engine: mapper.mapTaskProps({ raw: rawTaskProps }),
      },
    };
    return taskNode;
  }

  if (nodeType === 'goal') {
    // Extract raw props using allowed keys from mapper
    const rawGoalProps = extractRawProps(
      { ...customProperties, root },
      mapper.allowedGoalKeys,
    );

    // Store raw properties for afterCreationMapper
    context.rawPropertiesMap.set(id, { type: 'goal', raw: rawGoalProps });

    const goalNode: GoalNode<TGoalEngine, TTaskEngine, TResourceEngine> = {
      id,
      name: goalName,
      iStarId: node.id,
      relationToChildren: relation,
      type: 'goal',
      children: filteredChildren,
      properties: {
        ...(root?.toLowerCase() === 'true' && { root: true }),
        isQuality: isQualityNode,
        engine: mapper.mapGoalProps({
          raw: rawGoalProps,
          executionDetail,
        }),
      },
      ...(tasks.length > 0 && { tasks }),
    };
    return goalNode;
  }

  throw new Error(
    `[INVALID NODE TYPE]: Unsupported node type: ${nodeType as string}`,
  );
}

function nodeChildren<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine,
  TGoalKeys extends string,
  TTaskKeys extends string,
  TResourceKeys extends string,
>({
  actor,
  id,
  links,
  mapper,
  context,
}: {
  actor: Actor;
  links: Link[];
  id?: string;
  mapper: EngineMapper<
    TGoalEngine,
    TTaskEngine,
    TResourceEngine,
    TGoalKeys,
    TTaskKeys,
    TResourceKeys
  >;
  context: CreationContext<TGoalKeys, TTaskKeys, TResourceKeys>;
}): [Array<TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>>, Relation] {
  if (!id) {
    return [[], 'none'];
  }

  const incomingLinks = links.filter(
    (link) => link.target === id && link.type !== 'istar.QualificationLink',
  );

  const outgoingQualificationLinks = links.filter(
    (link) => link.type === 'istar.QualificationLink' && link.source === id,
  );

  const nodeLinks = [...incomingLinks, ...outgoingQualificationLinks];

  const relations = nodeLinks.map((link: { type: Link['type'] | string }) => {
    switch (link.type) {
      case 'istar.AndRefinementLink':
        return 'and';
      case 'istar.OrRefinementLink':
        return 'or';
      case 'istar.NeededByLink':
        return 'neededBy';
      case 'istar.QualificationLink':
        return 'and';
      default:
        throw new Error(
          `[UNSUPPORTED LINK]: Please implement ${link.type} decoding`,
        );
    }
  });

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
        const isOutgoingQualification =
          link.type === 'istar.QualificationLink' && link.source === id;
        const childNodeId = isOutgoingQualification ? link.target : link.source;

        const node = actor.nodes.find((item) => item.id === childNodeId);
        if (!node) {
          return undefined;
        }

        const [granChildren, relation] = nodeChildren({
          actor,
          id: node.id,
          links,
          mapper,
          context,
        });

        // createNode returns null for skipped resources
        const createdNode = createNode({
          node,
          relation,
          children: granChildren,
          mapper,
          context,
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
>({
  actor,
  iStarLinks,
  node,
  mapper,
  context,
}: {
  actor: Actor;
  iStarLinks: Link[];
  node: Node;
  mapper: EngineMapper<
    TGoalEngine,
    TTaskEngine,
    TResourceEngine,
    TGoalKeys,
    TTaskKeys,
    TResourceKeys
  >;
  context: CreationContext<TGoalKeys, TTaskKeys, TResourceKeys>;
}): TreeNode<TGoalEngine, TTaskEngine, TResourceEngine> | null {
  const [children, relation] = nodeChildren({
    actor,
    id: node.id,
    links: iStarLinks,
    mapper,
    context,
  });

  return createNode({ node, children, relation, mapper, context });
}

function runAfterCreationMapper<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine,
  TGoalKeys extends string,
  TTaskKeys extends string,
  TResourceKeys extends string,
>(
  tree: GoalTree<TGoalEngine, TTaskEngine, TResourceEngine>,
  mapper: EngineMapper<
    TGoalEngine,
    TTaskEngine,
    TResourceEngine,
    TGoalKeys,
    TTaskKeys,
    TResourceKeys
  >,
  context: CreationContext<TGoalKeys, TTaskKeys, TResourceKeys>,
): GoalTree<TGoalEngine, TTaskEngine, TResourceEngine> {
  // If no afterCreationMapper is provided, return tree as-is
  if (!('afterCreationMapper' in mapper) || !mapper.afterCreationMapper) {
    return tree;
  }

  const allGoals = allByType(tree, 'goal');
  const allTasks = allByType(tree, 'task');
  const allResources = allByType(tree, 'resource');

  const nodeMap = new Map<
    string,
    TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>
  >();
  [...allGoals, ...allTasks, ...allResources].forEach((node) => {
    nodeMap.set(node.id, node);
  });

  const processGoal = (
    goal: GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>,
  ): GoalNode<TGoalEngine, TTaskEngine, TResourceEngine> => {
    // Get raw properties - discriminated union with type: 'goal' | 'task' | 'resource'
    const defaultRawProperties: RawPropertiesUnion<
      TGoalKeys,
      TTaskKeys,
      TResourceKeys
    > = {
      type: 'goal',
      raw: {},
    };
    const rawProperties =
      context.rawPropertiesMap.get(goal.id) ?? defaultRawProperties;

    const resolvedChildren = goal.children?.map(processGoal);

    // Call afterCreationMapper to transform engine props
    // For goal nodes, the mapper should return TGoalEngine
    const updatedEngine: TGoalEngine =
      'afterCreationMapper' in mapper && mapper.afterCreationMapper
        ? (mapper.afterCreationMapper({
            node: goal,
            allNodes: nodeMap,
            rawProperties,
          }) as TGoalEngine)
        : goal.properties.engine;

    return {
      ...goal,
      properties: {
        ...goal.properties,
        engine: updatedEngine,
      },
      ...(resolvedChildren && { children: resolvedChildren }),
    };
  };

  // Process only goal nodes (top-level nodes in tree are goals)
  return tree.map((node) => {
    if (node.type === 'goal') {
      return processGoal(node);
    }
    return node;
  });
}

/**
 * Convert an iStar model to a GoalTree with engine-specific properties
 */
export function convertToTree<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine,
  TGoalKeys extends string = string,
  TTaskKeys extends string = string,
  TResourceKeys extends string = string,
>(
  model: Model,
  mapper: EngineMapper<
    TGoalEngine,
    TTaskEngine,
    TResourceEngine,
    TGoalKeys,
    TTaskKeys,
    TResourceKeys
  >,
): GoalTree<TGoalEngine, TTaskEngine, TResourceEngine> {
  // Create per-call context to avoid race conditions with concurrent calls
  const context: CreationContext<TGoalKeys, TTaskKeys, TResourceKeys> = {
    rawPropertiesMap: new Map(),
  };

  const unidirectionalTree = model.actors
    .map((actor) => {
      const rootNode = actor.nodes.find((item) => item.customProperties.root);
      if (!rootNode) {
        throw new Error(
          '[Invalid model]: Root node not found during tree creation',
        );
      }

      return nodeToTree({
        actor,
        node: rootNode,
        iStarLinks: [...model.links],
        mapper,
        context,
      });
    })
    .filter(
      (node): node is TreeNode<TGoalEngine, TTaskEngine, TResourceEngine> =>
        node !== null,
    );

  // Run afterCreationMapper if provided (e.g., to resolve dependsOn)
  return runAfterCreationMapper(unidirectionalTree, mapper, context);
}
