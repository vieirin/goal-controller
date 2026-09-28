/**
 * Types for iStar models (piStar save files), provided by @istar-ts/core.
 * These represent the model structure before conversion to goal tree.
 */
import type {
  IstarActor,
  IstarElement,
  IstarLink,
  IstarModel,
  NodeKind,
} from '@istar-ts/core';

export type id = string;

/** Kinds of intentional elements that can appear in a goal tree */
export type NodeType = NodeKind;

/** Custom properties this project reads from goal-model elements (values are strings, as piStar stores them) */
export type CustomPropertiesData = {
  // common
  Description?: string;
  root?: string;

  // EDGE goal/task properties
  maxRetries?: string;

  // EDGE goal properties
  cost?: string;
  utility?: string;
  dependsOn?: string;
  variables?: string;
  type?: string;

  // EDGE Goal properties: Maintain/assertion properties
  maintain?: string;
  assertion?: string;

  // SLEEC Task properties
  PreCond?: string;
  TriggeringEvent?: string;
  TemporalConstraint?: string;
  PostCond?: string;
  ObstacleEvent?: string;

  // SLEEC properties
  Type?: string;
  Source?: string;
  Class?: string;
  NormPrinciple?: string;
  Proxy?: string;
  AddedValue?: string;
  Condition?: string;
  Event?: string;
  ContextEvent?: string;

  // Resource-specific properties
  initialValue?: string;
  lowerBound?: string;
  upperBound?: string;

  // Allow additional string properties
  [key: string]: string | undefined;
};

export type Node = IstarElement;

export type Actor = IstarActor;

export type Link = IstarLink;

export type Model = IstarModel;
