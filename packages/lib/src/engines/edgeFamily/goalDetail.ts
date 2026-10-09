/**
 * How the Edge engines turn what a notation says (the goal language's
 * `readNotation`, in the engine's definition) into goal-tree's
 * `GoalExecutionDetail`. Both are legacy of RTRegex.g4's listeners, kept
 * because PRISM depends on them:
 *
 * - the cascade: when several constructs are written, the first of the
 *   engine's that has ids wins (a standalone construct: when written);
 * - the shape: a construct's ids go in a field named after it (degradation's
 *   is `degradationList`), and a construct a modifier applies to carries the
 *   modifier's arguments as `retryMap`.
 */
import type { WithNotation } from '@goal-controller/dialect';
import type {
  GoalDetail,
  GoalExecutionDetail,
} from '@goal-controller/goal-tree';
import {
  readNotation,
  type ElementLineData,
  type NotationReading,
} from '@goal-controller/goal-language';

/** The field a construct's ids go in (legacy: degradation's is `degradationList`). */
const listOf = (construct: string) =>
  construct === 'degradation' ? 'degradationList' : construct;

/** The construct that wins, in goal-tree's shape. */
const executionDetail = (
  { notation }: WithNotation,
  cascade: readonly string[],
  said: NotationReading,
): GoalExecutionDetail | null => {
  for (const construct of cascade) {
    if (said.standalone.has(construct))
      return { type: construct } as GoalExecutionDetail;
    const ids = said.constructs.get(construct);
    if (!ids?.length) continue;
    const retryMap = Object.assign(
      {},
      ...Object.entries(notation.modifiers ?? {})
        .filter(([, modifier]) => modifier.appliesTo.includes(construct))
        .map(([name]) => said.modifiers.get(name) ?? {}),
    );
    return {
      type: construct,
      [listOf(construct)]: ids,
      ...(Object.keys(retryMap).length ? { retryMap } : {}),
    } as GoalExecutionDetail;
  }
  return null;
};

/** An Edge engine's reading of an element line, by its cascade. */
export const edgeGoalDetail = (
  definition: WithNotation,
  cascade: readonly string[],
  line: ElementLineData | null,
): GoalDetail => ({
  id: line?.id ?? '',
  goalName: (line?.name ?? '').trim(),
  executionDetail: executionDetail(
    definition,
    cascade,
    readNotation(definition, line?.notation ?? null),
  ),
});

/** Which construct wins when several are written: EdgeV2's (RTRegex.g4's listener). */
export const EDGE_V2_CASCADE = [
  'degradation',
  'sequence',
  'anyOrder',
  'alternative',
  'interleaved',
  'choice',
] as const;

/** Edge's (v1: no any order; a choice is a standalone `+`). */
export const EDGE_CASCADE = [
  'degradation',
  'sequence',
  'alternative',
  'interleaved',
  'choice',
] as const;
