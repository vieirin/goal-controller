import { getAssertionVariables } from '../parsers/getAssertionVariables';
import { getGoalDetail } from '../parsers/goalNameParser';
import type {
  Actor,
  CustomProperties,
  ExecCondition,
  GoalNode,
  GoalTree,
  Link,
  Model,
  Node,
  NodeType,
  Relation,
  Resource,
} from './types';
import { allByType } from './utils';

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

const parseDependsOn = ({ dependsOn }: { dependsOn: string }): string[] => {
  if (!dependsOn) {
    return [];
  }
  const parsedDependency = dependsOn.split(',');
  return parsedDependency.map((d) => d.trim());
};

const parseDecision = ({
  decision,
}: {
  decision: string | undefined;
}): Array<{ variable: string; space: number }> => {
  if (!decision) {
    return [];
  }
  const parsedDecision = decision.split(',').map((d) => d.split(':'));
  parsedDecision.forEach((d) => {
    if (d.length !== 2) {
      throw new Error(
        `[INVALID DECISION] decision must be a variable and space: got ${decision}, expected format variable:space`,
      );
    }
    if (isNaN(parseInt(d[1] ?? ''))) {
      throw new Error(`[INVALID DECISION] space must be a number: got ${d[1]}`);
    }
  });

  return parsedDecision.map((d) => ({
    variable: d[0]?.trim() ?? '',
    space: parseInt(d[1] ?? ''),
  }));
};

const getMaintainCondition = (
  goalName: string,
  customProperties: CustomProperties['customProperties'],
  nodeType: 'goal' | 'task' | 'resource',
): ExecCondition | undefined => {
  if (customProperties.type === 'maintain') {
    if (!customProperties.maintain && !customProperties.assertion) {
      // TODO: lock this as an error in the future
      console.warn(
        `[INVALID MODEL]: Maintain condition for ${nodeType} [${goalName}] must have maintain and assertion: got maintain:${
          customProperties.maintain || "'empty condition'"
        } and assertion:${customProperties.assertion || "'empty condition'"}`,
      );
    }

    return {
      maintain: {
        sentence: customProperties.maintain,
        variables: getAssertionVariables({
          assertionSentence: customProperties.maintain,
        }),
      },
      assertion: {
        sentence: customProperties.assertion,
        variables: getAssertionVariables({
          assertionSentence: customProperties.assertion,
        }),
      },
    };
  }

  // For both goal and task types, handle assertions
  if (
    !!customProperties.assertion &&
    (nodeType === 'goal' || nodeType === 'task')
  ) {
    // Validate the assertion using the parser (getAssertionVariables will throw if invalid)
    const assertionVariables = getAssertionVariables({
      assertionSentence: customProperties.assertion,
    });

    return {
      assertion: {
        sentence: customProperties.assertion,
        variables: assertionVariables,
      },
    };
  }

  return undefined;
};

const createResource = (resource: GoalNode): Resource => {
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
        variable: { type: 'boolean', initialValue: initialValue === 'true' },
      };
    }
    case 'int': {
      const { initialValue, lowerBound, upperBound } = resource.properties;

      if (!initialValue || !lowerBound || !upperBound) {
        throw new Error(
          `[INVALID RESOURCE]: Resource ${resource.id} must have an initial value, lower bound, and upper bound`,
        );
      }

      if (isNaN(lowerBound) || isNaN(upperBound)) {
        throw new Error(
          `[INVALID RESOURCE]: Resource ${resource.id} must have a valid lower and upper bound, lower bound must be less than upper bound`,
        );
      }

      const lowerBoundInt = parseInt(lowerBound);
      const upperBoundInt = parseInt(upperBound);

      if (lowerBoundInt > upperBoundInt) {
        throw new Error(
          `[INVALID RESOURCE]: Resource ${resource.id} must have a valid lower and upper bound, lower bound must be less than upper bound`,
        );
      }

      if (isNaN(initialValue)) {
        throw new Error(
          `[INVALID RESOURCE]: Resource ${resource.id} must have a valid initial value`,
        );
      }
      return {
        ...resource,
        variable: {
          type: 'int',
          initialValue: parseInt(initialValue),
          lowerBound: lowerBoundInt,
          upperBound: upperBoundInt,
        },
      };
    }
    default:
      throw new Error(`[INVALID RESOURCE]: Unsupported resource type: ${type}`);
  }
};

