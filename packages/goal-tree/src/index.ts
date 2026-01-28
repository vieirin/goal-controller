import { readFileSync } from 'fs';
import type { Model } from './types';

export const validateModel = ({ model }: { model: Model }): void => {
  const root = model.actors
    .map((item) =>
      // check in node list if there are more than one root
      item.nodes.reduce((hasRoot, node) => {
        // Exclude Quality nodes from root check
        if (node.type === 'istar.Quality') {
          return hasRoot;
        }
        // Check if this node has outgoing links
        const isRoot = !model.links.find((link) => link.source === node.id);
        // Also exclude nodes that are targets of QualificationLinks (connected to Quality nodes)
        const isQualifiedByQuality = model.links.some((link) => {
          if (link.type !== 'istar.QualificationLink') return false;
          if (link.target !== node.id) return false;
          // Check if the source is a Quality node
          const sourceNode = item.nodes.find((n) => n.id === link.source);
          return sourceNode?.type === 'istar.Quality';
        });

        if (isQualifiedByQuality) {
          return hasRoot; // Skip this node in root check
        }

        if (isRoot && hasRoot) {
          throw new Error('invalid number of roots, one allowed');
        }
        if (isRoot) {
          node.customProperties.root = 'true';
        }
        return isRoot || hasRoot;
      }, false),
    )
    // check if all actors have a root
    .every((isValid) => isValid);
  if (!root) {
    throw new Error('invalid number of root, one allowed');
  }
};

export const loadPistarModel = ({ filename }: { filename: string }): Model => {
  const modelFile = readFileSync(filename);
  const model = JSON.parse(modelFile.toString()) as Model;

  validateModel({ model });

  return model;
};

// Export from creation.ts
export { convertToTree } from './creation';

// Export from utils.ts
export {
  dumpTreeToJSON,
  allByType,
  allGoalsMap,
  goalRootId,
  leafGoals,
  cartesianProduct,
  childrenWithMaxRetries,
  childrenIncludingTasks,
} from './utils';

// Export from treeVariables.ts
export {
  getTaskAchievabilityVariables,
  treeContextVariables,
} from './treeVariables';

// Export from printTree.ts
export { printTree } from './printTree';

// Export from dependencyResolver.ts
export { resolveDependency } from './dependencyResolver';
export type { Dependency, ConditionDependency } from './dependencyResolver';

// Export from nodeUtils.ts
export { isResource } from './nodeUtils';

// Export all types
export type {
  GoalNode,
  GoalTree,
  Model,
  Actor,
  Node,
  Link,
  Relation,
  Type,
  NodeType,
  ExecCondition,
  Resource,
  SleecProps,
  GoalExecutionDetail,
} from './types';
