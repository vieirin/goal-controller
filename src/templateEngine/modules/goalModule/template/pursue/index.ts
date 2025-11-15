import type { GoalNode } from '../../../../../GoalTree/types';
import { childrenIncludingTasks } from '../../../../../GoalTree/utils';
import { getLogger } from '../../../../../logger/logger';
import {
  achieved,
  failed,
  parenthesis,
  pursued,
  separator,
} from '../../../../../mdp/common';
import { chosenVariable } from '../../../../common';
import { achievedMaintain } from '../formulas';
import { pursueAndSequentialGoal } from './andGoal';
import { hasBeenAchieved } from './common';
import {
  pursueAlternativeGoal,
  pursueChoiceGoal,
  pursueDegradationGoal,
} from './orGoal';

export const goalDependencyStatement = (goal: GoalNode) => {
  return goal.dependsOn?.length
    ? ` & (${goal.dependsOn
        .map((dep) => hasBeenAchieved(dep, { condition: true }))
        .join(separator('and'))})`
    : '';
};

const removeRepeatedConditions = (condition: string) => {
  return condition
    .split(' & ')
    .filter((condition, index, self) => self.indexOf(condition) === index)
    .join(' & ');
};

export const pursueStatements = (goal: GoalNode): string[] => {
  const logger = getLogger();
  const pursueLogger = logger.pursue;

  const goalsToPursue = [goal, ...childrenIncludingTasks({ node: goal })];
  const isItself = (child: GoalNode) => child.id === goal.id;
  const pursueLines = goalsToPursue

    .map((child, _): [GoalNode, { left: string; right: string }] => {
      // first map, responsible for writing the first column of the pursue lines
      // itself: [pursue_G1] G1_pursued=0 & G1_achieved=0 -> (G1_pursued'=1)
      // non-itself: [pursue_G2] G1_pursued=1 & G1_achieved=0 -> true
      const itself = isItself(child);
      pursueLogger.pursue(child, 1);

      const calcLeftStatement = () => {
        const dependencyStatement = goalDependencyStatement(goal);
        pursueLogger.goalDependency(goal.id, goal.properties.dependsOn);
        const statement =
          `[pursue_${child.id}] ${pursued(goal.id)}=${itself ? 0 : 1} & ${
            goal.execCondition?.maintain
              ? `${achievedMaintain(goal.id)}=false`
              : `${achieved(goal.id)}=0`
          }` + (itself ? dependencyStatement : '');
        pursueLogger.defaultPursueCondition(statement);

        return statement;
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

      const { left, right } = {
        left: calcLeftStatement(),
        right: calcRightStatement(),
      };

      if (isItself(child)) {
        return [
          child,
          {
            left,
            right,
          },
        ] as const;
      }
      pursueLogger.stepStatement(1, left, right);

      return [child, { left, right }] as const;
    })
    .map(
      (
        [child, { left, right }],
        index
      ): [GoalNode, { left: string; right: string }] => {
        // second map, responsible for writing the second column of the pursue lines
        // defines how a goal should be pursued based on the execution detail
        // skips itself and handles or and and goals
        // or goal:
        //   - alternatives: pursueAlternativeGoal(goal, child.id)
        //   - choice: pursueChoiceGoal(goal, children, child.id)
        //   - degradation: pursueDegradationGoal(goal, goal.executionDetail.degradationList, child.id)
        // and goal:
        //   - sequence: pursueAndSequentialGoal(goal, goal.executionDetail.sequence, child.id, [...(goal.children ?? []), ...(goal.tasks ?? [])])
        //    - interleaved: return [child, { left, right }]
        const calcExecutionDetail = (): [
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
            logger.trace(child.id, 'or goal detected', 2);
            switch (goal.executionDetail?.type) {
              case 'sequence': {
                logger.error(
                  child.id,
                  'sequence execution detail detected in or goal'
                );
                throw new Error(
                  'OR relation to children with sequence execution detail is not supported'
                );
              }
              case 'choice': {
                const children = [
                  ...(goal.children ?? []),
                  ...(goal.tasks ?? []),
                ].map((child) => child.id);
                if (!children) {
                  logger.error(
                    child.id,
                    'choice execution detail detected without children'
                  );
                  throw new Error(
                    'OR relation to children with choice without children is not supported'
                  );
                }
                logger.trace(
                  child.id,
                  'choice execution detail detected with children'
                );
                const pursueCondition = pursueChoiceGoal(
                  goal,
                  children,
                  child.id
                );

                const _right =
                  index > 0
                    ? parenthesis(`${chosenVariable(goal.id)}'=${index - 1}`)
                    : right;

                return [
                  child,
                  { left: left + ` & ${pursueCondition}`, right: _right },
                ];
              }
              case 'degradation': {
                logger.trace(
                  child.id,
                  'degradation execution detail detected',
                  2
                );
                const pursueCondition = pursueDegradationGoal(
                  goal,
                  goal.executionDetail.degradationList,
                  child.id
                );
                const updatedLeft = pursueCondition
                  ? `${left} & ${pursueCondition}`
                  : left;
                return [child, { left: updatedLeft, right }];
              }
              case 'alternative': {
                logger.trace(
                  child.id,
                  'alternative execution detail detected',
                  2
                );
                const pursueCondition = pursueAlternativeGoal(goal, child.id);
                return [child, { left: left + ` & ${pursueCondition}`, right }];
              }
              default:
                logger.info(
                  `[EXECUTION DETAIL: SKIP] Skipping condition generation for ${child.id} on runtime guard generation step, no execution detail`,
                  2
                );
                return [child, { left, right }];
            }
          }

          if (goal.relationToChildren === 'and') {
            logger.trace(child.id, 'and goal detected', 2);
            // organize pursue conditions by execution detail type
            switch (goal.executionDetail?.type) {
              case 'sequence': {
                logger.trace(child.id, 'sequence execution detail detected', 2);
                const pursueCondition = pursueAndSequentialGoal(
                  goal,
                  goal.executionDetail.sequence,
                  child.id,
                  [...(goal.children ?? []), ...(goal.tasks ?? [])]
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
                logger.trace(
                  child.id,
                  'alternative execution detail detected',
                  3
                );
                throw new Error(
                  'AND relation to children with alternative execution detail is not supported'
                );
              }
              case 'choice': {
                logger.trace(child.id, 'choice execution detail detected', 2);
                throw new Error(
                  'AND relation to children with choice execution detail is not supported'
                );
              }
              case 'interleaved': {
                logger.trace(
                  child.id,
                  'interleaved execution detail detected',
                  2
                );
                pursueLogger.executionDetail.interleaved();
                // interleaved goals fall under the default case
                return [child, { left, right }];
              }
              default:
                logger.info(
                  `[EXECUTION DETAIL: SKIP] Skipping condition generation for ${child.id} on runtime guard generation step, no execution detail`,
                  2
                );
                // interleaved goals fall under the default case
                return [child, { left, right }];
            }
          }

          logger.info(
            `[EXECUTION DETAIL: ERROR] ${child.id} is not an OR or AND goal`,
            2
          );
          return [child, { left, right }];
        };

        const executionDetail = calcExecutionDetail();

        pursueLogger.stepStatement(
          2,
          executionDetail[1].left,
          executionDetail[1].right
        );

        return executionDetail;
      }
    )
    .map(([child, statement]): [GoalNode, { left: string; right: string }] => {
      // third map, responsible for writing the third column of the pursue lines
      // defines the activation context and maintain context guards
      // if itself add context guard only if it has an activation context
      // if child add context guard only if it has a maintain condition

      // parent goals have activation context independently of the maintain condition
      const activationContextCondition =
        (isItself(child) &&
          child.execCondition &&
          child.execCondition.assertion.sentence) ||
        '';

      // child goals have maintain condition only if they are not itself
      const maintainContextGuard =
        child.execCondition &&
        child.execCondition.maintain?.sentence &&
        !isItself(child)
          ? `${achievedMaintain(child.id)}=false`
          : '';

      const left =
        activationContextCondition || maintainContextGuard
          ? `${statement.left} & ${[
              activationContextCondition,
              maintainContextGuard,
            ]
              .filter(Boolean)
              .join(' & ')}`
          : statement.left;

      if (child.execCondition) {
        logger.trace(child.id, 'activation context guard detected', 2);
        pursueLogger.executionDetail.activationContext(maintainContextGuard);
      } else {
        logger.trace(child.id, 'no activation context guard detected', 2);
        pursueLogger.executionDetail.noActivationContext(child.id);
      }

      pursueLogger.stepStatement(3, left, statement.right);
      return [
        child,
        {
          left,
          right: `${statement.right}`,
        },
      ];
    })
    .map(([child, statement]) => {
      // fourth map, responsible for writing the update of the failed counter variable
      // defines the update failed counter statement
      // if child has a max retries, update the failed counter variable
      // if itself, skip the update failed counter statement

      const updateFailedCounterStatement = child.properties.maxRetries
        ? `(${failed(child.id)}'=min(${child.properties.maxRetries}, ${failed(
            child.id
          )}+1))`
        : '';

      if (!updateFailedCounterStatement || isItself(child)) {
        return [child, statement] as const;
      }

      const rightStatement =
        statement.right === 'true'
          ? // overwrite default true with update failed counter statement
            updateFailedCounterStatement
          : `${statement.right} & ${updateFailedCounterStatement}`;
      return [
        child,
        {
          left: statement.left,
          right: rightStatement,
        },
      ] as const;
    })
    .map(([_, statement]) => {
      // fifth map
      // cleans up the left and right statements by removing repeated conditions
      // TODO: decision variables stage, dependencies
      return {
        left: `${removeRepeatedConditions(statement.left)}`,
        right: `${removeRepeatedConditions(statement.right)}`,
      };
    })
    .map((statement): string => {
      return `${statement.left} -> ${statement.right};`;
    });

  return pursueLines ?? [];
};
