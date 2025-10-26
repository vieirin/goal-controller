import { EdgemodelFactoryImpl } from '../edgeEMFModel/EdgemodelFactoryImpl';
import { GoalTree } from '../edgeEMFModel/GoalTree';
import { Goal } from '../edgeEMFModel/Goal';
import { Task } from '../edgeEMFModel/Task';
import { Node as EMFNode } from '../edgeEMFModel/Node';
import { GoalType } from '../edgeEMFModel/GoalType';
import { LinkType } from '../edgeEMFModel/LinkType';
import { RuntimeOp } from '../edgeEMFModel/RuntimeOp';
import { ResourceKind } from '../edgeEMFModel/ResourceKind';
import {
  Model,
  Node,
  Link,
  Actor,
  type GoalExecutionDetail,
} from '../ObjectiveTree/types';
import { getGoalDetail } from '../parsers/GoalNameParser';
import type { EdgemodelFactory } from 'edgemodel/EdgemodelFactory';

/**
 * Converts the JSON model to an EMF GoalTree instance
 */
export const convertModelToEMF = (model: Model): GoalTree => {
  const factory = EdgemodelFactoryImpl.eINSTANCE;
  const goalTree = factory.createGoalTree();

  // Map to store created EMF nodes by their iStar ID
  const nodeMap = new Map<string, EMFNode>();

  // Map to store links by target ID for traversal
  const linksByTarget = new Map<string, Link[]>();
  model.links.forEach((link) => {
    const existing = linksByTarget.get(link.target) || [];
    linksByTarget.set(link.target, [...existing, link]);
  });

  // Process actors (typically just one in these models)
  for (const actor of model.actors) {
    // Find the root node
    const rootNode = actor.nodes.find(
      (n) => n.customProperties.root === 'true'
    );
    if (!rootNode) {
      throw new Error('[convertModelToEMF]: No root node found in actor');
    }

    // Create the root goal and set it on the goal tree
    const emfRoot = createEMFNodeRecursive(
      rootNode,
      actor,
      linksByTarget,
      nodeMap,
      factory
    );
    // Check if it's a Goal by checking for the 'utility' property which only Goals have
    if ('utility' in emfRoot && 'cost' in emfRoot) {
      goalTree.root = emfRoot as unknown as Goal;
    } else {
      throw new Error('[convertModelToEMF]: Root must be a Goal, not a Task');
    }
  }

  return goalTree;
};

/**
 * Recursively creates EMF nodes (Goals or Tasks) with their children
 */
