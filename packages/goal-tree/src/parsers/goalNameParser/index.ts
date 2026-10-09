import {
  goalNameParserFor,
  type GoalReading,
  type ReadingDialect,
} from '@goal-controller/goal-language';

export type {
  GoalNameParser,
  GoalReading as GoalDetail,
  ReadingDialect,
} from '@goal-controller/goal-language';

/**
 * A goal's text (`G1: Goal [G2;G3]`), read in the engine's dialect: goal-tree
 * derives the reader from the dialect (the goal language's
 * `goalNameParserFor`); engines write none.
 */
export const getGoalDetail = ({
  goalText,
  dialect,
  onSyntaxError,
}: {
  goalText: string;
  dialect: ReadingDialect;
  onSyntaxError?: (message: string) => void;
}): GoalReading => goalNameParserFor(dialect)({ goalText, onSyntaxError });
