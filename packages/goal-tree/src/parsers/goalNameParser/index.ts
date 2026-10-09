import type { GoalExecutionDetail } from '../../types/';

export type GoalDetail = {
  id: string;
  goalName: string;
  executionDetail: GoalExecutionDetail | null;
};

/**
 * How an engine reads a goal's text (`G1: Goal [G2;G3]`): its id, its name
 * and the construct its notation says. A syntax error goes to
 * `onSyntaxError` (by default, the console), and the text is read as far as
 * it goes. The engines' readers are built from their definitions (lib, with
 * the goal language): goal-tree knows no notation.
 */
export type GoalNameParser = (props: {
  goalText: string;
  onSyntaxError?: (message: string) => void;
}) => GoalDetail;

/** A goal's text, read by an engine's reader. */
export const getGoalDetail = ({
  goalText,
  grammar,
  onSyntaxError,
}: {
  goalText: string;
  grammar: GoalNameParser;
  onSyntaxError?: (message: string) => void;
}): GoalDetail => grammar({ goalText, onSyntaxError });