const createEMFNodeRecursive = (
  node: Node,
  actor: Actor,
  linksByTarget: Map<string, Link[]>,
  nodeMap: Map<string, EMFNode>,
  factory: EdgemodelFactory
): EMFNode => {
  // Check if we've already created this node (for dependencies)
  if (nodeMap.has(node.id)) {
    return nodeMap.get(node.id)!;
  }

  // Parse the node text to get ID and name
  const { id, goalName, executionDetail } = getGoalDetail({
    goalText: node.text,
  });

  // Determine node type
  const nodeType = convertIstarType(node.type);

  let emfNode: EMFNode;

  if (nodeType === 'goal') {
    const emfGoal = factory.createGoal();
    emfGoal.id = id;
    emfGoal.name = goalName || node.text;

    // Set goal type (Achieve or Maintain)
    if (node.customProperties.type === 'maintain') {
      emfGoal.type = GoalType.MAINTAIN;

      // Set maintain condition
      if (node.customProperties.maintain) {
        const maintainCondition = factory.createCondition();
        maintainCondition.expression = node.customProperties.maintain;
        emfGoal.maintainCondition = maintainCondition;
      }

      // Set context (assertion)
      if (node.customProperties.assertion) {
        const context = factory.createCondition();
        context.expression = node.customProperties.assertion;
        emfGoal.context = context;
      }
    } else {
      emfGoal.type = GoalType.ACHIEVE;

      // Set context (assertion) for achieve goals too
      if (node.customProperties.assertion) {
        const context = factory.createCondition();
        context.expression = node.customProperties.assertion;
        emfGoal.context = context;
      }
    }

    // Set utility and cost
    emfGoal.utility = parseFloat(node.customProperties.utility || '0');
    emfGoal.cost = parseFloat(node.customProperties.cost || '0');

    // Set max retries
    if (node.customProperties.maxRetries) {
      emfGoal.maxRetries = parseInt(node.customProperties.maxRetries);
    }

    emfNode = emfGoal;
  } else if (nodeType === 'task') {
    const emfTask = factory.createTask();
    emfTask.id = id;
    emfTask.name = goalName || node.text;

    // Set max retries
    if (node.customProperties.maxRetries) {
      emfTask.maxRetries = parseInt(node.customProperties.maxRetries);
    }

    emfNode = emfTask;
  } else {
    // Resource nodes are handled differently - they're added to tasks
    throw new Error(
      `[convertModelToEMF]: Resource nodes should be children of tasks`
    );
  }

  // Store in map for later reference
  nodeMap.set(node.id, emfNode);

  // Get children links
  const childLinks = linksByTarget.get(node.id) || [];

  if (childLinks.length > 0) {
    // Create the Link object
    const emfLink = factory.createLink();

    // Determine link type (AND or OR)
    const linkType = determineLinkType(childLinks);
    // Note: LinkType is stored in the execution details, not directly on Link in this model

    // Process all child nodes
    for (const childLink of childLinks) {
      const childNode = actor.nodes.find((n) => n.id === childLink.source);
      if (!childNode) continue;

      const childType = convertIstarType(childNode.type);

      if (childType === 'resource') {
        // Handle resources - add them to task
        if (emfNode instanceof Object && 'resources' in emfNode) {
          const resource = createEMFResource(childNode, factory);
          (emfNode as Task).resources.add(resource);
        }
      } else if (childType === 'goal') {
        // Recursively create child goal
        const childEMFNode = createEMFNodeRecursive(
          childNode,
          actor,
          linksByTarget,
          nodeMap,
          factory
        );
        if ('utility' in childEMFNode && 'cost' in childEMFNode) {
          emfLink.outgoing.add(childEMFNode as unknown as Goal);
        }
      } else if (childType === 'task') {
        // Tasks as children - in the EMF model, tasks can't have a Link child
        // This would typically be handled differently, but following the structure
        // we treat them as special cases
        console.warn(
          `[convertModelToEMF]: Task ${id} has task child - this is unusual in EDGE model`
        );
      }
    }

    // Set the link as the child of this node
    if (emfLink.outgoing.size() > 0) {
      emfNode.child = emfLink;

      // If this is a goal, set execution details based on custom properties and parsed execution detail
      if ('utility' in emfNode && 'cost' in emfNode) {
        const goal = emfNode as unknown as Goal;
        setExecutionDetails(
          goal,
          node,
          childLinks,
          linkType,
          factory,
          executionDetail
        );
      }
    }
  }

  // Handle dependencies
  if (node.customProperties.dependsOn) {
    const dependencyIds = node.customProperties.dependsOn
      .split(',')
      .map((d) => d.trim());
    for (const depId of dependencyIds) {
      // Find the dependency node
      const depNode = actor.nodes.find((n) => {
        const { id: nodeId } = getGoalDetail({ goalText: n.text });
        return nodeId === depId;
      });

      if (depNode) {
        const depEMFNode = nodeMap.get(depNode.id);
        if (depEMFNode && 'utility' in depEMFNode && 'cost' in depEMFNode) {
          emfNode.dependsOn.add(depEMFNode as unknown as Goal);
        }
      }
    }
  }

  return emfNode;
};

/**
 * Converts iStar node type to simple type string
 */
const convertIstarType = (type: string): 'goal' | 'task' | 'resource' => {
  switch (type) {
    case 'istar.Goal':
      return 'goal';
    case 'istar.Task':
      return 'task';
    case 'istar.Resource':
      return 'resource';
    default:
      throw new Error(`[convertIstarType]: Unknown type ${type}`);
  }
};

