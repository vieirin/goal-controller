import { achieved, pursued, separator } from '../../../../mdp/common';
import { GoalNode } from '../../../../ObjectiveTree/types';
import { achievedMaintain } from '../../../formulas';
import { pursueAlternativeGoal } from './interleavedGoal';
import { pursueAndSequentialGoal } from './sequentialGoal';

const goalDependencyStatement = (goal: GoalNode) => {
  return goal.customProperties.dependsOn?.length
    ? ` & (${goal.customProperties.dependsOn
        .map((dep) => `${achieved(dep)}=1`)
        .join(separator('and'))})`
    : '';
};

export const pursueStatements = (goal: GoalNode): string[] => {
  const goalsToPursue = [goal, ...(goal.children || []), ...(goal.tasks || [])];
  const isItself = (child: GoalNode) => child.id === goal.id;
  const pursueLines = goalsToPursue
    .map((child, _): [GoalNode, { left: string; right: string }] => {
      const leftStatement = `[pursue_${child.id}] ${pursued(goal.id)}=${
        isItself(child) ? 0 : 1
      }`;
      if (isItself(child)) {
        return [
          child,
          {
            left:
              leftStatement +
              ` & ${achieved(goal.id)}=0` +
              goalDependencyStatement(goal),
            right: `(${pursued(goal.id)}'=1)`,
          },
        ] as const;
      }

      return [child, { left: leftStatement, right: 'true' }] as const;
    })
    .map(
      ([child, { left, right }]): [
        GoalNode,
        { left: string; right: string },
      ] => {
        if (isItself(child)) {
          // skip itself
          return [child, { left, right }];
        }

        if (goal.relationToChildren === 'or') {
          switch (goal.executionDetail?.type) {
            case 'sequence': {
              throw new Error(
                'OR relation to children with sequence execution detail is not supported'
              );
            }
            case 'alternative': {
              const pursueCondition = pursueAlternativeGoal(
                goal,
                goal.executionDetail.alternative,
                child.id
              );
              return [child, { left: left + ` & ${pursueCondition}`, right }];
            }
            default:
              return [child, { left, right }];
          }
        }

        if (goal.relationToChildren === 'and') {
          // organize pursue conditions by execution detail type
          switch (goal.executionDetail?.type) {
            case 'sequence': {
              const pursueCondition = pursueAndSequentialGoal(
                goal,
                goal.executionDetail.sequence,
                child.id
              );
              return [
                child,
                {
                  left: left + ` & ${pursueCondition}`,
                  right,
                },
              ];
            }
            case 'alternative': {
              throw new Error(
                'AND relation to children with alternative execution detail is not supported'
              );
            }
            default:
              // interleaved goals fall under the default case
              return [child, { left, right }];
          }
        }

        return [child, { left, right }];
      }
    )
    .map(([child, statement]): [GoalNode, { left: string; right: string }] => {
      // add maintain condition
      const left = child.maintainCondition
        ? `${statement.left} & ${
            isItself(child)
              ? child.maintainCondition.assertion.sentence ||
                'ASSERTION_UNDEFINED'
              : achievedMaintain(child.id)
          }`
        : statement.left;
      return [
        child,
        {
          left,
          right: `${statement.right}`,
        },
      ];
    })
    .map(([, statement]) => {
      // TODO: decision variables stage, dependencies
      return {
        left: `${statement.left}`,
        right: `${statement.right}`,
      };
    })
    .map((statement): string => {
      return `${statement.left} -> ${statement.right};`;
    });

  return pursueLines ?? [];
};
