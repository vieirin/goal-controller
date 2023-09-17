import { groupBy } from 'lodash';
import { goalRootId, leafGoals } from '../ObjectiveTree/utils';
import { GoalTree, Model, Relation } from '../ObjectiveTree/types';

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

export const formulaForGoal = (goalId: string) =>
  `${goalRootId({ id: goalId })}_achieved_or_pursued`;

export const not = (s: string) => (s ? `!${s}` : s);
export const parenthesis = (s: string) => (s ? `(${s})` : s);

export const achieved = (goalId: string) => `${goalId}_achieved`;
export const achievable = (goalId: string) => `${goalId}_achievable`;
export const pursued = (goalId: string) => `${goalId}_pursued`;
export const achievedOrPursued = (goalId: string) =>
  pursued(`${achieved(goalId)}_or`);
export const pursue = (goalId: string) => `${goalId}_pursue`;
export const pursueDefault = (goalId: string) => `${goalId}_pursue0`;
export const skip = (goalId: string) => `${goalId}_skip`;

export const equals = (operand: string, value: string | number) =>
  `${operand}=${value}`;
export const greaterThan = (goal: string, than: number) => `${goal}>${than}`;
