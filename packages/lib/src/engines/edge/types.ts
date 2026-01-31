/**
 * Edge Engine Types
 * Types for EDGE/PRISM template engine properties
 */

import type { Dictionary } from 'lodash';

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

export type EdgeTaskProps = {
  execCondition?: ExecCondition;
  maxRetries: number;
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

