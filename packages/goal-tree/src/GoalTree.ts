/**
 * GoalTree SDK - Main class for working with goal trees
 */
import { readFileSync } from 'fs';
import { convertToTree, type EngineMapper } from './internal/creation';
import {
  allByType as _allByType,
  allGoalsMap as _allGoalsMap,
  leafGoals as _leafGoals,
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
    model: Model,
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
    const modelFile = readFileSync(filename);
    const model = parseModel(modelFile.toString());
    return GoalTree.fromModel(model, mapper);
  }

  /**
   * Create a GoalTree from JSON string with a specific engine mapper
   */
  static fromJSON<TGoalEngine, TTaskEngine, TResourceEngine>(
    json: string,
    mapper: EngineMapper<TGoalEngine, TTaskEngine, TResourceEngine>,
  ): GoalTree<TGoalEngine, TTaskEngine, TResourceEngine> {
    const model = parseModel(json);
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

  /** Print the tree structure to console (for debugging) */
  print(): void {
    let level = 1;
    // eslint-disable-next-line no-console
    console.log(this._nodes);
    const firstNode = this._nodes[0];
    let children = firstNode?.type === 'goal' ? firstNode.children : undefined;
    while ((children?.length ?? 0) > 0) {
      const newChildren: Array<
        GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>
      > = [];
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

  /** Get a map of all goals from a tree array */
  static allGoalsMap<TGoalEngine, TTaskEngine, TResourceEngine>(
    nodes: GoalTreeArray<TGoalEngine, TTaskEngine, TResourceEngine>,
  ): Map<string, GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>> {
    return _allGoalsMap(nodes);
  }

  /** Get leaf goals from a tree array */
  static leafGoals<TGoalEngine, TTaskEngine, TResourceEngine>(
    nodes: GoalTreeArray<TGoalEngine, TTaskEngine, TResourceEngine>,
  ): Array<GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>> {
    return _leafGoals(nodes);
  }

  /** Get context variables from a tree array */
  static contextVariables<TGoalEngine, TTaskEngine, TResourceEngine>(
    nodes: GoalTreeArray<TGoalEngine, TTaskEngine, TResourceEngine>,
  ): string[] {
    return getContextVariables(nodes);
  }

  /** Get task achievability variables from a tree array */
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

// ─────────────────────────────────────────────────────────────────────────────
// Model Parsing and Validation (used internally)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Type guard to check if a value is a valid Model structure.
 */
function isModel(value: unknown): value is Model {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  // Check for required properties using 'in' operator
  if (!('actors' in value) || !('links' in value)) {
    return false;
  }

  // After 'in' checks, we can safely access these properties
  // TypeScript narrows to { actors: unknown; links: unknown }
  return Array.isArray(value.actors) && Array.isArray(value.links);
}

/**
 * Parse JSON string and validate it as a Model.
 * Uses type guard to avoid 'as' type assertion.
 */
function parseModel(json: string): Model {
  const parsed: unknown = JSON.parse(json);

  if (!isModel(parsed)) {
    throw new Error('Invalid model: missing or invalid actors or links');
  }

  validateModel(parsed);
  return parsed;
}

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
