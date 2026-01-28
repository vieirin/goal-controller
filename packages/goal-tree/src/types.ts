import type { Dictionary } from 'lodash';

export type id = string;

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

export type Actor = {
  nodes: Node[];
} & Node;

export type NodeType =
  | 'istar.Task'
  | 'istar.Goal'
  | 'istar.Actor'
  | 'istar.Resource'
  | 'istar.Quality';

export type Node = {
  id: id;
  text: string;
  type: NodeType;
  x: number;
  y: number;
} & CustomProperties;

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

export type Resource = {
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
} & GoalNode;

export type CustomProperties = {
  customProperties: {
    Description: '';
    root?: string;
    cost: string;
    alt?: string;
    utility: string;
    dependsOn?: string;
    variables?: string;
    uniqueChoice?: string;
    type: never;
    maxRetries?: string;
    selected?: string;
    PreCond?: string;
    TriggeringEvent?: string;
    TemporalConstraint?: string;
    PostCond?: string;
    ObstacleEvent?: string;
  } & {
    type: 'maintain';
    maintain: string;
    assertion: string;
  };
};

export type Relation = 'or' | 'and' | 'neededBy' | 'none';
export type Type = 'goal' | 'task' | 'resource';
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

export type GoalNode = {
  iStarId: id;
  id: string;
  type: Type;
  relationToParent: Relation | null;
  relationToChildren: Relation | null;
  name: string | null;
  children?: GoalNode[];
  variantOf?: string;
  dependsOn?: GoalNode[];
  properties: {
    utility: string;
    cost: string;
    root: boolean | undefined;
    maxRetries: number | undefined;
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
    };
  };
  resources: Resource[];
  tasks?: GoalNode[];
  sleecProps?: SleecProps;
};

export type GoalNodeWithParent = GoalNode & {
  parent: GoalNode[];
  children?: GoalNodeWithParent[];
};

export type GenericGoal = GoalNode | GoalNodeWithParent;

export type GoalTreeWithParent = GoalNodeWithParent[];
export type GoalTree = GoalNode[];
export type GenericTree = GenericGoal[];
