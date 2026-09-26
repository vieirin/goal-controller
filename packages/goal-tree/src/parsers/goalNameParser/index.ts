import type { GoalExecutionDetail } from '../../types/';
import { getGoalDetail as getEdgeGoalDetail } from './edge';
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
 */
export type RTGrammar = 'edge' | 'edgeV2';

export const DEFAULT_RT_GRAMMAR: RTGrammar = 'edge';

const goalDetailParsers: Record<
  RTGrammar,
  (props: { goalText: string }) => GoalDetail
> = {
  edge: getEdgeGoalDetail,
  edgeV2: getEdgeV2GoalDetail,
};

export const getGoalDetail = ({
  goalText,
  grammar = DEFAULT_RT_GRAMMAR,
}: {
  goalText: string;
  grammar?: RTGrammar;
}): GoalDetail => goalDetailParsers[grammar]({ goalText });
