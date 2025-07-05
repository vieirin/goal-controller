import { getAssertionVariables } from '../parsers/getAssertionVariables';
import { getGoalDetail } from '../parsers/GoalNameParser';
import { isAlternative } from './nodeUtils';
import {
  Actor,
  GoalNode,
  GoalNodeWithParent,
  GoalTreeWithParent,
  Link,
  Model,
  Node,
  NodeType,
  Relation,
  type CustomProperties,
  type MaintainCondition,
  type Resource,
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
    default:
      throw new Error('Invalid node type: ' + type);
  }
};

const parseDependsOn = ({
  dependsOn,
}: {
  dependsOn: string;
}): Array<string> => {
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
}): { variable: string; space: number }[] => {
  if (!decision) {
    return [];
  }
  const parsedDecision = decision.split(',').map((d) => d.split(':'));
  parsedDecision.forEach((d) => {
    if (d.length !== 2) {
      throw new Error(
        `[INVALID DECISION] decision must be a variable and space: got ${decision}, expected format variable:space`
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
  customProperties: CustomProperties['customProperties']
): MaintainCondition | undefined => {
  if (customProperties.type !== 'maintain') {
    return undefined;
  }
  if (!customProperties.maintain || !customProperties.assertion) {
    // TODO: lock this as an error in the future
    // console.warn(
    //   `[INVALID MODEL]: Maintain condition for goal [${goalName}] must have maintain and assertion: got maintain:${
    //     customProperties.maintain || `'empty condition'`
    //   } and assertion:${customProperties.assertion || `'empty condition'`}`
    // );
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
};

const createResource = (resource: GoalNode): Resource => {
  const { type } = resource.customProperties;
  switch (type) {
    case 'bool': {
      const { initialValue } = resource.customProperties;
      if (!initialValue) {
        throw new Error(
          `[INVALID RESOURCE]: Resource ${resource.id} must have an initial value`
        );
      }
      return {
        ...resource,
        variable: { type: 'boolean', initialValue: initialValue === 'true' },
      };
    }
    case 'int':
      const { initialValue, lowerBound, upperBound } =
        resource.customProperties;

      if (!initialValue || !lowerBound || !upperBound) {
        throw new Error(
          `[INVALID RESOURCE]: Resource ${resource.id} must have an initial value, lower bound, and upper bound`
        );
      }

      if (isNaN(lowerBound) || isNaN(upperBound)) {
        throw new Error(
          `[INVALID RESOURCE]: Resource ${resource.id} must have a valid lower and upper bound, lower bound must be less than upper bound`
        );
      }

      const lowerBoundInt = parseInt(lowerBound);
      const upperBoundInt = parseInt(upperBound);

      if (lowerBoundInt > upperBoundInt) {
        throw new Error(
          `[INVALID RESOURCE]: Resource ${resource.id} must have a valid lower and upper bound, lower bound must be less than upper bound`
        );
      }

      if (isNaN(initialValue)) {
        throw new Error(
          `[INVALID RESOURCE]: Resource ${resource.id} must have a valid initial value`
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
    default:
      throw new Error(`[INVALID RESOURCE]: Unsupported resource type: ${type}`);
  }
};

const convertNonGoalChildren = (children: GoalNode[]) => {
  return children.reduce(
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
    } as Record<'children' | 'tasks', GoalNode[]> & {
      resources: Resource[];
    }
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

  if (nodeType === 'resource' && children.length > 0) {
    throw new Error(
      `[INVALID MODEL]: Resource node ${goalName} can't have children`
    );
  }

  const { alt, root, uniqueChoice, maxRetries, ...customProperties } =
    node.customProperties;

  const decisionVars = parseDecision({ decision: customProperties.variables });
  const {
    resources,
    tasks,
    children: filteredChildren,
  } = convertNonGoalChildren(children);

  if (!children.length && !tasks.length && nodeType === 'goal') {
    throw new Error(
      `[INVALID MODEL]: Leaf Goal ${id}:${goalName} has no children or tasks`
    );
  }

  if (resources.length > 0 && nodeType !== 'task') {
    throw new Error(
      `[INVALID MODEL]: Only tasks can have resources, node ${id}:${goalName} is not a task, it is a ${nodeType} instead`
    );
  }

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
    decisionVars: decisionVars,
    hasDecision: decisionVars.length > 0,
    customProperties: {
      ...customProperties,
      dependsOn: parseDependsOn({
        dependsOn: customProperties.dependsOn ?? '',
      }),
      alt: alt?.toLowerCase() === 'true' || false,
      root: root?.toLowerCase() === 'true' || undefined,
      uniqueChoice: uniqueChoice?.toLowerCase() === 'true' || false,
      maxRetries: maxRetries ? parseInt(maxRetries) : undefined,
    },
    maintainCondition: getMaintainCondition(
      `${id}:${goalName}`,
      customProperties
    ),
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
  const nodeLinks = links.filter((link) => link.target === id);

  // get the set of relations associated to the parent element
  const relations = nodeLinks.map((link) => {
    switch (link.type) {
      case 'istar.AndRefinementLink':
        return 'and';
      case 'istar.OrRefinementLink':
        return 'or';
      case 'istar.NeededByLink':
        return 'neededBy';
      default:
        throw new Error(
          `[UNSUPPORTED LINK]: Please implement ${link.type} decoding`
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
      // from links find linked the linked nodes
      const node = actor.nodes.find((item) => item.id === link.source);
      if (!node) {
        return undefined;
      }

      const [granChildren, relation] = nodeChildren({
        actor,
        id: node.id,
        links: links,
      });

      const nodeAlt = isAlternative(node);
      return createNode({
        node,
        relation,
        children: granChildren.map((granChild) => {
          // if the parent is alternative, then its children must be marked as their variant
          if (nodeAlt) {
            return { ...granChild, variantOf: granChild.id.slice(0, 2) };
          }
          return { ...granChild };
        }),
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

const addParentToChildren = (
  unidirectionalTreeNode: GoalNode,
  searchParentsForGoal: (goalId: string) => GoalNode[]
): GoalNodeWithParent => {
  const parent = searchParentsForGoal(unidirectionalTreeNode.id);
  if (!unidirectionalTreeNode.children) {
    return {
      ...unidirectionalTreeNode,
      parent,
      children: undefined,
    };
  }

  // validate that the child has a maxRetries property if the parent has a retryMap entry for it
  parent.forEach((p) => {
    if (
      p.executionDetail?.retryMap?.[unidirectionalTreeNode.id] &&
      !unidirectionalTreeNode.customProperties.maxRetries
    ) {
      throw new Error(
        `[INVALID MODEL]: Goal ${unidirectionalTreeNode.id} is missing maxRetries property, but its parent ${p.id} declares it in a retryMap`
      );
    }
  });

  const bidirectionalTree: GoalNodeWithParent = {
    ...unidirectionalTreeNode,
    parent,
    children: unidirectionalTreeNode.children.map(
      (goal): GoalNodeWithParent => ({
        ...goal,
        parent: searchParentsForGoal(goal.id),
        children: goal.children?.map((g) =>
          addParentToChildren(g, searchParentsForGoal)
        ),
      })
    ),
  };

  return bidirectionalTree;
};

export const convertToTree = ({
  model,
}: {
  model: Model;
}): GoalTreeWithParent => {
  const unidirectionalTree = model.actors.map((actor) => {
    // find root node
    const rootNode = actor.nodes.find((item) => item.customProperties.root);
    if (!rootNode) {
      throw new Error(
        '[Invalid model]: Root node not found during tree creation'
      );
    }

    // calc tree
    return nodeToTree({
      actor,
      node: rootNode,
      iStarLinks: [...model.links],
    });
  });

  const allGoals = allByType({ gm: unidirectionalTree, type: 'goal' });
  const searchParentsForGoal = (goalId: string) => {
    return allGoals.filter(
      (goal) => goal.children?.map(({ id }) => id).includes(goalId)
    );
  };
  // traverse the tree adding parents to it
  const bidirectionalTree: GoalTreeWithParent = unidirectionalTree.map((goal) =>
    addParentToChildren(goal, searchParentsForGoal)
  );

  return bidirectionalTree;
};
