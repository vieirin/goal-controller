import type { TreeNode } from '@goal-controller/goal-tree';
import { Node } from '@goal-controller/goal-tree';
import type { EdgeGoalNode } from '../../../../types';
import { getLogger } from '../../../../logger/logger';
import {
  achieved,
  failed,
  goalState,
  pursued,
  separator,
} from '../../../../mdp/common';
import { chosenVariable, decisionVariable } from '../../../common';
import {
  achievableGtDecision,
  achievableLeDecision,
  childIdle,
  pursueableChildren,
} from '../../../prismGuards';
import { cappedDegradationChildren } from './variables';

const pursueMemberNodes = (goal: EdgeGoalNode): TreeNode[] =>
  goal.children?.length ? goal.children : goal.tasks?.length ? goal.tasks : [];

/** Snippet: `!(G2_achievable*10.0 > decision_G2 | G1_achievable*10.0 > decision_G1)`. */
const interleavedSkipNoChildPursueGuard = (goal: EdgeGoalNode): string => {
  const disjuncts = pursueMemberNodes(goal)
    .filter((c) => !Node.isResource(c))
    .map((child) => achievableGtDecision(child.id));
  if (disjuncts.length === 0) return '';
  return `!(${disjuncts.join(separator('or'))})`;
};

const childrenHasNotBeenPursued = (goal: EdgeGoalNode) => {
  const pursueMembers = pursueMemberNodes(goal);
  return pursueMembers
    .map((child: TreeNode) => childIdle(child))
    .join(separator('and'));
};

/**
 * All `[skip_G]` PRISM lines for this goal (`OR` choice may emit several with the same label).
 */
export const skipStatements = (goal: EdgeGoalNode): string[] => {
  const logger = getLogger();
  const idleChildren = childrenHasNotBeenPursued(goal);
  const edType = goal.properties.engine.executionDetail?.type;
  const pursueableOrdered = pursueableChildren(goal);

  const updateStatement = `(${goalState(goal.id)}'=0);`;

  const emit = (leftStatement: string): string => {
    const prismLabelStatement = `[skip_${goal.id}] ${leftStatement} -> ${updateStatement}`;
    logger.skip(goal.id, leftStatement, updateStatement, prismLabelStatement);
    return prismLabelStatement;
  };

  if (
    goal.relationToChildren === 'or' &&
    edType === 'choice' &&
    pursueableOrdered.length > 0
  ) {
    const lines: string[] = [];
    const idleAll = pursueableOrdered
      .map((c) => childIdle(c))
      .join(separator('and'));
    const uncommitted: string[] = [
      `!${achieved(goal.id)}`,
      `${goalState(goal.id)}=1`,
    ];
    if (idleAll) uncommitted.push(idleAll);
    uncommitted.push(`${chosenVariable(goal.id)}=0`);
    uncommitted.push(achievableLeDecision(goal.id));
    lines.push(emit(uncommitted.join(separator('and'))));

    pursueableOrdered.forEach((child, i) => {
      const branchIndex = i + 1;
      const parts: string[] = [
        `!${achieved(goal.id)}`,
        `${goalState(goal.id)}=1`,
        childIdle(child),
        `${chosenVariable(goal.id)}=${branchIndex}`,
        achievableLeDecision(child.id),
      ];
      lines.push(emit(parts.join(separator('and'))));
    });
    return lines;
  }

  if (
    goal.relationToChildren === 'or' &&
    edType === 'degradation' &&
    pursueableOrdered.length > 0
  ) {
    const lines: string[] = [];
    const idleAll = pursueableOrdered
      .map((c) => childIdle(c))
      .join(separator('and'));
    const cappedChildren = cappedDegradationChildren(goal);

    // Retry regime (`child_failed < N`): skip this child branch when it cannot be pursued.
    cappedChildren.forEach(({ child, cap }) => {
      const parts: string[] = [
        `!${achieved(goal.id)}`,
        `${goalState(goal.id)}=1`,
        childIdle(child),
        `${failed(child.id)}<${cap}`,
        achievableLeDecision(child.id),
      ];
      lines.push(emit(parts.join(separator('and'))));
    });

    // Failover regime (`child_failed = N`): skip when parent-level pursue cannot proceed.
    if (cappedChildren.length > 0) {
      cappedChildren.forEach(({ child, cap }) => {
        const parts: string[] = [
          `!${achieved(goal.id)}`,
          `${goalState(goal.id)}=1`,
          `${failed(child.id)}=${cap}`,
          achievableLeDecision(goal.id),
        ];
        if (idleAll) parts.splice(2, 0, idleAll);
        lines.push(emit(parts.join(separator('and'))));
      });
    } else {
      const parts: string[] = [
        `!${achieved(goal.id)}`,
        `${goalState(goal.id)}=1`,
        achievableLeDecision(goal.id),
      ];
      if (idleAll) parts.splice(2, 0, idleAll);
      lines.push(emit(parts.join(separator('and'))));
    }

    return lines;
  }

  const isAndSequential =
    goal.relationToChildren === 'and' && edType === 'sequence';
  const isOrAlternative =
    goal.relationToChildren === 'or' && edType === 'alternative';
  const useParentAchievableLeDecisionSkip = isAndSequential || isOrAlternative;
  const isAndInterleaved =
    goal.relationToChildren === 'and' && edType !== 'sequence';

  const parts: string[] = [];
  if (useParentAchievableLeDecisionSkip) {
    parts.push(`!${achieved(goal.id)}`);
    parts.push(`${goalState(goal.id)}=1`);
    if (idleChildren) parts.push(idleChildren);
    parts.push(achievableLeDecision(goal.id));
  } else if (isAndInterleaved) {
    parts.push(`${goalState(goal.id)}=1`);
    if (idleChildren) parts.push(idleChildren);
    parts.push(`!${achieved(goal.id)}`);
    const interleavedGuard = interleavedSkipNoChildPursueGuard(goal);
    if (interleavedGuard) parts.push(interleavedGuard);
  } else {
    parts.push(`${goalState(goal.id)}=1`);
    if (idleChildren) parts.push(idleChildren);
  }

  return [emit(parts.join(separator('and')))];
};
