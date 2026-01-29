/**
 * Internal tree creation logic
 */
import type { Dictionary } from 'lodash';
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

export type { GoalExecutionDetail };

/**
 * Engine mapper interface for creating engine-specific properties
 */
export type EngineMapper<TGoalEngine, TTaskEngine> = {
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
    node: GoalNode<TGoalEngine, TTaskEngine>;
    allNodes: Map<string, TreeNode<TGoalEngine, TTaskEngine>>;
    rawProperties: RawGoalProps;
  }) => TGoalEngine;
};

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

// Temporary storage for raw goal properties during tree creation
// Used by afterCreationMapper to access raw properties after tree is built
const pendingRawProperties = new Map<string, RawGoalProps>();

const createResource = (
  resource: BaseNode & { properties: Dictionary<string> },
): Resource => {
  const { type } = resource.properties;
  switch (type) {
    case 'bool': {
      const { initialValue } = resource.properties;
      if (!initialValue) {
        throw new Error(
          `[INVALID RESOURCE]: Resource ${resource.id} must have an initial value`,
        );
      }
      return {
        ...resource,
        type: 'resource',
        variable: { type: 'boolean', initialValue: initialValue === 'true' },
      };
    }
    case 'int': {
      const { initialValue, lowerBound, upperBound } = resource.properties;

      // Check for null/undefined/empty string explicitly to allow "0" as valid value
      if (
        initialValue == null ||
        lowerBound == null ||
        upperBound == null ||
        initialValue === '' ||
        lowerBound === '' ||
        upperBound === ''
      ) {
        throw new Error(
          `[INVALID RESOURCE]: Resource ${resource.id} must have an initial value, lower bound, and upper bound`,
        );
      }

      const lowerBoundInt = parseInt(lowerBound);
      const upperBoundInt = parseInt(upperBound);

      if (isNaN(lowerBoundInt) || isNaN(upperBoundInt)) {
        throw new Error(
          `[INVALID RESOURCE]: Resource ${resource.id} must have a valid lower and upper bound, lower bound must be less than upper bound`,
        );
      }

      if (lowerBoundInt > upperBoundInt) {
        throw new Error(
          `[INVALID RESOURCE]: Resource ${resource.id} must have a valid lower and upper bound, lower bound must be less than upper bound`,
        );
      }

      const initialValueInt = parseInt(initialValue);

      if (isNaN(initialValueInt)) {
        throw new Error(
          `[INVALID RESOURCE]: Resource ${resource.id} must have a valid initial value`,
        );
      }
      return {
        ...resource,
        type: 'resource',
        variable: {
          type: 'int',
          initialValue: initialValueInt,
          lowerBound: lowerBoundInt,
          upperBound: upperBoundInt,
        },
      };
    }
    default:
      throw new Error(`[INVALID RESOURCE]: Unsupported resource type: ${type}`);
  }
};

