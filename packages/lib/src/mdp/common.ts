import type { Relation } from '@goal-controller/goal-tree';
import { Node } from '@goal-controller/goal-tree';

export const separator = (relation: Relation | null): string => {
  switch (relation) {
    case 'or':
      return ' | ';
    case 'and':
      return ' & ';
    default:
      throw new Error(`Relation "${relation}" not allowed`);
  }
};

export const formulaForGoal = (goalId: string): string =>
  `${Node.rootId(goalId)}_achieved_or_pursued`;

export const not = (s: string): string => (s ? `!${s}` : s);
export const parenthesis = (s: string): string => (s ? `(${s})` : s);

export const achieved = (goalId: string): string => `${goalId}_achieved`;
export const achievable = (goalId: string): string => `${goalId}_achievable`;
export const pursued = (goalId: string): string => `${goalId}_pursued`;
export const achievedOrPursued = (goalId: string): string =>
  pursued(`${achieved(goalId)}_or`);
export const pursue = (goalId: string): string => `${goalId}_pursue`;
export const pursueThrough = (goalId: string, through: string): string =>
  `pursue${goalId}_${through}`;
export const pursueDefault = (goalId: string): string => `${goalId}_pursue0`;
export const skip = (goalId: string): string => `${goalId}_skip`;

export const failed = (goalId: string): string => `${goalId}_failed`;

export const OR = (elements: string[]): string =>
  elements.join(separator('or'));
export const AND = (elements: string[]): string =>
  elements.join(separator('or'));

export const equals = (operand: string, value: string | number): string =>
  `${operand}=${value}`;
export const greaterThan = (goal: string, than: number): string =>
  `${goal}>${than}`;
