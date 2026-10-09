import type { GoalExecutionDetail as TreeExecutionDetail } from '@goal-controller/goal-tree';
/**
 * Edge Engine Types
 * Types for EDGE/PRISM template engine properties
 */

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

/** goal-tree's: `{ type, ids, modifiers }` (the construct, its operands, `modifiers.retry`) */
export type GoalExecutionDetail = TreeExecutionDetail;

export type EdgeTaskProps = {
  execCondition?: ExecCondition;
  maxRetries: number;
  /** reward on completion ("utility" reward structure), as written in the model */
  utility: string;
  /** reward on pursuit ("cost" reward structure), as written in the model */
  cost: string;
};

// Forward reference type - will be resolved when GoalNode is generic
export type EdgeGoalProps<TGoalNode = unknown> = {
  utility: string;
  cost: string;
  dependsOn: TGoalNode[];
  executionDetail: GoalExecutionDetail | null;
  execCondition?: ExecCondition;
  decision: Decision;
  maxRetries: number;
};

// Resource variable types for Edge engine
export type EdgeResourceVariable =
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

// Resource properties for Edge engine
export type EdgeResourceProps = {
  variable: EdgeResourceVariable;
};

// Re-export mapper types for convenience
export type {
  EdgeGoalNode,
  EdgeTask,
  EdgeResource,
  EdgeGoalTree,
  EdgeGoalPropsResolved,
} from './mapper';
