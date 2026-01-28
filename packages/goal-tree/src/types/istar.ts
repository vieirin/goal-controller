/**
 * Types for iStar models (from piStar tool)
 * These represent the raw model structure before conversion to goal tree
 */

export type id = string;

export type NodeType =
  | 'istar.Task'
  | 'istar.Goal'
  | 'istar.Actor'
  | 'istar.Resource'
  | 'istar.Quality';

export type CustomPropertiesData = {
  Description?: string;
  root?: string;
  cost?: string;
  alt?: string;
  utility?: string;
  dependsOn?: string;
  variables?: string;
  uniqueChoice?: string;
  type?: string;
  maxRetries?: string;
  selected?: string;
  PreCond?: string;
  TriggeringEvent?: string;
  TemporalConstraint?: string;
  PostCond?: string;
  ObstacleEvent?: string;
  // Resource-specific properties
  initialValue?: string;
  lowerBound?: string;
  upperBound?: string;
  // Maintain/assertion properties
  maintain?: string;
  assertion?: string;
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
  // Allow additional string properties
  [key: string]: string | undefined;
};

export type CustomProperties = {
  customProperties: CustomPropertiesData;
};

export type Node = {
  id: id;
  text: string;
  type: NodeType;
  x: number;
  y: number;
} & CustomProperties;

export type Actor = {
  nodes: Node[];
} & Node;

export type Link = {
  id: id;
  type:
    | 'istar.AndRefinementLink'
    | 'istar.OrRefinementLink'
    | 'istar.NeededByLink'
    | 'istar.QualificationLink';
  source: string;
  target: string;
};

export type Display = Record<string, DisplayItem>;

export type DisplayItem = {
  backgroundColor: string;
  width?: number;
  height?: number;
};

export type Diagram = {
  width: number;
  height: number;
} & CustomProperties;

export type Model = {
  actors: Actor[];
  orphans: never[];
  dependencies: never[];
  links: Link[];
  display: Display;
  tool: string;
  istar: string;
  saveDate: Date;
  diagram: Diagram;
};
