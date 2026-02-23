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

export type SleecTaskProps = {
  PreCond?: string;
  TriggeringEvent?: string;
  TemporalConstraint?: string;
  PostCond?: string;
  Obstacle?: string;
};
