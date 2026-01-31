/**
 * GoalTree SDK - Main class for working with goal trees
 */
import {
  convertToTree,
  createEngineMapper,
  type EngineMapper,
} from './internal/creation';
import {
  allByType as _allByType,
  allGoalsMap as _allGoalsMap,
  leafGoals as _leafGoals,
} from './internal/traversal';
import {
  getContextVariables,
  getTaskAchievabilityVariables,
} from './internal/variables';
import { Model } from './Model';
import type {
  GoalNode,
  GoalTree as GoalTreeArray,
  Model as IStarModel,
  Resource,
  Task,
  TreeNode,
  Type,
} from './types/';
export { createEngineMapper };

/**
 * Query interface for tree operations
 */
export type TreeQuery<TGoalEngine, TTaskEngine, TResourceEngine> = {
  /** Get all nodes of a specific type */
  allByType: ((
    type: 'goal',
  ) => Array<GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>>) &
    ((type: 'task') => Array<Task<TTaskEngine, TResourceEngine>>) &
    ((type: 'resource') => Array<Resource<TResourceEngine>>);

  /** Get a map of all goals by their ID */
  allGoalsMap: () => Map<
    string,
    GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>
  >;

  /** Get all leaf goals (goals with tasks) */
  leafGoals: () => Array<GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>>;

  /** Get all context variables from the tree (requires execCondition in engine) */
  contextVariables: () => string[];

  /** Get achievability variables for all tasks */
  taskAchievabilityVariables: () => string[];
};

/**
 * Main GoalTree class representing an iStar goal model
 */
export class GoalTree<
  TGoalEngine = unknown,
  TTaskEngine = unknown,
  TResourceEngine = unknown,
