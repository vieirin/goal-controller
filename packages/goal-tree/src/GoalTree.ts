/**
 * GoalTree SDK - Main class for working with goal trees
 */
import {
  buildGoalModel,
  convertToTree,
  createEngineMapper,
  type EngineMapper,
} from './internal/creation';
import type { MapperDialect } from './internal/engineMapper';
import type { KindEngineMapper } from './internal/entries';
import type { KindModel, KindNode, Naming, Shape } from './types/kindTree';
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
  GoalModel,
  GoalNode,
  GoalTree as GoalTreeArray,
  Model as IStarModel,
  Resource,
  Task,
  TreeNode,
  Type,
} from './types/';
export { createEngineMapper };

/** What a tree's queries need of a node. */
type QueryNode = { id: string; type: string };

/**
 * Query interface for tree operations, typed by the tree's nodes: today's
 * three types (`TreeQuery`), or a mapper by kind's (goal-controller#215).
 */
export type QueryOf<TNode extends QueryNode> = {
  /** Get all nodes of a specific type */
  allByType: <K extends TNode['type']>(
    type: K,
  ) => Array<Extract<TNode, { type: K }>>;

  /** Get a map of all goals by their ID */
  allGoalsMap: () => Map<string, Extract<TNode, { type: 'goal' }>>;

  /** Get all leaf goals (goals with tasks) */
  leafGoals: () => Array<Extract<TNode, { type: 'goal' }>>;

  /** Get all context variables from the tree (requires execCondition in engine) */
  contextVariables: () => string[];

  /** Get achievability variables for all tasks */
  taskAchievabilityVariables: () => string[];
};

/** Query interface for tree operations */
export type TreeQuery<TGoalEngine, TTaskEngine, TResourceEngine> = QueryOf<
  TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>
>;

/**
 * Main GoalTree class representing an iStar goal model
 */
export class GoalTree<
  TGoalEngine = unknown,
  TTaskEngine = unknown,
  TResourceEngine = unknown,
  /** its nodes: today's three types, or a mapper by kind's (`KindNode`) */
  TNode extends QueryNode = TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>,
