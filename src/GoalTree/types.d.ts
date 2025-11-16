import type { Dictionary } from 'lodash';

export type id = string;

type Model = {
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

type Actor = {
  nodes: Node[];
} & Node;

type NodeType = 'istar.Task' | 'istar.Goal' | 'istar.Actor' | 'istar.Resource';

type Node = {
  id: id;
  text: string;
  type: NodeType;
  x: number;
  y: number;
} & CustomProperties;

type Link = {
  id: id;
  type:
    | 'istar.AndRefinementLink'
    | 'istar.OrRefinementLink'
    | 'istar.NeededByLink';
  source: string;
  target: string;
};

type Display = Record<string, DisplayItem>;

type DisplayItem = {
  backgroundColor: string;
  width?: number;
  height?: number;
};

type Diagram = {
  width: number;
  height: number;
} & CustomProperties;

type ExecCondition = {
  maintain?: {
    sentence: string;
    variables: Array<{ name: string; value: boolean | null }>;
  };
  assertion: {
    sentence: string;
    variables: Array<{ name: string; value: boolean | null }>;
  };
};

type Resource = {
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

type CustomProperties = {
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
  } & {
    type: 'maintain';
    maintain: string;
    assertion: string;
  };
};

type Relation = 'or' | 'and' | 'neededBy' | 'none';
type Type = 'goal' | 'task' | 'resource';
type Decision = {
  decisionVars: Array<{ variable: string; space: number }>;
  hasDecision: boolean;
};
type GoalExecutionDetail = (
  | { type: 'interleaved'; interleaved: string[] }
  | { type: 'alternative'; alternative: string[] }
  | { type: 'sequence'; sequence: string[] }
  | { type: 'degradation'; degradationList: string[] }
  | { type: 'decisionMaking'; dm: string[] }
  | { type: 'choice' }
) & {
  retryMap?: Dictionary<number>;
};

type GoalNode = {
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
    dependsOn: string[];
    uniqueChoice: boolean;
    maxRetries: number | undefined;
    [k: string]: any;
  };
  resources: Resource[];
  tasks?: GoalNode[];
  executionDetail: GoalExecutionDetail | null;
  execCondition?: ExecCondition;
} & Decision;

type GoalNodeWithParent = GoalNode & {
  parent: GoalNode[];
  children?: GoalNodeWithParent[];
};

type GenericGoal = GoalNode | GoalNodeWithParent;

type GoalTreeWithParent = GoalNodeWithParent[];
type GoalTree = GoalNode[];
type GenericTree = GenericGoal[];
