import type { Dictionary } from 'lodash';

export type id = string;

interface Model {
  actors: Actor[];
  orphans: never[];
  dependencies: never[];
  links: Link[];
  display: Display;
  tool: string;
  istar: string;
  saveDate: Date;
  diagram: Diagram;
}

interface Actor extends Node {
  nodes: Node[];
}

type NodeType = 'istar.Task' | 'istar.Goal' | 'istar.Actor' | 'istar.Resource';

interface Node extends CustomProperties {
  id: id;
  text: string;
  type: NodeType;
  x: number;
  y: number;
}

interface Link {
  id: id;
  type:
    | 'istar.AndRefinementLink'
    | 'istar.OrRefinementLink'
    | 'istar.NeededByLink';
  source: string;
  target: string;
}

interface Display {
  [K: string]: DisplayItem;
}

interface DisplayItem {
  backgroundColor: string;
  width?: number;
  height?: number;
}

interface Diagram extends CustomProperties {
  width: number;
  height: number;
}

interface ExecCondition {
  maintain?: {
    sentence: string;
    variables: { name: string; value: boolean | null }[];
  };
  assertion: {
    sentence: string;
    variables: { name: string; value: boolean | null }[];
  };
}

interface Resource extends GoalNode {
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
}

interface CustomProperties {
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
}

type Relation = 'or' | 'and' | 'neededBy' | 'none';
type Type = 'goal' | 'task' | 'resource';
type Decision = {
  decisionVars: { variable: string; space: number }[];
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
