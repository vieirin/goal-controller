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
 * These are passed to the engine mapper to create engine-specific properties
 */
export type RawGoalProps = {
  root?: string;
  maxRetries?: string;
  utility?: string;
  cost?: string;
  dependsOn?: string;
  variables?: string;
  type?: string;
  maintain?: string;
  assertion?: string;
  // SLEEC props
  Type?: string;
  Source?: string;
  Class?: string;
  NormPrinciple?: string;
  Proxy?: string;
  AddedValue?: string;
  Condition?: string;
  Event?: string;
  ContextEvent?: string;
};

export type RawTaskProps = {
  maxRetries?: string;
  type?: string;
  maintain?: string;
  assertion?: string;
  // SLEEC props
  PreCond?: string;
  TriggeringEvent?: string;
  TemporalConstraint?: string;
  PostCond?: string;
  ObstacleEvent?: string;
};

export type RawResourceProps = {
  type?: string;
  initialValue?: string;
  lowerBound?: string;
  upperBound?: string;
};

export type { GoalExecutionDetail };

/**
 * Resource mapper configuration - discriminated union
 * Either skip resources entirely, or provide a mapper function
 */
type ResourceMapperConfig<TResourceEngine> =
  | { skipResource: true; mapResourceProps?: never }
  | {
      skipResource?: false;
      mapResourceProps: (props: { raw: RawResourceProps }) => TResourceEngine;
    };

/**
 * Engine mapper interface for creating engine-specific properties
 */
export type EngineMapper<
  TGoalEngine,
  TTaskEngine,
  TResourceEngine = unknown,
> = {
  /**
   * Map raw goal properties to engine-specific goal properties
   */
  mapGoalProps: (props: {
    raw: RawGoalProps;
    executionDetail: GoalExecutionDetail | null;
  }) => TGoalEngine;

  /**
   * Map raw task properties to engine-specific task properties
   */
  mapTaskProps: (props: { raw: RawTaskProps }) => TTaskEngine;

  /**
   * Optional: Transform goal props after tree is created (e.g., resolve dependsOn)
   * Called for each goal node after the full tree is built
   */
  afterCreationMapper?: (props: {
    node: GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>;
    allNodes: Map<string, TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>>;
    rawProperties: RawGoalProps;
  }) => TGoalEngine;
} & ResourceMapperConfig<TResourceEngine>;

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
 * Context object for tree creation - avoids module-level state
 * that could cause race conditions with concurrent calls
 */
type CreationContext = {
  /** Storage for raw goal properties, used by afterCreationMapper */
  rawPropertiesMap: Map<string, RawGoalProps>;
};

function createResource<TResourceEngine>(
  resource: BaseNode & { rawProps: RawResourceProps },
  mapResourceProps: (props: { raw: RawResourceProps }) => TResourceEngine,
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

function createNode<TGoalEngine, TTaskEngine, TResourceEngine>({
  node,
  relation,
  children,
  mapper,
  context,
}: {
  node: Node;
  relation: Relation;
  children: Array<TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>>;
  mapper: EngineMapper<TGoalEngine, TTaskEngine, TResourceEngine>;
  context: CreationContext;
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

    // TypeScript now knows mapper has mapResourceProps (discriminated union)
    const rawResourceProps: RawResourceProps = {
      type: customProperties.type || '',
      initialValue: customProperties.initialValue || '',
      lowerBound: customProperties.lowerBound || '',
      upperBound: customProperties.upperBound || '',
    };

    const resourceNode: BaseNode & { rawProps: RawResourceProps } = {
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
    const rawTaskProps: RawTaskProps = {
      maxRetries: customProperties.maxRetries,
      type: customProperties.type,
      maintain: customProperties.maintain,
      assertion: customProperties.assertion,
      PreCond: customProperties.PreCond,
      TriggeringEvent: customProperties.TriggeringEvent,
      TemporalConstraint: customProperties.TemporalConstraint,
      PostCond: customProperties.PostCond,
      ObstacleEvent: customProperties.ObstacleEvent,
    };

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
    const rawGoalProps: RawGoalProps = {
      root,
      maxRetries: customProperties.maxRetries,
      utility: customProperties.utility,
      cost: customProperties.cost,
      dependsOn: customProperties.dependsOn,
      variables: customProperties.variables,
      type: customProperties.type,
      maintain: customProperties.maintain,
      assertion: customProperties.assertion,
      Type: customProperties.Type,
      Source: customProperties.Source,
      Class: customProperties.Class,
      NormPrinciple: customProperties.NormPrinciple,
      Proxy: customProperties.Proxy,
      AddedValue: customProperties.AddedValue,
      Condition: customProperties.Condition,
      Event: customProperties.Event,
      ContextEvent: customProperties.ContextEvent,
    };

    // Store raw properties for afterCreationMapper
    context.rawPropertiesMap.set(id, rawGoalProps);

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

function nodeChildren<TGoalEngine, TTaskEngine, TResourceEngine>({
  actor,
  id,
  links,
  mapper,
  context,
}: {
  actor: Actor;
  links: Link[];
  id?: string;
  mapper: EngineMapper<TGoalEngine, TTaskEngine, TResourceEngine>;
  context: CreationContext;
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

function nodeToTree<TGoalEngine, TTaskEngine, TResourceEngine>({
  actor,
  iStarLinks,
  node,
  mapper,
  context,
}: {
  actor: Actor;
  iStarLinks: Link[];
  node: Node;
  mapper: EngineMapper<TGoalEngine, TTaskEngine, TResourceEngine>;
  context: CreationContext;
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

function runAfterCreationMapper<TGoalEngine, TTaskEngine, TResourceEngine>(
  tree: GoalTree<TGoalEngine, TTaskEngine, TResourceEngine>,
  mapper: EngineMapper<TGoalEngine, TTaskEngine, TResourceEngine>,
  context: CreationContext,
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
    const rawProperties = context.rawPropertiesMap.get(goal.id) || {};

    const resolvedChildren = goal.children?.map(processGoal);

    // Call afterCreationMapper to transform engine props
    const updatedEngine =
      'afterCreationMapper' in mapper && mapper.afterCreationMapper
        ? mapper.afterCreationMapper({
            node: goal,
            allNodes: nodeMap,
            rawProperties,
          })
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
export function convertToTree<TGoalEngine, TTaskEngine, TResourceEngine>(
  model: Model,
  mapper: EngineMapper<TGoalEngine, TTaskEngine, TResourceEngine>,
): GoalTree<TGoalEngine, TTaskEngine, TResourceEngine> {
  // Create per-call context to avoid race conditions with concurrent calls
  const context: CreationContext = {
    rawPropertiesMap: new Map<string, RawGoalProps>(),
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
