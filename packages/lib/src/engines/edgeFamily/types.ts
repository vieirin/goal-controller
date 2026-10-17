/**
 * What the Edge engines' mappers make of an element's properties, the same in
 * edge and edgeV2 (each engine's types.ts re-exports them).
 */

/** A condition as the templates write it: its text as written, and the names it reads. */
export type Condition = {
  sentence: string;
  variables: Array<{ name: string; value: boolean | null }>;
};

export type ExecCondition = {
  maintain?: Condition;
  assertion: Condition;
};

export type Decision = {
  decisionVars: Array<{ variable: string; space: number }>;
  hasDecision: boolean;
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

export type EdgeTaskProps = {
  execCondition?: ExecCondition;
  maxRetries: number;
  /** reward on completion ("utility" reward structure), as written in the model */
  utility: string;
  /** reward on pursuit ("cost" reward structure), as written in the model */
  cost: string;
};