> {
  private readonly _nodes: Array<TNode>;

  public readonly query: QueryOf<TNode>;

  private constructor(nodes: Array<TNode>) {
    this._nodes = nodes;
    this.query = this.createQueryInterface();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a GoalTree from an iStar model with a specific engine mapper: the
   * trees of its `GoalModel`, for an engine that reads one actor with one
   * root goal (throws on a model outside its dialect's `model` shape)
   */
  static fromModel<
    TGoalEngine,
    TTaskEngine,
    TResourceEngine,
    TDialect extends MapperDialect = MapperDialect,
    TActorEngine = {},
    TLinkEngine = {},
  >(
    model: IStarModel,
    mapper: EngineMapper<
      TGoalEngine,
      TTaskEngine,
      TResourceEngine,
      TDialect,
      TActorEngine,
      TLinkEngine
    >,
  ): GoalTree<TGoalEngine, TTaskEngine, TResourceEngine>;
  /** The trees of a mapper by kind (goal-controller#215), its nodes typed by kind. */
  static fromModel<D, P, N extends Naming, A, L, S extends Shape>(
    model: IStarModel,
    mapper: KindEngineMapper<D, P, N, A, L, S>,
  ): GoalTree<unknown, unknown, unknown, KindNode<P, N, S> & QueryNode>;
  static fromModel(
    model: IStarModel,
    mapper: EngineMapper<unknown, unknown, unknown> | KindEngineMapper,
  ): GoalTree<unknown, unknown, unknown, QueryNode> {
    return new GoalTree(
      convertToTree(model, mapper as KindEngineMapper) as QueryNode[],
    );
  }

  /**
   * The typed IR of an iStar model (goal-controller#125), whatever its shape:
   * its actors, each holding one tree per root goal, every link and the
   * actors' and links' properties as the engine maps them, the dependums,
   * and every element as written. `fromModel` gives the trees of an engine
   * that reads one actor with one root (its dialect's `model`, the default).
   */
  static goalModel<
    TGoalEngine,
    TTaskEngine,
    TResourceEngine,
    TDialect extends MapperDialect = MapperDialect,
    TActorEngine = {},
    TLinkEngine = {},
  >(
    model: IStarModel,
    mapper: EngineMapper<
      TGoalEngine,
      TTaskEngine,
      TResourceEngine,
      TDialect,
      TActorEngine,
      TLinkEngine
    >,
  ): GoalModel<
    TGoalEngine,
    TTaskEngine,
    TResourceEngine,
    TActorEngine,
    TLinkEngine
  >;
  /** The typed IR of a mapper by kind (goal-controller#215): every node and element typed by kind. */
  static goalModel<D, P, N, A, L, S extends Shape>(
    model: IStarModel,
    mapper: KindEngineMapper<D, P, N, A, L, S>,
  ): KindModel<P, N, A, L, S>;
  static goalModel(
    model: IStarModel,
    mapper: EngineMapper<unknown, unknown, unknown> | KindEngineMapper,
  ): unknown {
    return buildGoalModel(model, mapper as KindEngineMapper);
  }

  /**
   * Create a GoalTree from a pistar model file with a specific engine mapper
   */
  static fromFile<
    TGoalEngine,
    TTaskEngine,
    TResourceEngine,
    TDialect extends MapperDialect = MapperDialect,
    TActorEngine = {},
    TLinkEngine = {},
  >(
    filename: string,
    mapper: EngineMapper<
      TGoalEngine,
      TTaskEngine,
      TResourceEngine,
      TDialect,
      TActorEngine,
      TLinkEngine
    >,
  ): GoalTree<TGoalEngine, TTaskEngine, TResourceEngine> {
    const model = Model.load(filename);
    return GoalTree.fromModel(model, mapper);
  }

  /**
   * Create a GoalTree from JSON string with a specific engine mapper
   */
  static fromJSON<
    TGoalEngine,
    TTaskEngine,
    TResourceEngine,
    TDialect extends MapperDialect = MapperDialect,
    TActorEngine = {},
    TLinkEngine = {},
  >(
    json: string,
    mapper: EngineMapper<
      TGoalEngine,
      TTaskEngine,
      TResourceEngine,
      TDialect,
      TActorEngine,
      TLinkEngine
    >,
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
  get nodes(): Array<TNode> {
    return this._nodes;
  }

  /** Get the root goal node */
  get root(): Extract<TNode, { type: 'goal' }> | undefined {
    return this._nodes.find(
      (node): node is Extract<TNode, { type: 'goal' }> =>
        node.type === 'goal' &&
        (node as { properties?: { root?: boolean } }).properties?.root === true,
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
  ): Array<TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>>;
  /** A mapper by kind's nodes of a type (goal-controller#215): its `as`. */
  static allByType<TNode extends QueryNode, K extends TNode['type']>(
    nodes: readonly TNode[],
    type: K,
  ): Array<Extract<TNode, { type: K }>>;
  static allByType(nodes: readonly QueryNode[], type: string): QueryNode[] {
    return _allByType(nodes as never, type as Type);
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
  ): Map<string, GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>>;
  static allGoalsMap<TNode extends QueryNode>(
    nodes: readonly TNode[],
  ): Map<string, Extract<TNode, { type: 'goal' }>>;
  static allGoalsMap(nodes: readonly QueryNode[]): Map<string, QueryNode> {
    return _allGoalsMap(nodes as never);
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
  ): Array<GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>>;
  static leafGoals<TNode extends QueryNode>(
    nodes: readonly TNode[],
  ): Array<Extract<TNode, { type: 'goal' }>>;
  static leafGoals(nodes: readonly QueryNode[]): QueryNode[] {
    return _leafGoals(nodes as never);
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
  ): string[];
  static contextVariables(nodes: readonly QueryNode[]): string[];
  static contextVariables(nodes: readonly QueryNode[]): string[] {
    return getContextVariables(nodes as never);
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
  ): string[];
  static taskAchievabilityVariables(nodes: readonly QueryNode[]): string[];
  static taskAchievabilityVariables(nodes: readonly QueryNode[]): string[] {
    return getTaskAchievabilityVariables(nodes as never);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────────────

  private createQueryInterface(): QueryOf<TNode> {
    const nodes = this._nodes as never;
    return {
      allByType: (type) => _allByType(nodes, type as Type) as never,
      allGoalsMap: () => _allGoalsMap(nodes) as never,
      leafGoals: () => _leafGoals(nodes) as never,
      contextVariables: () => getContextVariables(nodes),
      taskAchievabilityVariables: () => getTaskAchievabilityVariables(nodes),
    };
  }
}

// Re-export EngineMapper type
export type { EngineMapper } from './internal/creation';
