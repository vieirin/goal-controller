import { Node, type GoalNode } from '@goal-controller/goal-tree';
import { getLogger } from '../../../../../logger/logger';
import {
  achieved,
  failed,
  goalState,
  parenthesis,
  separator,
} from '../../../../../mdp/common';
import type { EdgeGoalNode, EdgeTask } from '../../../../../types';
import { chosenVariable } from '../../../../common';
import { achievedMaintain } from '../formulas';
import { degradationRetryCapFromMap } from '../variables';
import { pursueAndInterleavedGoal, pursueAndSequentialGoal } from './andGoal';
import { hasBeenAchieved } from './common';
import { pursueAlternativeGoal } from './orGoal';

// Type for nodes that can be pursued (goals and tasks, but not resources)
type PursueableNode = EdgeGoalNode | EdgeTask;

/**
 * Type guard to check if a node from dependsOn is a valid EdgeGoalNode.
 * The dependsOn array is resolved in afterCreationMapper to contain actual goal nodes,
 * but the generic type doesn't fully capture this - this guard narrows the type safely.
 */
const isEdgeGoalNode = (
  node: GoalNode<unknown, unknown, unknown>,
): node is EdgeGoalNode => {
  return (
    node !== null &&
    typeof node === 'object' &&
    'id' in node &&
    'properties' in node &&
    typeof node.properties === 'object' &&
    node.properties !== null &&
    'engine' in node.properties
  );
};

export const goalDependencyStatement = (goal: EdgeGoalNode): string => {
  const dependencies = goal.properties.engine.dependsOn ?? [];
  const validDependencies = dependencies.filter(isEdgeGoalNode);

  return validDependencies.length > 0
    ? ` & (${validDependencies
        .map((dep) => hasBeenAchieved(dep, { condition: true }))
        .join(separator('and'))})`
    : '';
};

const removeRepeatedConditions = (condition: string): string => {
  return condition
    .split(' & ')
    .filter((condition, index, self) => self.indexOf(condition) === index)
    .join(' & ');
};

