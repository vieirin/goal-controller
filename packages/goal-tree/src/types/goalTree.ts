/**
 * Types for Goal Tree
 * These represent the goal tree structure after conversion from iStar model
 */

import type { ExecutionDetail } from '@goal-controller/goal-language';
import type { id } from './istar';

export type Relation = 'or' | 'and' | 'neededBy' | 'none';

export type Type = 'goal' | 'task' | 'resource';

/**
 * What a goal's notation makes it do (the goal language's reading, in the
 * engine's dialect): its construct, its operands' ids in the order written,
 * and the arguments of the modifiers that apply (`{ retry: { G2: 3 } }`).
 */
export type GoalExecutionDetail = ExecutionDetail;

export type BaseNode = {
  iStarId: id;
  /**
   * the element's horizontal position in the diagram (piStar's absolute x):
   * an engine may order siblings by it (MutRoSe's decomposer does); absent
   * in a tree built without a diagram
   */
  x?: number;
  id: string;
  type: Type;
  /**
   * its kind, in a framework besides iStar 2.0 (goal-controller#171: KAOS's
   * `kaos.DomainProperty`), where `type` says only how a tree holds it
   */
  kind?: string;
  relationToChildren: Relation | null;
  name: string | null;
  /** the piStar id of the actor it is in (goal-controller#125; none: a dependum, outside every actor) */
  actor?: id;
};

export type Task<TEngine = unknown, TResourceEngine = unknown> = BaseNode & {
  type: 'task';
  tasks: Array<Task<TEngine, TResourceEngine>>;
  resources: Array<Resource<TResourceEngine>>;
  properties: {
    engine: TEngine;
  };
};

export type GoalNode<
  TGoalEngine = unknown,
  TTaskEngine = unknown,
  TResourceEngine = unknown,
> = BaseNode & {
  type: 'goal';
  /** Goal children - only GoalNodes, not Tasks (tasks are in the tasks property) */
  children?: Array<GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>>;
  properties: {
    root?: boolean;
    isQuality: boolean;
    engine: TGoalEngine;
  };
  /** Task children - leaf goals have tasks */
  tasks?: Array<Task<TTaskEngine, TResourceEngine>>;
};

export type Resource<TEngine = unknown> = BaseNode & {
  type: 'resource';
  properties: {
    engine: TEngine;
  };
};

export type TreeNode<
  TGoalEngine = unknown,
  TTaskEngine = unknown,
  TResourceEngine = unknown,
> =
  | GoalNode<TGoalEngine, TTaskEngine, TResourceEngine>
  | Task<TTaskEngine, TResourceEngine>
  | Resource<TResourceEngine>;

export type GoalTree<
  TGoalEngine = unknown,
  TTaskEngine = unknown,
  TResourceEngine = unknown,
> = Array<TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>>;

/**
 * An actor of the IR (goal-controller#125): its trees, one per root (an
 * unrefined element: `actorRoots`), its properties as the engine maps them
 * (`mapActorProps`), and its elements' piStar ids in the model's order.
 */
export type GoalModelActor<
  TActorEngine = unknown,
  TGoalEngine = unknown,
  TTaskEngine = unknown,
  TResourceEngine = unknown,
> = {
  id: id;
  name: string;
  /** `istar.Actor`, `istar.Agent`, `istar.Role` or an extension's actor kind */
  kind: string;
  properties: { engine: TActorEngine };
  trees: Array<TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>>;
  elements: id[];
};

/**
 * A link of the IR: every link of the model, refinement links included, its
 * `relation` as a refinement reads it (none: not a refinement), and its
 * properties as the engine maps them (`mapLinkProps`).
 */
export type GoalModelLink<TLinkEngine = unknown> = {
  id: id;
  kind: string;
  source: id;
  target: id;
  relation: 'and' | 'or' | 'neededBy' | null;
  /** iStar's contribution value (`make`, `help`, `hurt`, `break`), when it has one */
  label?: string;
  properties: { engine: TLinkEngine };
};

/**
 * An element of the model as it is written, whatever its kind: what a tree
 * doesn't hold (an extension's kind, a Quality outside every tree) is here
 * too. `properties`: its custom properties, as strings.
 */
export type GoalModelElement = {
  id: id;
  kind: string;
  name: string;
  /** the actor it is in; none: a dependum, outside every actor */
  actor?: id;
  properties: Record<string, string>;
};

/**
 * The typed IR (goal-controller#125): the model's actors, each holding its
 * trees; every link; the dependums (outside every actor, each a node); and
 * every element in the model's order.
 */
export type GoalModel<
  TGoalEngine = unknown,
  TTaskEngine = unknown,
  TResourceEngine = unknown,
  TActorEngine = unknown,
  TLinkEngine = unknown,
> = {
  actors: Array<
    GoalModelActor<TActorEngine, TGoalEngine, TTaskEngine, TResourceEngine>
  >;
  links: Array<GoalModelLink<TLinkEngine>>;
  dependums: Array<TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>>;
  /**
   * the trees on the paper, outside every actor (goal-controller#171): a
   * framework without actors (KAOS, NFR) has all its trees here, one per
   * element no refinement makes a child; an iStar model none
   */
  paper: Array<TreeNode<TGoalEngine, TTaskEngine, TResourceEngine>>;
  elements: GoalModelElement[];
};