> {
  private readonly _nodes: Array<
    TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>
  >;

  public readonly query: TreeQuery<TGoalEngine, TTaskEngine, TResourceEngine>;

  private constructor(
    nodes: Array<TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>>,
  ) {
    this._nodes = nodes;
    this.query = this.createQueryInterface();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a GoalTree from an iStar model with a specific engine mapper
   */
  static fromModel<TGoalEngine, TTaskEngine, TResourceEngine>(
    model: IStarModel,
    mapper: EngineMapper<TGoalEngine, TTaskEngine, TResourceEngine>,
  ): GoalTree<TGoalEngine, TTaskEngine, TResourceEngine> {
    const nodes = convertToTree(model, mapper);
    return new GoalTree(nodes);
  }

  /**
   * Create a GoalTree from a pistar model file with a specific engine mapper
   */
  static fromFile<TGoalEngine, TTaskEngine, TResourceEngine>(
    filename: string,
    mapper: EngineMapper<TGoalEngine, TTaskEngine, TResourceEngine>,
  ): GoalTree<TGoalEngine, TTaskEngine, TResourceEngine> {
    const model = Model.load(filename);
    return GoalTree.fromModel(model, mapper);
  }

  /**
   * Create a GoalTree from JSON string with a specific engine mapper
   */
  static fromJSON<TGoalEngine, TTaskEngine, TResourceEngine>(
    json: string,
    mapper: EngineMapper<TGoalEngine, TTaskEngine, TResourceEngine>,
  ): GoalTree<TGoalEngine, TTaskEngine, TResourceEngine> {
    const model = Model.parse(json);
    return GoalTree.fromModel(model, mapper);
  }

  /**
   * Create a GoalTree from existing nodes (for internal use or testing)
   */
  static fromNodes<TGoalEngine, TTaskEngine, TResourceEngine>(
    nodes: Array<TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>>,
  ): GoalTree<TGoalEngine, TTaskEngine, TResourceEngine> {
    return new GoalTree(nodes);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Accessors
  // ─────────────────────────────────────────────────────────────────────────────

  /** Get all nodes in the tree */
  get nodes(): Array<TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>> {
    return this._nodes;
  }

  /** Get the root goal node */
  get root(): GoalNode<TGoalEngine, TTaskEngine, TResourceEngine> | undefined {
    return this._nodes.find(
      (node): node is GoalNode<TGoalEngine, TTaskEngine, TResourceEngine> =>
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Static Query Methods (for working with raw arrays)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get all nodes of a specific type from a tree array
   *
   * This is a static method for working with raw node arrays.
   * If you have a GoalTree instance, use tree.query.allByType() instead.
   *
   * @param nodes - The goal tree array
   * @param type - The node type to filter by ('goal', 'task', or 'resource')
   * @returns Array of nodes matching the specified type
   *
   * @example
   * const goals = GoalTree.allByType(treeArray, 'goal');
   * const tasks = GoalTree.allByType(treeArray, 'task');
   */
  static allByType<TGoalEngine, TTaskEngine, TResourceEngine>(
    nodes: GoalTreeArray<TGoalEngine, TTaskEngine, TResourceEngine>,
    type: 'goal',
  ): Array<GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>>;
  static allByType<TGoalEngine, TTaskEngine, TResourceEngine>(
    nodes: GoalTreeArray<TGoalEngine, TTaskEngine, TResourceEngine>,
    type: 'task',
  ): Array<Task<TTaskEngine, TResourceEngine>>;
  static allByType<TGoalEngine, TTaskEngine, TResourceEngine>(
    nodes: GoalTreeArray<TGoalEngine, TTaskEngine, TResourceEngine>,
    type: 'resource',
  ): Array<Resource<TResourceEngine>>;
  static allByType<TGoalEngine, TTaskEngine, TResourceEngine>(
    nodes: GoalTreeArray<TGoalEngine, TTaskEngine, TResourceEngine>,
    type: Type,
  ): Array<TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>> {
    return _allByType(nodes, type);
  }

  /**
   * Get a map of all goals by their ID from a tree array
   *
   * This is a static method for working with raw node arrays.
   * If you have a GoalTree instance, use tree.query.allGoalsMap() instead.
   *
   * @param nodes - The goal tree array
   * @returns Map of goal IDs to GoalNode objects
   *
   * @example
   * const goalsMap = GoalTree.allGoalsMap(treeArray);
   * const goalById = goalsMap.get('G1');
   */
  static allGoalsMap<TGoalEngine, TTaskEngine, TResourceEngine>(
    nodes: GoalTreeArray<TGoalEngine, TTaskEngine, TResourceEngine>,
  ): Map<string, GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>> {
    return _allGoalsMap(nodes);
  }

  /**
   * Get all leaf goals (goals with tasks) from a tree array
   *
   * Leaf goals are goals that have associated tasks but no child goals.
   * This is a static method for working with raw node arrays.
   * If you have a GoalTree instance, use tree.query.leafGoals() instead.
   *
   * @param nodes - The goal tree array
   * @returns Array of leaf goal nodes
   *
   * @example
   * const leafGoals = GoalTree.leafGoals(treeArray);
   */
  static leafGoals<TGoalEngine, TTaskEngine, TResourceEngine>(
    nodes: GoalTreeArray<TGoalEngine, TTaskEngine, TResourceEngine>,
  ): Array<GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>> {
    return _leafGoals(nodes);
  }

  /**
   * Get all context variables from a tree array
   *
   * Context variables are extracted from execution conditions (maintain/assertion)
   * in goal and task nodes. Requires execCondition in the engine properties.
   * This is a static method for working with raw node arrays.
   * If you have a GoalTree instance, use tree.query.contextVariables() instead.
   *
   * @param nodes - The goal tree array
   * @returns Array of unique context variable names
   *
   * @example
   * const contextVars = GoalTree.contextVariables(treeArray);
   */
  static contextVariables<TGoalEngine, TTaskEngine, TResourceEngine>(
    nodes: GoalTreeArray<TGoalEngine, TTaskEngine, TResourceEngine>,
  ): string[] {
    return getContextVariables(nodes);
  }

  /**
   * Get achievability variables for all tasks in a tree array
   *
   * Task achievability variables represent whether a task can be achieved,
   * typically used in formal verification models (e.g., PRISM).
   * This is a static method for working with raw node arrays.
   * If you have a GoalTree instance, use tree.query.taskAchievabilityVariables() instead.
   *
   * @param nodes - The goal tree array
   * @returns Array of task achievability variable names
   *
   * @example
   * const taskVars = GoalTree.taskAchievabilityVariables(treeArray);
   */
  static taskAchievabilityVariables<TGoalEngine, TTaskEngine, TResourceEngine>(
    nodes: GoalTreeArray<TGoalEngine, TTaskEngine, TResourceEngine>,
  ): string[] {
    return getTaskAchievabilityVariables(nodes);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────────────

  private createQueryInterface(): TreeQuery<
    TGoalEngine,
    TTaskEngine,
    TResourceEngine
  > {
    const nodes = this._nodes;

    // Create properly typed allByType function using overloads
    function allByType(
      type: 'goal',
    ): Array<GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>>;
    function allByType(type: 'task'): Array<Task<TTaskEngine, TResourceEngine>>;
    function allByType(type: 'resource'): Array<Resource<TResourceEngine>>;
    function allByType(
      type: 'goal' | 'task' | 'resource',
    ): Array<TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>> {
      return _allByType(nodes, type);
    }

    return {
      allByType,

      allGoalsMap: () => _allGoalsMap(nodes),

      leafGoals: () => _leafGoals(nodes),

      contextVariables: () => getContextVariables(nodes),

      taskAchievabilityVariables: () => getTaskAchievabilityVariables(nodes),
    };
  }
}

// Re-export EngineMapper type
export type { EngineMapper } from './internal/creation';
