/**
 * Types for Goal Tree
 * These represent the goal tree structure after conversion from iStar model
 */

import type { Dictionary } from 'lodash';
import type { id } from './istar';

export type Relation = 'or' | 'and' | 'neededBy' | 'none';

export type Type = 'goal' | 'task' | 'resource';

export type GoalExecutionDetail = (
  | { type: 'interleaved'; interleaved: string[] }
  | { type: 'alternative'; alternative: string[] }
  | { type: 'sequence'; sequence: string[] }
  | { type: 'degradation'; degradationList: string[] }
  | { type: 'decisionMaking'; dm: string[] }
  | { type: 'choice' }
) & {
  retryMap?: Dictionary<number>;
};

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