/**
 * Determines the link type (AND or OR) from a set of links
 */
const determineLinkType = (links: Link[]): LinkType => {
  if (links.length === 0) return LinkType.AND;

  const firstLinkType = links[0]?.type;
  if (!firstLinkType) return LinkType.AND;

  const allSame = links.every((l) => l.type === firstLinkType);

  if (!allSame) {
    throw new Error(
      '[determineLinkType]: Cannot mix AND and OR links to the same parent'
    );
  }

  if (firstLinkType === 'istar.OrRefinementLink') {
    return LinkType.OR;
  }
  return LinkType.AND;
};

/**
 * Sets execution details on a goal based on custom properties
 */
const setExecutionDetails = (
  goal: Goal,
  node: Node,
  childLinks: Link[],
  linkType: LinkType,
  factory: EdgemodelFactory,
  executionDetail: GoalExecutionDetail | null
): void => {
  // Check for execution detail custom properties
  const customProps = node.customProperties;

  // Look for execution operators in custom properties

  // Create execution details only if there are actually children to execute
  // Don't create execution details just because of parsing artifacts like [+] with no children
  const execDetails = factory.createExecutionDetails();
  if (executionDetail && childLinks.length > 0) {
    // Map execution detail type directly to RuntimeOp (one-to-one mapping)
    if (executionDetail && executionDetail.type) {
      switch (executionDetail.type) {
        case 'alternative':
          execDetails.operator = RuntimeOp.ALTERNATIVE;
          break;
        case 'degradation':
          execDetails.operator = RuntimeOp.DEGRADATION;
          break;
        case 'sequence':
          execDetails.operator = RuntimeOp.SEQUENCE;
          break;
        case 'interleaved':
          execDetails.operator = RuntimeOp.INTERLEAVED;
          break;
        case 'choice':
          execDetails.operator = RuntimeOp.CHOICE;
          break;
        default:
          execDetails.operator = RuntimeOp.INTERLEAVED;
      }
    } else if (linkType === LinkType.OR) {
      // Fall back to link type if no execution detail type
      execDetails.operator = RuntimeOp.ALTERNATIVE;
    } else {
      // Default to interleaved
      execDetails.operator = RuntimeOp.INTERLEAVED;
    }

    // Create operands for each child
    const goalNode = goal as unknown as EMFNode;
    if (goalNode.child && goalNode.child.outgoing) {
      const operand = factory.createOperand();

      // Add all children as targets
      const children = goalNode.child.outgoing as any;
      for (let i = 0; i < children.size(); i++) {
        const childGoal = children.at(i);
        operand.target.add(childGoal as unknown as EMFNode);
      }

      // Set retry limit if specified
      if (customProps.maxRetries) {
        operand.retryLimit = parseInt(customProps.maxRetries);
      }

      execDetails.operand.add(operand);
    }

    goal.exec = execDetails;
  }
};

/**
 * Creates an EMF Resource (BoolResource or IntResource) from a JSON node
 */
const createEMFResource = (node: Node, factory: EdgemodelFactory) => {
  const { id, goalName } = getGoalDetail({ goalText: node.text });
  const customProps = node.customProperties as any; // Custom properties vary by node type
  const resourceType = customProps.type;

  if (resourceType === 'bool') {
    const boolResource = factory.createBoolResource();
    boolResource.id = id;
    boolResource.name = goalName || node.text;
    boolResource.kind = ResourceKind.BOOL;
    boolResource.initialValue = customProps.initialValue === 'true';
    return boolResource;
  } else if (resourceType === 'int') {
    const intResource = factory.createIntResource();
    intResource.id = id;
    intResource.name = goalName || node.text;
    intResource.kind = ResourceKind.INT;
    intResource.initialValue = parseInt(customProps.initialValue || '0');
    intResource.lowerBound = parseInt(customProps.lowerBound || '0');
    intResource.upperBound = parseInt(customProps.upperBound || '100');
    return intResource;
  } else {
    throw new Error(
      `[createEMFResource]: Unknown resource type ${resourceType}`
    );
  }
};
