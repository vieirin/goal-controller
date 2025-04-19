import { getGoalDetail } from '../GoalParser';
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

export const isMonitor = (node: { id: string }) => node.id.startsWith('M');

const getMaintainCondition = (
  goalName: string,
  customProperties: CustomProperties['customProperties']
) => {
  if (customProperties.type !== 'maintain') {
    return undefined;
  }
  if (!customProperties.maintain || !customProperties.assertion) {
    // TODO: lock this as an error in the future
    console.warn(
      `[INVALID MODEL]: Maintain condition for goal [${goalName}] must have maintain and assertion: got maintain:${customProperties.maintain || `'empty condition'`} and assertion:${customProperties.assertion || `'empty condition'`}`
    );
  }

  return {
    maintain: customProperties.maintain,
    assertion: customProperties.assertion,
  };
};

const convertNonGoalChildren = (children: GoalNode[]) => {
  return children.reduce(
    (acc, child) => {
      if (child.type === 'goal' && isMonitor(child)) {
        return {
          ...acc,
          monitors: [...acc.monitors, child],
        };
      }
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
      monitors: [],
      resources: [],
      children: [],
      tasks: [],
    } as Record<'monitors' | 'resources' | 'children' | 'tasks', GoalNode[]>
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

  const { alt, root, uniqueChoice, ...customProperties } =
    node.customProperties;

  const decisionVars = parseDecision({ decision: customProperties.variables });
  const {
    monitors,
    resources,
    tasks,
    children: filteredChildren,
  } = convertNonGoalChildren(children);

  if (
    !children.length &&
    !tasks.length &&
    nodeType === 'goal' &&
    !isMonitor({ id })
  ) {
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
    monitors,
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
  if (!unidirectionalTreeNode.children) {
    return {
      ...unidirectionalTreeNode,
      parent: searchParentsForGoal(unidirectionalTreeNode.id),
      children: undefined,
    };
  }
  const bidirectionalTree: GoalNodeWithParent = {
    ...unidirectionalTreeNode,
    parent: searchParentsForGoal(unidirectionalTreeNode.id),
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
    return allGoals.filter((goal) =>
      goal.children?.map(({ id }) => id).includes(goalId)
    );
  };
  // traverse the tree adding parents to it
  const bidirectionalTree: GoalTreeWithParent = unidirectionalTree.map((goal) =>
    addParentToChildren(goal, searchParentsForGoal)
  );

  return bidirectionalTree;
};
