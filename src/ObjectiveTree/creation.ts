import { getGoalDetail } from '../GoalParser';
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
} from './types';
import { allByType } from './utils';
import {
  validateDependsOn,
  validateDependsOnInput,
} from './validators/dependsOn';

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
  allNodesWithIndex,
}: {
  dependsOn: string;
  allNodesWithIndex: { id: string; index: number }[];
}): Array<string> => {
  if (!dependsOn) {
    return [];
  }

  const isValid = validateDependsOnInput(dependsOn);
  if (!isValid) {
    throw new Error(
      `Invalid dependsOn input got ${dependsOn} but expected T2.2 or T2`
    );
  }

  const parsedDependency = dependsOn.split(',');
  const trimmedDependency = parsedDependency.map((d) =>
    d.replace('.', '_').trim()
  );
  validateDependsOn(trimmedDependency, allNodesWithIndex);

  return trimmedDependency;
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
    if (isNaN(parseInt(d[1]))) {
      throw new Error(`[INVALID DECISION] space must be a number: got ${d[1]}`);
    }
  });

  return parsedDecision.map((d) => ({
    variable: d[0].trim(),
    space: parseInt(d[1]),
  }));
};

export const isMonitor = (node: { id: string }) => node.id.startsWith('M');

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
          children: [...acc.children, child],
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
  allNodesWithIndex,
}: {
  node: Node;
  relation: Relation;
  children: GoalNode[];
  allNodesWithIndex: { id: string; index: number }[];
}): GoalNode => {
  // Other RT properties should be added here
  // should we add order?
  const { id, goalName, decisionMaking } = getGoalDetail({
    goalText: node.text,
  });

  const type = convertIstarType({ type: node.type });

  if (type === 'resource' && children.length > 0) {
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
    type === 'goal' &&
    !isMonitor({ id })
  ) {
    throw new Error(
      `[INVALID MODEL]: Leaf Goal ${id}:${goalName} has no children or tasks`
    );
  }

  if (resources.length > 0 && type !== 'task') {
    throw new Error(
      `[INVALID MODEL]: Only tasks can have resources, node ${id}:${goalName} is not a task, it is a ${type} instead`
    );
  }

  return {
    decisionMaking: decisionMaking,
    id,
    name: goalName,
    iStarId: node.id,
    relationToChildren: relation,
    relationToParent: null,
    type,
    index: allNodesWithIndex.find((node) => node.id === id)?.index ?? -1,
    monitors,
    resources,
    children: filteredChildren,
    decisionVars: decisionVars,
    hasDecision: decisionVars.length > 0,
    customProperties: {
      ...customProperties,
      dependsOn: parseDependsOn({
        dependsOn: customProperties.dependsOn ?? '',
        allNodesWithIndex,
      }),
      alt: alt?.toLowerCase() === 'true' || false,
      root: root?.toLowerCase() === 'true' || undefined,
      uniqueChoice: uniqueChoice?.toLowerCase() === 'true' || false,
    },
    ...(tasks.length > 0 && { tasks }),
  };
};

const nodeChildren = ({
  actor,
  id,
  links,
  allNodesWithIndex,
}: {
  actor: Actor;
  links: Link[];
  id?: string;
  allNodesWithIndex: { id: string; index: number }[];
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
        allNodesWithIndex,
      });

      const { alt, root, ...customProperties } = node.customProperties;
      const nodeAlt = alt === 'true' || false;
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
        allNodesWithIndex,
      });
    })
    .filter((n): n is GoalNode => !!n);

  return [children, relations[0]];
};

const nodeToTree = ({
  actor,
  iStarLinks,
  node,
  allNodesWithIndex,
}: {
  actor: Actor;
  iStarLinks: Link[];
  node: Node;
  allNodesWithIndex: { id: string; index: number }[];
}): GoalNode => {
  const [children, relation] = nodeChildren({
    actor,
    id: node.id,
    links: iStarLinks,
    allNodesWithIndex,
  });

  return createNode({ node, children, relation, allNodesWithIndex });
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

// give an index to each goal/task node
// map the index to the node id that's extracted from the goal text
// sort the nodes by type, goal first, then task
const mapNodeIndexes = (model: Model) => {
  let index = 0;
  return model.actors.flatMap((actor) =>
    actor.nodes
      .filter((node) => ['istar.Goal', 'istar.Task'].includes(node.type))
      .sort((a, b) => {
        if (a.type === 'istar.Goal' && b.type === 'istar.Task') {
          return -1;
        } else if (a.type === 'istar.Task' && b.type === 'istar.Goal') {
          return 1;
        }
        return 0;
      })
      .map((node) => {
        const { id } = getGoalDetail({
          goalText: node.text,
        });
        return { id, index: index++ };
      })
  );
};

export const convertToTree = ({
  model,
}: {
  model: Model;
}): {
  bidirectionalTree: GoalTreeWithParent;
  nodeIndexMap: { id: string; index: number }[];
} => {
  const allNodesWithIndex = mapNodeIndexes(model);

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
      allNodesWithIndex,
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

  return { bidirectionalTree, nodeIndexMap: allNodesWithIndex };
};
