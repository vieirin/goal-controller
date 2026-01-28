/**
 * GoalTree SDK - Main class for working with goal trees
 */
import { readFileSync } from 'fs';
import { convertToTree } from './internal/creation';
import {
  allByType as _allByType,
  allGoalsMap as _allGoalsMap,
  leafGoals as _leafGoals,
  childrenWithMaxRetries,
} from './internal/traversal';
import {
  getContextVariables,
  getTaskAchievabilityVariables,
} from './internal/variables';
import type {
  GoalNode,
  GoalTree as GoalTreeArray,
  Model,
  Resource,
  Task,
  TreeNode,
  Type,
} from './types/';

/**
 * Query interface for tree operations
 */
export type TreeQuery = {
  /** Get all nodes of a specific type */
  allByType: ((type: 'goal') => GoalNode[]) &
    ((type: 'task') => Task[]) &
    ((type: 'resource') => Resource[]);

  /** Get a map of all goals by their ID */
  allGoalsMap: () => Map<string, GoalNode>;

  /** Get all leaf goals (goals with tasks) */
  leafGoals: () => GoalNode[];

  /** Get all context variables from the tree */
  contextVariables: () => string[];

  /** Get achievability variables for all tasks */
  taskAchievabilityVariables: () => string[];

  /** Get children with retry configuration */
  childrenWithRetries: (node: GoalNode) => Array<GoalNode | Task>;
};

/**
 * Main GoalTree class representing an iStar goal model
 */
export class GoalTree {
  private readonly _nodes: TreeNode[];
  public readonly query: TreeQuery;

  private constructor(nodes: TreeNode[]) {
    this._nodes = nodes;
    this.query = this.createQueryInterface();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a GoalTree from an iStar model
   */
  static fromModel(model: Model): GoalTree {
    const nodes = convertToTree(model);
    return new GoalTree(nodes);
  }

  /**
   * Create a GoalTree from a pistar model file
   */
  static fromFile(filename: string): GoalTree {
    const modelFile = readFileSync(filename);
    const model = JSON.parse(modelFile.toString()) as Model;
    validateModel(model);
    return GoalTree.fromModel(model);
  }

  /**
   * Create a GoalTree from JSON string
   */
  static fromJSON(json: string): GoalTree {
    const model = JSON.parse(json) as Model;
    validateModel(model);
    return GoalTree.fromModel(model);
  }

  /**
   * Create a GoalTree from existing nodes (for internal use or testing)
   */
  static fromNodes(nodes: TreeNode[]): GoalTree {
    return new GoalTree(nodes);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Accessors
  // ─────────────────────────────────────────────────────────────────────────────

  /** Get all nodes in the tree */
  get nodes(): TreeNode[] {
    return this._nodes;
  }

  /** Get the root goal node */
  get root(): GoalNode | undefined {
    return this._nodes.find(
      (node): node is GoalNode =>
        node.type === 'goal' && node.properties.root === true,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Serialization
  // ─────────────────────────────────────────────────────────────────────────────

  /** Serialize the tree to JSON */
  toJSON(): string {
    return JSON.stringify(this._nodes, null, 2);
  }

  /** Print the tree structure to console (for debugging) */
  print(): void {
    let level = 1;
    // eslint-disable-next-line no-console
    console.log(this._nodes);
    let children = (this._nodes[0] as GoalNode)?.children;
    while ((children?.length ?? 0) > 0) {
      const newChildren: GoalNode[] = [];
      // eslint-disable-next-line no-console
      console.log('=== children ===', { level });
      children?.forEach((element) => {
        // eslint-disable-next-line no-console
        console.log(element);
        if (element.children) {
          newChildren.push(...element.children);
        }
      });
      level += 1;
      children = [...newChildren];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Static Query Methods (for working with raw arrays)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Get all nodes of a specific type from a tree array */
  static allByType(nodes: GoalTreeArray, type: 'goal'): GoalNode[];
  static allByType(nodes: GoalTreeArray, type: 'task'): Task[];
  static allByType(nodes: GoalTreeArray, type: 'resource'): Resource[];
  static allByType(nodes: GoalTreeArray, type: Type): TreeNode[] {
    return _allByType(nodes, type);
  }

  /** Get a map of all goals from a tree array */
  static allGoalsMap(nodes: GoalTreeArray): Map<string, GoalNode> {
    return _allGoalsMap(nodes);
  }

  /** Get leaf goals from a tree array */
  static leafGoals(nodes: GoalTreeArray): GoalNode[] {
    return _leafGoals(nodes);
  }

  /** Get context variables from a tree array */
  static contextVariables(nodes: GoalTreeArray): string[] {
    return getContextVariables(nodes);
  }

  /** Get task achievability variables from a tree array */
  static taskAchievabilityVariables(nodes: GoalTreeArray): string[] {
    return getTaskAchievabilityVariables(nodes);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────────────

  private createQueryInterface(): TreeQuery {
    const nodes = this._nodes;

    return {
      allByType: ((type: 'goal' | 'task' | 'resource') => {
        return _allByType(nodes, type);
      }) as TreeQuery['allByType'],

      allGoalsMap: () => _allGoalsMap(nodes),

      leafGoals: () => _leafGoals(nodes),

      contextVariables: () => getContextVariables(nodes),

      taskAchievabilityVariables: () => getTaskAchievabilityVariables(nodes),

      childrenWithRetries: (node: GoalNode) => childrenWithMaxRetries(node),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Model Validation (used internally)
// ─────────────────────────────────────────────────────────────────────────────

function validateModel(model: Model): void {
  const root = model.actors
    .map((item) =>
      item.nodes.reduce((hasRoot, node) => {
        // Exclude Quality nodes from root check
        if (node.type === 'istar.Quality') {
          return hasRoot;
        }
        // Check if this node has outgoing links
        const isRoot = !model.links.find((link) => link.source === node.id);
        // Also exclude nodes that are targets of QualificationLinks
        const isQualifiedByQuality = model.links.some((link) => {
          if (link.type !== 'istar.QualificationLink') return false;
          if (link.target !== node.id) return false;
          const sourceNode = item.nodes.find((n) => n.id === link.source);
          return sourceNode?.type === 'istar.Quality';
        });

        if (isQualifiedByQuality) {
          return hasRoot;
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
    .every((isValid) => isValid);

  if (!root) {
    throw new Error('invalid number of root, one allowed');
  }
}
