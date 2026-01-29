/**
 * GoalTree SDK - Main class for working with goal trees
 */
import { readFileSync } from 'fs';
import { convertToTree, type EngineMapper } from './internal/creation';
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
export type TreeQuery<TGoalEngine, TTaskEngine> = {
  /** Get all nodes of a specific type */
  allByType: ((type: 'goal') => GoalNode<TGoalEngine, TTaskEngine>[]) &
    ((type: 'task') => Task<TTaskEngine>[]) &
    ((type: 'resource') => Resource[]);

  /** Get a map of all goals by their ID */
  allGoalsMap: () => Map<string, GoalNode<TGoalEngine, TTaskEngine>>;

  /** Get all leaf goals (goals with tasks) */
  leafGoals: () => GoalNode<TGoalEngine, TTaskEngine>[];

  /** Get all context variables from the tree (requires execCondition in engine) */
  contextVariables: () => string[];

  /** Get achievability variables for all tasks */
  taskAchievabilityVariables: () => string[];
};

/**
 * Main GoalTree class representing an iStar goal model
 */
export class GoalTree<TGoalEngine = unknown, TTaskEngine = unknown> {
  private readonly _nodes: TreeNode<TGoalEngine, TTaskEngine>[];
  public readonly query: TreeQuery<TGoalEngine, TTaskEngine>;

  private constructor(nodes: TreeNode<TGoalEngine, TTaskEngine>[]) {
    this._nodes = nodes;
    this.query = this.createQueryInterface();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a GoalTree from an iStar model with a specific engine mapper
   */
  static fromModel<TGoalEngine, TTaskEngine>(
    model: Model,
    mapper: EngineMapper<TGoalEngine, TTaskEngine>,
  ): GoalTree<TGoalEngine, TTaskEngine> {
    const nodes = convertToTree(model, mapper);
    return new GoalTree(nodes);
  }

  /**
   * Create a GoalTree from a pistar model file with a specific engine mapper
   */
  static fromFile<TGoalEngine, TTaskEngine>(
    filename: string,
    mapper: EngineMapper<TGoalEngine, TTaskEngine>,
  ): GoalTree<TGoalEngine, TTaskEngine> {
    const modelFile = readFileSync(filename);
    const model = JSON.parse(modelFile.toString()) as Model;
    validateModel(model);
    return GoalTree.fromModel(model, mapper);
  }

  /**
   * Create a GoalTree from JSON string with a specific engine mapper
   */
  static fromJSON<TGoalEngine, TTaskEngine>(
    json: string,
    mapper: EngineMapper<TGoalEngine, TTaskEngine>,
  ): GoalTree<TGoalEngine, TTaskEngine> {
    const model = JSON.parse(json) as Model;
    validateModel(model);
    return GoalTree.fromModel(model, mapper);
  }

  /**
   * Create a GoalTree from existing nodes (for internal use or testing)
   */
  static fromNodes<TGoalEngine, TTaskEngine>(
    nodes: TreeNode<TGoalEngine, TTaskEngine>[],
  ): GoalTree<TGoalEngine, TTaskEngine> {
    return new GoalTree(nodes);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Accessors
  // ─────────────────────────────────────────────────────────────────────────────

  /** Get all nodes in the tree */
  get nodes(): TreeNode<TGoalEngine, TTaskEngine>[] {
    return this._nodes;
  }

  /** Get the root goal node */
  get root(): GoalNode<TGoalEngine, TTaskEngine> | undefined {
    return this._nodes.find(
      (node): node is GoalNode<TGoalEngine, TTaskEngine> =>
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
    let children = (this._nodes[0] as GoalNode<TGoalEngine, TTaskEngine>)
      ?.children;
    while ((children?.length ?? 0) > 0) {
      const newChildren: GoalNode<TGoalEngine, TTaskEngine>[] = [];
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
  static allByType<TGoalEngine, TTaskEngine>(
    nodes: GoalTreeArray<TGoalEngine, TTaskEngine>,
    type: 'goal',
  ): GoalNode<TGoalEngine, TTaskEngine>[];
  static allByType<TGoalEngine, TTaskEngine>(
    nodes: GoalTreeArray<TGoalEngine, TTaskEngine>,
    type: 'task',
  ): Task<TTaskEngine>[];
  static allByType<TGoalEngine, TTaskEngine>(
    nodes: GoalTreeArray<TGoalEngine, TTaskEngine>,
    type: 'resource',
  ): Resource[];
  static allByType<TGoalEngine, TTaskEngine>(
    nodes: GoalTreeArray<TGoalEngine, TTaskEngine>,
    type: Type,
  ): TreeNode<TGoalEngine, TTaskEngine>[] {
    return _allByType(nodes, type);
  }

  /** Get a map of all goals from a tree array */
  static allGoalsMap<TGoalEngine, TTaskEngine>(
    nodes: GoalTreeArray<TGoalEngine, TTaskEngine>,
  ): Map<string, GoalNode<TGoalEngine, TTaskEngine>> {
    return _allGoalsMap(nodes);
  }

  /** Get leaf goals from a tree array */
  static leafGoals<TGoalEngine, TTaskEngine>(
    nodes: GoalTreeArray<TGoalEngine, TTaskEngine>,
  ): GoalNode<TGoalEngine, TTaskEngine>[] {
    return _leafGoals(nodes);
  }

  /** Get context variables from a tree array */
  static contextVariables<TGoalEngine, TTaskEngine>(
    nodes: GoalTreeArray<TGoalEngine, TTaskEngine>,
  ): string[] {
    return getContextVariables(nodes);
  }

  /** Get task achievability variables from a tree array */
  static taskAchievabilityVariables<TGoalEngine, TTaskEngine>(
    nodes: GoalTreeArray<TGoalEngine, TTaskEngine>,
  ): string[] {
    return getTaskAchievabilityVariables(nodes);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────────────

  private createQueryInterface(): TreeQuery<TGoalEngine, TTaskEngine> {
    const nodes = this._nodes;

    return {
      allByType: ((type: 'goal' | 'task' | 'resource') => {
        return _allByType(nodes, type);
      }) as TreeQuery<TGoalEngine, TTaskEngine>['allByType'],

      allGoalsMap: () => _allGoalsMap(nodes),

      leafGoals: () => _leafGoals(nodes),

      contextVariables: () => getContextVariables(nodes),

      taskAchievabilityVariables: () => getTaskAchievabilityVariables(nodes),
    };
  }
}

// Re-export EngineMapper type
export type { EngineMapper } from './internal/creation';

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
