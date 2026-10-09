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
  id: string;
  type: Type;
  relationToChildren: Relation | null;
  name: string | null;
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