export const pursueStatements = (goal: EdgeGoalNode): string[] => {
  const logger = getLogger();
  const pursueLogger = logger.pursue;

  // Filter out resources - they cannot be pursued
  const allChildren = Node.children(goal);
  const pursueableChildren = allChildren.filter(
    (child): child is PursueableNode => !Node.isResource(child),
  );
  const goalsToPursue: PursueableNode[] = [goal, ...pursueableChildren];

  const isItself = (child: PursueableNode): boolean => child.id === goal.id;
  const pursueLines = goalsToPursue

    .map((child, _): [PursueableNode, { left: string; right: string }] => {
      // first map, responsible for writing the first column of the pursue lines
      // itself: [pursue_G1] G1_pursued=0 & G1_achieved=0 -> (G1_pursued'=1)
      // non-itself: [pursue_G2] G1_pursued=1 & G1_achieved=0 -> true
      const itself = isItself(child);
      pursueLogger.pursue(child, 1);

      const calcLeftStatement = (): string => {
        const dependencyStatement = goalDependencyStatement(goal);
        pursueLogger.goalDependency(
          goal.id,
          (goal.properties.engine.dependsOn ?? []).map((dep) => dep.id),
        );
        const statement =
          `[pursue_${child.id}] ${goalState(goal.id)}=${itself ? 0 : 1} & ${
            goal.properties.engine.execCondition?.maintain
              ? `${achievedMaintain(goal.id)}=false`
              : `!${achieved(goal.id)}`
          }` + (itself ? dependencyStatement : '');
        pursueLogger.defaultPursueCondition(statement);

        return statement;
      };

      const calcRightStatement = (): string => {
        if (itself) {
          const update = `(${goalState(goal.id)}'=1)`;
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
        index,
      ): [PursueableNode, { left: string; right: string }] => {
        // second map, responsible for writing the second column of the pursue lines
        // defines how a goal should be pursued based on the execution detail
        // skips itself and handles or and and goals
        // or goal:
        //   - alternatives: pursueAlternativeGoal(goal, child.id)
        //   - choice: two [pursue_child] per child — commit (chosen=0 + alternative guards) then execute (chosen=k + child achievable vs decision)
        //   - degradation: per-sibling failed from retryMap — retry/failover flatMap, or alternative-only if no map entry
        // and goal:
        //   - sequence: pursueAndSequentialGoal(goal, goal.executionDetail.sequence, child.id, [...(goal.children ?? []), ...(goal.tasks ?? [])])
        //    - interleaved: return [child, { left, right }]
        const calcExecutionDetail = (): [
          PursueableNode,
          { left: string; right: string },
        ] => {
          pursueLogger.pursue(child, 2);

          if (isItself(child)) {
            // skip itself
            logger.info(
              '[EXECUTION DETAIL: SKIP] Skipping condition generation for itself on runtime guard generation step',
              2,
            );
            return [child, { left, right }];
          }

          if (goal.relationToChildren === 'or') {
            logger.trace(child.id, 'or goal detected', 2);
            switch (goal.properties.engine.executionDetail?.type) {
              case 'sequence': {
                logger.error(
                  child.id,
                  'sequence execution detail detected in or goal',
                );
                throw new Error(
                  'OR relation to children with sequence execution detail is not supported',
                );
              }
              case 'choice': {
                if (
                  Node.children(goal).filter((c) => !Node.isResource(c))
                    .length === 0
                ) {
                  logger.error(
                    goal.id,
                    'choice execution detail detected without pursueable children',
                  );
                  throw new Error(
                    `[INVALID MODEL]: Goal "${goal.id}" has choice execution detail but no pursueable children (goals or tasks)`,
                  );
                }
                logger.trace(
                  child.id,
                  'choice execution detail detected with children',
                );
                // Commit vs execute split in flatMap after this step
                return [child, { left, right }];
              }
              case 'degradation': {
                logger.trace(
                  child.id,
                  'degradation execution detail detected',
                  2,
                );
                return [child, { left, right }];
              }
              case 'alternative': {
                logger.trace(
                  child.id,
                  'alternative execution detail detected',
                  2,
                );
                const pursueCondition = pursueAlternativeGoal(goal, child.id);
                return [child, { left: left + ` & ${pursueCondition}`, right }];
              }
              default:
                logger.info(
                  `[EXECUTION DETAIL: SKIP] Skipping condition generation for ${child.id} on runtime guard generation step, no execution detail`,
                  2,
                );
                return [child, { left, right }];
            }
          }

          if (goal.relationToChildren === 'and') {
            logger.trace(child.id, 'and goal detected', 2);
            // organize pursue conditions by execution detail type
            switch (goal.properties.engine.executionDetail?.type) {
              case 'sequence': {
                logger.trace(child.id, 'sequence execution detail detected', 2);
                const pursueCondition = pursueAndSequentialGoal(
                  goal,
                  goal.properties.engine.executionDetail.sequence,
                  child.id,
                  Node.children(goal),
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
                  3,
                );
                throw new Error(
                  'AND relation to children with alternative execution detail is not supported',
                );
              }
              case 'choice': {
                logger.trace(child.id, 'choice execution detail detected', 2);
                throw new Error(
                  'AND relation to children with choice execution detail is not supported',
                );
              }
              case 'interleaved': {
                logger.trace(
                  child.id,
                  'interleaved execution detail detected',
                  2,
                );
                pursueLogger.executionDetail.interleaved();
                if (isItself(child)) {
                  return [child, { left, right }];
                }
                const pursueCondition = pursueAndInterleavedGoal(child.id);
                return [
                  child,
                  {
                    left: `${left} & ${pursueCondition}`,
                    right,
                  },
                ];
              }
              default:
                logger.info(
                  `[EXECUTION DETAIL: SKIP] Skipping condition generation for ${child.id} on runtime guard generation step, no execution detail`,
                  2,
                );
                // interleaved goals fall under the default case
                return [child, { left, right }];
            }
          }

          logger.info(
            `[EXECUTION DETAIL: ERROR] ${child.id} is not an OR or AND goal`,
            2,
          );
          return [child, { left, right }];
        };

        const executionDetail = calcExecutionDetail();

        pursueLogger.stepStatement(
          2,
          executionDetail[1].left,
          executionDetail[1].right,
        );

        return executionDetail;
      },
    )
    .flatMap(
      (
        entry: [PursueableNode, { left: string; right: string }],
      ): Array<[PursueableNode, { left: string; right: string }]> => {
        const [child, { left }] = entry;
        if (
          goal.relationToChildren === 'or' &&
          goal.properties.engine.executionDetail?.type === 'degradation' &&
          !isItself(child)
        ) {
          const cap = degradationRetryCapFromMap(goal, child.id);
          if (cap !== null) {
            const retryLeft = `${left} & ${failed(child.id)}<${cap} & ${pursueAndInterleavedGoal(child.id)}`;
            const retryRight = parenthesis(
              `${failed(child.id)}'=min(${cap}, ${failed(child.id)}+1)`,
            );
            const failoverLeft = `${left} & ${failed(child.id)}=${cap} & ${pursueAlternativeGoal(goal, child.id)}`;
            const failoverRight = 'true';
            return [
              [child, { left: retryLeft, right: retryRight }],
              [child, { left: failoverLeft, right: failoverRight }],
            ];
          }
          const altOnlyLeft = `${left} & ${pursueAlternativeGoal(goal, child.id)}`;
          return [[child, { left: altOnlyLeft, right: 'true' }]];
        }
        if (
          goal.relationToChildren === 'or' &&
          goal.properties.engine.executionDetail?.type === 'choice' &&
          !isItself(child)
        ) {
          const branchIndex = goalsToPursue.indexOf(child);
          const commitLeft = `${left} & ${chosenVariable(goal.id)}=0 & ${pursueAlternativeGoal(goal, child.id)}`;
          const commitRight = parenthesis(
            `${chosenVariable(goal.id)}'=${branchIndex}`,
          );
          const execLeft = `${left} & ${chosenVariable(goal.id)}=${branchIndex} & ${pursueAndInterleavedGoal(child.id)}`;
          const execRight = 'true';
          return [
            [child, { left: commitLeft, right: commitRight }],
            [child, { left: execLeft, right: execRight }],
          ];
        }
        return [entry];
      },
    )
    .map(
      ([child, statement]): [
        PursueableNode,
        { left: string; right: string },
      ] => {
        // third map, responsible for writing the third column of the pursue lines
        // defines the activation context and maintain context guards
        // if itself add context guard only if it has an activation context
        // if child add context guard only if it has a maintain condition

        // parent goals have activation context independently of the maintain condition
        const activationContextCondition =
          ((isItself(child) || Node.isTask(child)) &&
            child.properties.engine.execCondition?.assertion?.sentence) ||
          '';

        // child goals have maintain condition only if they are not itself
        const maintainContextGuard =
          child.properties.engine.execCondition?.maintain?.sentence &&
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

        if (child.properties.engine.execCondition) {
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
      },
    )
    .map(([child, statement]) => {
      // fourth map, responsible for writing the update of the failed counter variable
      // defines the update failed counter statement
      // if child has a max retries, update the failed counter variable
      // if itself, skip the update failed counter statement

      // TODO: only update if child is part of a degradation goal
      const maxRetries = child.properties.engine.maxRetries;
      const updateFailedCounterStatement =
        maxRetries > 0
          ? `(${failed(child.id)}'=min(${maxRetries}, ${failed(child.id)}+1))`
          : '';

      if (
        !updateFailedCounterStatement ||
        isItself(child) ||
        (goal.relationToChildren === 'or' &&
          goal.properties.engine.executionDetail?.type === 'degradation')
      ) {
        return [child, statement] as const;
      }

      const rightStatement =
        // overwrite default true with update failed counter statement
        statement.right === 'true'
          ? updateFailedCounterStatement
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
      // TODO: dependencies
      return {
        left: `${removeRepeatedConditions(statement.left)}`,
        right: `${removeRepeatedConditions(statement.right)}`,
      };
    })
    .map((statement): string => {
      pursueLogger.finish();
      return `${statement.left} -> ${statement.right};`;
    });

  return pursueLines ?? [];
};
