/**
 * SLEEC Engine Types
 * Types for SLEEC template engine properties
 */

export type SleecGoalProps = {
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

/** A task's properties: the mapper throws for a task missing one of the four required. */
export type SleecTaskProps = {
  PreCond: string;
  TriggeringEvent: string;
  TemporalConstraint: string;
  PostCond: string;
  Obstacle?: string;
};
