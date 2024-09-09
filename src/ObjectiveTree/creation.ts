import { getGoalDetail } from '../GoalParser';
import {
  Actor,
  GoalNode,
  GoalTree,
  Link,
  Model,
  Node,
  NodeType,
  Relation,
} from './types';

const convertIstarType = ({ type }: { type: NodeType }) => {
  switch (type) {
    case 'istar.Goal':
      return 'goal';
    case 'istar.Task':
      return 'task';
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
      throw new Error(`[INVALID DECISION]: ${decision}`);
    }
    if (isNaN(parseInt(d[1]))) {
      throw new Error(`[INVALID DECISION]: ${decision}`);
    }
  });

  return parsedDecision.map((d) => ({
    variable: d[0].trim(),
    space: parseInt(d[1]),
  }));
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
  const { id, goalName, decisionMaking } = getGoalDetail({
    goalText: node.text,
  });
  const { alt, root, uniqueChoice, ...customProperties } =
    node.customProperties;
  const decisionVars = parseDecision({ decision: customProperties.variables });

  return {
    decisionMaking: decisionMaking,
    id,
    name: goalName,
    iStarId: node.id,
    relationToChildren: relation,
    relationToParent: null,
    type: convertIstarType({ type: node.type }),
    children,
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
      const { id, goalName, decisionMaking } = getGoalDetail({
        goalText: node.text,
      });

      const [granChildren, relation] = nodeChildren({
        actor,
        id: node.id,
        links: links,
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
      });
    })
    .filter((n): n is GoalNode => !!n);

  return [children, relations[0]];
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

export const convertToTree = ({ model }: { model: Model }): GoalTree => {
  return (
    model.actors
      .map((actor) => {
        // find root node
        const rootNode = actor.nodes.find((item) => item.customProperties.root);
        if (!rootNode) {
          return undefined;
        }
        // calc tree
        return nodeToTree({
          actor,
          node: rootNode,
          iStarLinks: [...model.links],
        });
      })
      // filter undefined trees (those without a root node)
      .filter((node): node is GoalNode => !!node)
  );
};