function convertNonGoalChildren<TGoalEngine, TTaskEngine>(
  children: Array<TreeNode<TGoalEngine, TTaskEngine>>,
) {
  return children.reduce<{
    resources: Resource[];
    children: Array<GoalNode<TGoalEngine, TTaskEngine>>;
    tasks: Array<Task<TTaskEngine>>;
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

function createNode<TGoalEngine, TTaskEngine>({
  node,
  relation,
  children,
  mapper,
}: {
  node: Node;
  relation: Relation;
  children: Array<TreeNode<TGoalEngine, TTaskEngine>>;
  mapper: EngineMapper<TGoalEngine, TTaskEngine>;
}): TreeNode<TGoalEngine, TTaskEngine> {
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
  } = convertNonGoalChildren(children);

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
    const resourceNode: BaseNode & { properties: Dictionary<string> } = {
      id,
      name: goalName,
      iStarId: node.id,
      relationToChildren: relation,
      type: 'resource',
      properties: {
        type: customProperties.type || '',
        initialValue: customProperties.initialValue || '',
        lowerBound: customProperties.lowerBound || '',
        upperBound: customProperties.upperBound || '',
      },
    };
    return createResource(resourceNode);
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

    const taskNode: Task<TTaskEngine> = {
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
    pendingRawProperties.set(id, rawGoalProps);

    const goalNode: GoalNode<TGoalEngine, TTaskEngine> = {
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

function nodeChildren<TGoalEngine, TTaskEngine>({
  actor,
  id,
  links,
  mapper,
}: {
  actor: Actor;
  links: Link[];
  id?: string;
  mapper: EngineMapper<TGoalEngine, TTaskEngine>;
}): [Array<TreeNode<TGoalEngine, TTaskEngine>>, Relation] {
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
    .map((link): TreeNode<TGoalEngine, TTaskEngine> | undefined => {
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
      });

      return createNode({
        node,
        relation,
        children: granChildren,
        mapper,
      });
    })
    .filter((n): n is TreeNode<TGoalEngine, TTaskEngine> => !!n);

  return [children, relations[0] ?? 'none'];
}

function nodeToTree<TGoalEngine, TTaskEngine>({
  actor,
  iStarLinks,
  node,
  mapper,
}: {
  actor: Actor;
  iStarLinks: Link[];
  node: Node;
  mapper: EngineMapper<TGoalEngine, TTaskEngine>;
}): TreeNode<TGoalEngine, TTaskEngine> {
  const [children, relation] = nodeChildren({
    actor,
    id: node.id,
    links: iStarLinks,
    mapper,
  });

  return createNode({ node, children, relation, mapper });
}

function runAfterCreationMapper<TGoalEngine, TTaskEngine>(
  tree: GoalTree<TGoalEngine, TTaskEngine>,
  mapper: EngineMapper<TGoalEngine, TTaskEngine>,
): GoalTree<TGoalEngine, TTaskEngine> {
  // If no afterCreationMapper is provided, return tree as-is
  if (!mapper.afterCreationMapper) {
    pendingRawProperties.clear();
    return tree;
  }

  try {
    const allGoals = allByType(tree, 'goal') as Array<
      GoalNode<TGoalEngine, TTaskEngine>
    >;
    const allTasks = allByType(tree, 'task') as Array<Task<TTaskEngine>>;
    const allResources = allByType(tree, 'resource');

    const nodeMap = new Map<string, TreeNode<TGoalEngine, TTaskEngine>>();
    [...allGoals, ...allTasks, ...allResources].forEach((node) => {
      nodeMap.set(node.id, node);
    });

    const processNode = (
      node: TreeNode<TGoalEngine, TTaskEngine>,
    ): TreeNode<TGoalEngine, TTaskEngine> => {
      if (node.type !== 'goal') {
        return node;
      }

      const rawProperties = pendingRawProperties.get(node.id) || {};

      const resolvedChildren = node.children?.map(processNode) as
        | Array<GoalNode<TGoalEngine, TTaskEngine>>
        | undefined;

      // Call afterCreationMapper to transform engine props
      const updatedEngine = mapper.afterCreationMapper
        ? mapper.afterCreationMapper({
            node,
            allNodes: nodeMap,
            rawProperties,
          })
        : node.properties.engine;

      return {
        ...node,
        properties: {
          ...node.properties,
          engine: updatedEngine,
        },
        ...(resolvedChildren && { children: resolvedChildren }),
      };
    };

    return tree.map(processNode);
  } finally {
    // Always clear pending raw properties, even on error
    pendingRawProperties.clear();
  }
}

/**
 * Convert an iStar model to a GoalTree with engine-specific properties
 */
export function convertToTree<TGoalEngine, TTaskEngine>(
  model: Model,
  mapper: EngineMapper<TGoalEngine, TTaskEngine>,
): GoalTree<TGoalEngine, TTaskEngine> {
  const unidirectionalTree = model.actors.map((actor) => {
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
    });
  });

  // Run afterCreationMapper if provided (e.g., to resolve dependsOn)
  return runAfterCreationMapper(unidirectionalTree, mapper);
}
