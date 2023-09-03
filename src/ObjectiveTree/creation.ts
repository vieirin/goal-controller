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

const nodeChildren = ({
  actor,
  id,
  links,
}: {
  actor: Actor;
  links: Link[];
  id?: string;
}): [GoalNode[] | undefined, Relation] => {
  if (!id) {
    return [undefined, 'none'];
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

      return {
        id,
        name: goalName,
        decisionMaking,
        iStarId: node.id,
        type: convertIstarType({ type: node.type }),
        relationToParent: relations[0],
        relationToChildren: relation,
        children: granChildren,
        customProperties: node.customProperties,
      };
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

  // Other RT properties should be added here
  const { id, goalName, decisionMaking } = getGoalDetail({
    goalText: node.text,
  });

  return {
    decisionMaking: decisionMaking,
    id,
    name: goalName,
    iStarId: node.id,
    relationToChildren: relation,
    relationToParent: null,
    type: convertIstarType({ type: node.type }),
    children,
    customProperties: node.customProperties,
  };
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
