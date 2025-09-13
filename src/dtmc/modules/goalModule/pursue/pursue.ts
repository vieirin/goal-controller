import { getLogger } from '../../../../logger/logger';
import { achieved, pursued, separator } from '../../../../mdp/common';
import { GoalNode } from '../../../../ObjectiveTree/types';
import { achievedMaintain } from '../../../formulas';
import { pursueAndSequentialGoal } from './andGoal';
import {
  pursueAlternativeGoal,
  pursueChoiceGoal,
  pursueDegradationGoal,
} from './orGoal';

const goalDependencyStatement = (goal: GoalNode) => {
  return goal.customProperties.dependsOn?.length
    ? ` & (${goal.customProperties.dependsOn
        .map((dep) => `${achieved(dep)}=1`)
        .join(separator('and'))})`
    : '';
};

export const pursueStatements = (goal: GoalNode): string[] => {
  const logger = getLogger();
  const pursueLogger = logger.pursue;

  const goalsToPursue = [goal, ...(goal.children || []), ...(goal.tasks || [])];
  const isItself = (child: GoalNode) => child.id === goal.id;
  const pursueLines = goalsToPursue
    .map((child, _): [GoalNode, { left: string; right: string }] => {
      const itself = isItself(child);
      pursueLogger.pursue(child, 1);

      const calcLeftStatement = () => {
        const statement = `[pursue_${child.id}] ${pursued(goal.id)}=${
          itself ? 0 : 1
        } & ${achieved(goal.id)}=0`;
        pursueLogger.defaultPursueCondition(statement);

        const dependencyStatement = goalDependencyStatement(goal);
        pursueLogger.goalDependency(goal.id, goal.customProperties.dependsOn);

        return statement + dependencyStatement;
      };

      const calcRightStatement = () => {
        if (itself) {
          const update = `(${pursued(goal.id)}'=1)`;
          pursueLogger.update(update);
          return update;
        }
        pursueLogger.update('true');
        return 'true';
      };

      if (isItself(child)) {
        return [
          child,
          {
            left: calcLeftStatement(),
            right: calcRightStatement(),
          },
        ] as const;
      }

      return [
        child,
        { left: calcLeftStatement(), right: calcRightStatement() },
      ] as const;
    })
    .map(
      ([child, { left, right }]): [
        GoalNode,
        { left: string; right: string },
      ] => {
        pursueLogger.pursue(child, 2);

        if (isItself(child)) {
          // skip itself
          logger.info(
            '[EXECUTION DETAIL: SKIP] Skipping condition generation for itself on runtime guard generation step',
            2
          );
          return [child, { left, right }];
        }

        if (goal.relationToChildren === 'or') {
          switch (goal.executionDetail?.type) {
            case 'sequence': {
              throw new Error(
                'OR relation to children with sequence execution detail is not supported'
              );
            }
            case 'choice': {
              const children = goal.children?.map((child) => child.id);
              if (!children) {
                throw new Error(
                  'OR relation to children with choice without children is not supported'
                );
              }

              const pursueCondition = pursueChoiceGoal(
                goal,
                children,
                child.id
              );
              return [child, { left: left + ` & ${pursueCondition}`, right }];
            }
            case 'degradation': {
              const pursueCondition = pursueDegradationGoal(
                goal,
                goal.executionDetail.degradationList,
                child.id
              );
              return [child, { left: left + ` & ${pursueCondition}`, right }];
            }
            case 'alternative': {
              const pursueCondition = pursueAlternativeGoal(goal, child.id);
              return [child, { left: left + ` & ${pursueCondition}`, right }];
            }
            default:
              logger.info(
                `[EXECUTION DETAIL: SKIP] Skipping condition generation for ${goal.id} on runtime guard generation step, no execution detail`,
                2
              );
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
            case 'choice': {
              throw new Error(
                'AND relation to children with choice execution detail is not supported'
              );
            }
            case 'interleaved': {
              pursueLogger.executionDetail.interleaved();
              // interleaved goals fall under the default case
              return [child, { left, right }];
            }
            default:
              logger.info(
                `[EXECUTION DETAIL: SKIP] Skipping condition generation for ${goal.id} on runtime guard generation step, no execution detail`,
                2
              );
              // interleaved goals fall under the default case
              return [child, { left, right }];
          }
        }

        logger.info(
          `[EXECUTION DETAIL: ERROR] ${goal.id} is not an OR or AND goal`,
          2
        );

        return [child, { left, right }];
      }
    )
    .map(([child, statement]): [GoalNode, { left: string; right: string }] => {
      // add maintain condition
      const left = child.execCondition
        ? `${statement.left} & ${
            isItself(child)
              ? child.execCondition.assertion.sentence || 'ASSERTION_UNDEFINED'
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
    .map(([child, statement]) => {
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