const convertNonGoalChildren = (children: GoalNode[]) => {
  return children.reduce<
    Record<'children' | 'tasks', GoalNode[]> & {
      resources: Resource[];
    }
  >(
    (acc, child) => {
      if (child.type === 'resource') {
        return {
          ...acc,
          resources: [...acc.resources, createResource(child)],
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
};

const createNode = ({
  node,
  relation,
  children,
}: {
  node: Node;
  relation: Relation;
  children: GoalNode[];
}): GoalNode => {
  // Other RT properties should be added here
  // should we add order?
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

  const { root, uniqueChoice, maxRetries, ...customProperties } =
    node.customProperties || {};

  const decisionVars = parseDecision({ decision: customProperties.variables });
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

  // Get execCondition from getMaintainCondition (handles maintain type and assertions for both goals and tasks)
  const execCondition = getMaintainCondition(
    `${id}:${goalName}`,
    customProperties,
    nodeType,
  );

  return {
    executionDetail,
    id,
    name: goalName,
    iStarId: node.id,
    relationToChildren: relation,
    relationToParent: null,
    type: nodeType,
    resources,
    children: filteredChildren,
    decisionVars,
    hasDecision: decisionVars.length > 0,
    properties: {
      ...customProperties,
      dependsOn: parseDependsOn({
        dependsOn: customProperties.dependsOn ?? '',
      }),
      root: root?.toLowerCase() === 'true' || undefined,
      uniqueChoice: uniqueChoice?.toLowerCase() === 'true' || false,
      maxRetries: maxRetries ? parseInt(maxRetries) : undefined,
      isQuality: isQualityNode,
    },
    execCondition,
    ...(tasks.length > 0 && { tasks }),
  };
};

const nodeChildren = ({
  actor,
  id,
  links,
}: {
  actor: Actor;
  links: Link[];
  id?: string;
}): [GoalNode[], Relation] => {
  if (!id) {
    return [[], 'none'];
  }

  // Find links where this node is the target (children are sources)
  // Exclude QualificationLinks as they are handled separately
  const incomingLinks = links.filter(
    (link) => link.target === id && link.type !== 'istar.QualificationLink',
  );

  // Find QualificationLinks where this node is the source (children are targets)
  const outgoingQualificationLinks = links.filter(
    (link) => link.type === 'istar.QualificationLink' && link.source === id,
  );

  // Combine both sets of links
  const nodeLinks = [...incomingLinks, ...outgoingQualificationLinks];

  // get the set of relations associated to the parent element
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

  // assert all elements are equal
  const allEqual = relations.every((v) => v === relations[0]);
  if (!allEqual) {
    throw new Error(`
            [INVALID MODEL]: You can't mix and/or relations
        `);
  }

  const children = nodeLinks
    .map((link): GoalNode | undefined => {
      // For incoming links (node is target), children are sources
      // For outgoing QualificationLinks (node is source), children are targets
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
      });

      return createNode({
        node,
        relation,
        children: granChildren,
      });
    })
    .filter((n): n is GoalNode => !!n);

  return [children, relations[0] ?? 'none'];
};

const nodeToTree = ({
  actor,
  iStarLinks,
  node,
}: {
  actor: Actor;
  iStarLinks: Link[];
  node: Node;
}): GoalNode => {
  const [children, relation] = nodeChildren({
    actor,
    id: node.id,
    links: iStarLinks,
  });

  return createNode({ node, children, relation });
};

const resolveDependencies = (tree: GoalTree): GoalTree => {
  // Collect all nodes (goals, tasks, resources) into a map for dependency resolution
  const allGoals = allByType({ gm: tree, type: 'goal' });
  const allTasks = allByType({ gm: tree, type: 'task' });
  const allResources = allByType({ gm: tree, type: 'resource' });

  const nodeMap = new Map<string, GoalNode>();
  [...allGoals, ...allTasks, ...allResources].forEach((node) => {
    nodeMap.set(node.id, node);
  });

  const resolveNodeDependencies = (node: GoalNode): GoalNode => {
    // Resolve dependencies for this node
    const resolvedDependencies = node.properties.dependsOn.map((depId) => {
      const depNode = nodeMap.get(depId);
      if (!depNode) {
        throw new Error(
          `[INVALID MODEL]: Dependency ${depId} not found for node ${node.id}`,
        );
      }
      return depNode;
    });

    // Recursively resolve dependencies for children (goals only)
    const resolvedChildren = node.children?.map(resolveNodeDependencies);
    // Tasks and resources don't need to be resolved as they don't have dependsOn

    return {
      ...node,
      dependsOn: resolvedDependencies,
      ...(resolvedChildren && { children: resolvedChildren }),
    };
  };

  return tree.map(resolveNodeDependencies);
};

export const convertToTree = ({ model }: { model: Model }): GoalTree => {
  const unidirectionalTree = model.actors.map((actor) => {
    // find root node
    const rootNode = actor.nodes.find((item) => item.customProperties.root);
    if (!rootNode) {
      throw new Error(
        '[Invalid model]: Root node not found during tree creation',
      );
    }

    // calc tree
    return nodeToTree({
      actor,
      node: rootNode,
      iStarLinks: [...model.links],
    });
  });
  const treeWithDependencies = resolveDependencies(unidirectionalTree);
  return treeWithDependencies;
};
