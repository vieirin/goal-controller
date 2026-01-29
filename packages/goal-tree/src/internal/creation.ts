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
import type {
  EngineMapper,
  RawPropertiesUnion,
  RawProps,
} from './engineMapper';
import { allByType } from './traversal';

// Re-export types from engineMapper for backwards compatibility
export { createEngineMapper } from './engineMapper';
export type {
  EngineMapper,
  RawPropertiesUnion,
  RawProps
} from './engineMapper';
export type { GoalExecutionDetail };

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
      throw new Error('[INVALID_MODEL]: Invalid node type: ' + type);
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
    context.rawPropertiesMap.set(id, { nodeType: 'goal', raw: rawGoalProps });

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

    const updatedEngine =
      'afterCreationMapper' in mapper && mapper.afterCreationMapper
        ? mapper.afterCreationMapper({
          node: goal,
          allNodes: nodeMap,
          rawProperties,
        })
        : goal.properties.engine;

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
          '[INVALID_MODEL]: Root node not found during tree creation',
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
