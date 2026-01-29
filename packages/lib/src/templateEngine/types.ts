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
