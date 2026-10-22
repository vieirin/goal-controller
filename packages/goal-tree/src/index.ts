/**
 * Goal Tree SDK
 *
 * A class-based SDK for working with iStar goal models. This package provides tools
 * for parsing iStar models, transforming them into goal trees with custom engine properties,
 * and querying the resulting tree structures.
 *
 * ## Key Concepts
 *
 * ### Instance Methods vs Static Methods
 * - **Instance methods** (via `tree.query.*`): Use when you have a GoalTree instance
 * - **Static methods** (via `GoalTree.*`): Use when working with raw node arrays
 *
 * ### Query Interface
 * The `tree.query` interface provides convenient access to tree traversal operations:
 * - `allByType()` - Get nodes by type (goal, task, or resource)
 * - `allGoalsMap()` - Get a map of goal IDs to nodes
 * - `leafGoals()` - Get goals that have tasks
 * - `contextVariables()` - Extract variables from execution conditions
 * - `taskAchievabilityVariables()` - Get task achievability variable names
 *
 * ### Types from the mapper
 * A mapper's nodes and model are typed by kind (goal-controller#215):
 * `NodeOf<typeof mapper>`, `ModelOf<typeof mapper>`, and
 * `EngineProps<typeof mapper>`, each kind's engine properties.
 *
 * @example
 * ```typescript
 * import {
 *   GoalTree,
 *   Node,
 *   Model,
 *   createEngineMapper,
 *   useIstarDefaultNaming,
 * } from '@goal-controller/goal-tree';
 *
 * // Define an engine mapper, an entry per kind: each is given the properties
 * // its kind has in the dialect, typed (`props`) and as written (`raw`)
 * const myMapper = createEngineMapper({
 *   dialect: myDefinition, // goal texts and properties are read in it
 *   naming: useIstarDefaultNaming(), // iStar's goals, tasks and resources
 *   elements: (entry) => [
 *     entry({
 *       kinds: ['istar.Goal', 'istar.Quality'],
 *       mapProps: ({ raw }) => ({ utility: raw.utility ?? '' }),
 *     }),
 *     entry({
 *       kind: 'istar.Task',
 *       mapProps: ({ props }) => ({ retries: props.maxRetries ?? 0 }),
 *     }),
 *   ],
 *   ignore: ['istar.Resource'],
 * });
 *
 * // Create a tree from a file with your engine
 * const tree = GoalTree.fromFile('model.json', myMapper);
 *
 * // Query operations using instance methods (preferred)
 * const allGoals = tree.query.allByType('goal');
 * const leafGoals = tree.query.leafGoals();
 *
 * // Static methods for raw arrays
 * const tasks = GoalTree.allByType(tree.nodes, 'task');
 *
 * // Node utilities
 * if (Node.isGoal(node)) {
 *   const children = Node.children(node);
 * }
 *
 * // Model utilities (piStar files are parsed with @istar-ts/core)
 * const model = Model.load('file.json'); // validated; roots resolved from the link graph
 *
 * // The typed IR (goal-controller#125): actors holding a tree per root goal, every link
 * const goalModel = GoalTree.goalModel(model, myMapper);
 * const checked = Model.validate(parsePistar(json));
 * ```
 */

// ─────────────────────────────────────────────────────────────────────────────
// Main SDK Classes
// ─────────────────────────────────────────────────────────────────────────────

export { GoalTree, createEngineMapper, type QueryOf } from './GoalTree';

// ─────────────────────────────────────────────────────────────────────────────
// Mappers by kind (goal-controller#215)
// ─────────────────────────────────────────────────────────────────────────────

export {
  useIstarDefaultNaming,
  type AfterCreationInput,
  type ElementInput,
  type ElementKindsOf,
  type EngineNaming,
  type EngineProps,
  type EntriesFor,
  type EntryFn,
  type KindEngineMapper,
  type LinkEntryFn,
  type LinkInput,
  type LinkKindsOf,
  type ModelOf,
  type NamingReading,
  type NodeOf,
} from './internal/entries';
export type {
  IstarNaming,
  IstarProps,
  KindModel,
  KindModelActor,
  KindModelLink,
  KindNode,
  KindProps,
  ModelElement,
  ModelRefinement,
  Naming,
  Shape,
} from './types/kindTree';
export { Model, type ModelNamespace } from './Model';
export { openClosures, type OpenClosure } from './internal/closures';
export {
  modelShapeProblem,
  refinementsOf,
  type Refinement,
  type RootReading,
} from './internal/roots';
export { Node, type NodeNamespace } from './Node';
export {
  goalView,
  type GoalView,
  type GoalViewNode,
  type ViewActor,
  type ViewConstruct,
  type ViewKind,
  type LinkEnd,
  type ViewLink,
} from './view';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
  // iStar types
  Actor,
  Model as IStarModel,
  AnyModel,
  ForeignElementKind,
  FrameworkOf,
  ModelFor,
  Node as IStarNode,
  Link,
  NodeType,
  // Goal Tree types
  Relation,
  TraversalNode,
  TraversalParent,
  Type,
} from './types/';

// ─────────────────────────────────────────────────────────────────────────────
// Property types for engine mappers
// ─────────────────────────────────────────────────────────────────────────────

export type { GoalExecutionDetail } from './internal/creation';
export type {
  ActorPropsInput,
  LinkPropsInput,
  MapperDialect,
  PropsOf,
} from './internal/engineMapper';

// ─────────────────────────────────────────────────────────────────────────────
// Internal utilities (exported for advanced use cases)
// ─────────────────────────────────────────────────────────────────────────────

export { cartesianProduct } from './internal/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Parsers (for engine mappers)
// ─────────────────────────────────────────────────────────────────────────────

export {
  getGoalDetail,
  type GoalDetail,
  type GoalNameParser,
  type ReadingDialect,
} from './parsers/goalNameParser';
