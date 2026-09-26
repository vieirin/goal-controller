import type { EdgeGoalNode } from '../../../../types';
import { getLogger } from '../../../../logger/logger';
import {
  achievedFormula,
  chosenVariable,
  stateVariable,
} from '../../../../template/common';
import { construct, orderedChildIds, retriedChildren } from './children';
import { hasFailedLessThanNTimes } from './pursue/common';
import { retriesExhausted } from './pursue/orGoal';
import {
  childShouldPursue,
  childrenIdle,
  joinGuards,
  parentShouldSkip,
  shouldSkip,
} from './pursue/decisionGuards';

/**
 * Skip lines (reference constructs), all ending in -> (g0_state'=0):
 *   sequence / anyOrder / alternative:
 *     !g0_achieved & g0_state=1 & <children idle> & G0_achievable*N <= decision_G0
 *   interleaved (and AND goals without notation):
 *     !g0_achieved & g0_state=1 & <children idle> & !(G1_achievable*N > decision_G1 | …)
 *   choice: uncommitted, plus one per committed branch
 *     g0_chosen=0 & !g0_achieved & g0_state=1 & <children idle> & G0_achievable*N <= decision_G0
 *     !g0_achieved & g0_state=1 & g{i}_state=0 & g0_chosen=i & G{i}_achievable*N <= decision_G{i}
 *   degradation: one per retry phase, plus the fallback phase
 *     <earlier retries exhausted> & !g0_achieved & g0_state=1 & g{c}_state=0 & g{c}_failed<K & G{c}_achievable*N <= decision_G{c}
 *     <all retries exhausted> & !g0_achieved & g0_state=1 & <children idle> & G0_achievable*N <= decision_G0
 */
export const skipLines = (goal: EdgeGoalNode): string[] => {
  const childIds = orderedChildIds(goal);
  const base = [`!${achievedFormula(goal.id)}`, `${stateVariable(goal.id)}=1`];
  const allIdle = childrenIdle(childIds);

  switch (construct(goal)) {
    case 'sequence':
    case 'anyOrder':
    case 'alternative':
      return [joinGuards(...base, allIdle, parentShouldSkip(goal.id))];
    case 'interleaved':
      return [
        joinGuards(
          ...base,
          allIdle,
          `!(${childIds.map(childShouldPursue).join(' | ')})`,
        ),
      ];
    case 'choice': {
      const chosen = chosenVariable(goal.id);
      return [
        joinGuards(`${chosen}=0`, ...base, allIdle, parentShouldSkip(goal.id)),
        // The reference guards this line with `g0_state=1 & g0_state=0`, which
        // can never hold; the committed child being idle is what is meant.
        ...childIds.map((id, index) =>
          joinGuards(...base, `${stateVariable(id)}=0`, `${chosen}=${index + 1}`, shouldSkip(id)),
        ),
      ];
    }
    case 'degradation': {
      const chain = retriedChildren(goal);
      return [
        ...chain.map(({ id, retries }, position) =>
          joinGuards(
            retriesExhausted(goal, position),
            ...base,
            `${stateVariable(id)}=0`,
            hasFailedLessThanNTimes(id, retries),
            shouldSkip(id),
          ),
        ),
        joinGuards(retriesExhausted(goal), ...base, allIdle, parentShouldSkip(goal.id)),
      ];
    }
  }
};

export const skipStatement = (goal: EdgeGoalNode): string => {
  const logger = getLogger();
  const updateStatement = `(${stateVariable(goal.id)}'=0);`;
  return skipLines(goal)
    .map((leftStatement) => {
      const prismLabelStatement = `[skip_${goal.id}] ${leftStatement} -> ${updateStatement}`;
      logger.skip(goal.id, leftStatement, updateStatement, prismLabelStatement);
      return prismLabelStatement;
    })
    .join('\n  ');
};
