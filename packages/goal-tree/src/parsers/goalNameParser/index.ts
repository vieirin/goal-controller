import type { GoalExecutionDetail } from '../../types/';
import { getGoalDetail as getEdgeGoalDetail } from './edge';
import { getGoalDetail as getEdgeLangiumGoalDetail } from './edgeLangium';
import { getGoalDetail as getEdgeV2GoalDetail } from './edgeV2';

export type GoalDetail = {
  id: string;
  goalName: string;
  executionDetail: GoalExecutionDetail | null;
};

/**
 * RT notation grammar used to parse goal names (e.g. `G1: Goal [G2;G3]`).
 * Each grammar is generated from packages/lib/grammar/<grammar>/RTRegex.g4
 * into src/antlr/<grammar>/.
 *
 * - `edge`: original notation, choice is a standalone `+`
 * - `edgeV2`: choice is `G1?G2`, `+` is the any-order operator `G1+G2`
 * - `edgeLangium`: edgeV2's notation read by the Langium grammar of
 *   @goal-controller/rt-language (the one the notation editor uses)
 */
export type RTGrammar = 'edge' | 'edgeV2' | 'edgeLangium';

export const DEFAULT_RT_GRAMMAR: RTGrammar = 'edge';

const goalDetailParsers: Record<
  RTGrammar,
  (props: {
    goalText: string;
    onSyntaxError?: (message: string) => void;
  }) => GoalDetail
> = {
  edge: getEdgeGoalDetail,
  edgeV2: getEdgeV2GoalDetail,
  edgeLangium: getEdgeLangiumGoalDetail,
};

export const getGoalDetail = ({
  goalText,
  grammar = DEFAULT_RT_GRAMMAR,
  onSyntaxError,
}: {
  goalText: string;
  grammar?: RTGrammar;
  /** receives syntax errors instead of the console */
  onSyntaxError?: (message: string) => void;
}): GoalDetail => goalDetailParsers[grammar]({ goalText, onSyntaxError });
