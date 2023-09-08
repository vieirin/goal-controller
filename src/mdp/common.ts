import { groupBy } from 'lodash';
import { goalRootId, leafGoals } from '../ObjectiveTree/utils';
import { GoalTree, Relation } from '../ObjectiveTree/types';

export type GrouppedGoals = ReturnType<typeof leavesGrouppedGoals>;
export const leavesGrouppedGoals = ({ gm }: { gm: GoalTree }) =>
  groupBy(leafGoals({ gm }), goalRootId);

export const separator = (relation: Relation | null) => {
  switch (relation) {
    case 'or':
      return ' | ';
    case 'and':
      return ' & ';
    default:
      throw new Error(`Relation "${relation}" not allowed`);
  }
};

export const negate = (s: string) => (s ? `!${s}` : s);
