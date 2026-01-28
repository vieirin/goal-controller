/**
 * Types for Goal Tree
 * These represent the goal tree structure after conversion from iStar model
 */

import type { Dictionary } from 'lodash';
import type { id } from './istar';

export type Relation = 'or' | 'and' | 'neededBy' | 'none';

export type Type = 'goal' | 'task' | 'resource';

export type ExecCondition = {
  maintain?: {
    sentence: string;
    variables: Array<{ name: string; value: boolean | null }>;
  };
  assertion: {
    sentence: string;
    variables: Array<{ name: string; value: boolean | null }>;
  };
};

export type Decision = {
  decisionVars: Array<{ variable: string; space: number }>;
  hasDecision: boolean;
};

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

export type SleecProps = {
  Type?: string;
  Source?: string;
  Class?: string;
  NormPrinciple?: string;
  Proxy?: string;
  AddedValue?: string;
  Condition?: string;
  Event?: string;
  ContextEvent?: string;
};

export type BaseNode = {
  iStarId: id;
  id: string;
  type: Type;
  relationToParent: Relation | null;
  relationToChildren: Relation | null;
  name: string | null;
};

export type Task = BaseNode & {
  type: 'task';
  tasks: Task[];
  resources: Resource[];
  properties: {
    PreCond?: string;
    TriggeringEvent?: string;
    TemporalConstraint?: string;
    PostCond?: string;
    ObstacleEvent?: string;
    edge: {
      execCondition?: ExecCondition;
      maxRetries: number;
    };
    [key: string]: any;
  };
};

export type GoalNode = BaseNode & {
  type: 'goal';
  /** Goal children - only GoalNodes, not Tasks (tasks are in the tasks property) */
  children?: GoalNode[];
  variantOf?: string;
  dependsOn?: GoalNode[];
  properties: {
    utility: string;
    cost: string;
    root?: boolean;
    uniqueChoice: boolean;
    isQuality: boolean;
    PreCond?: string;
    TriggeringEvent?: string;
    TemporalConstraint?: string;
    PostCond?: string;
    ObstacleEvent?: string;
    // Resource-specific properties (raw values from iStar model)
    type?: string;
    initialValue?: string;
    lowerBound?: string;
    upperBound?: string;
    edge: {
      dependsOn: string[];
      executionDetail: GoalExecutionDetail | null;
      execCondition?: ExecCondition;
      decision: Decision;
      maxRetries: number;
    };
    [key: string]: any;
  };
  /** Task children - leaf goals have tasks */
  tasks?: Task[];
  sleecProps?: SleecProps;
};

export type Resource = BaseNode & {
  type: 'resource';
  variable:
    | {
        type: 'boolean';
        initialValue: boolean;
      }
    | {
        type: 'int';
        initialValue: number;
        lowerBound: number;
        upperBound: number;
      };
};

export type GoalNodeWithParent = GoalNode & {
  parent: GoalNode[];
  children?: GoalNodeWithParent[];
};

export type TreeNode = GoalNode | Task | Resource;
export type GenericGoal = GoalNode | GoalNodeWithParent;
export type GenericTreeNode = TreeNode | GoalNodeWithParent;

export type GoalTree = TreeNode[];
export type GoalTreeWithParent = GoalNodeWithParent[];
export type GenericTree = GenericTreeNode[];
