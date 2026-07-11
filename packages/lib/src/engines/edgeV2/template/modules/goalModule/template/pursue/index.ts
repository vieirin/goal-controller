import { Node, type GoalNode } from '@goal-controller/goal-tree';
import { getLogger } from '../../../../../logger/logger';
import { separator } from '../../../../../mdp/common';
import {
  achievedFormula,
  stateVariable,
} from '../../../../../template/common';
import type { EdgeGoalNode, EdgeTask } from '../../../../../types';
import { pursueAndSequentialGoal } from './andGoal';
import { hasBeenAchieved } from './common';
import {
  childShouldPursue,
  joinGuards,
  type PursueStatement,
} from './decisionGuards';
import {
  pursueAlternativeGoal,
  pursueChoiceGoal,
  pursueDegradationGoal,
} from './orGoal';

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

const appendGuards = (baseLeft: string, extra: string): string =>
  extra ? `${baseLeft} & ${extra}` : baseLeft;

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
    .map((child, _): [PursueableNode, PursueStatement] => {
      // first map — base column (EDGEV2.txt):
      // itself:     [pursue_G0] !g0_achieved & g0_state=0 & GUARD -> (g0_state'=1)
      // non-itself: [pursue_G1] !g0_achieved & g0_state=1 -> true
      const itself = isItself(child);
      pursueLogger.pursue(child, 1);

      const calcLeftStatement = (): string => {
        const dependencyStatement = goalDependencyStatement(goal);
        pursueLogger.goalDependency(
          goal.id,
          (goal.properties.engine.dependsOn ?? []).map((dep) => dep.id),
        );
        const notAchieved = `!${achievedFormula(goal.id)}`;
        const statement =
          `[pursue_${child.id}] ${notAchieved} & ${stateVariable(goal.id)}=${
            itself ? 0 : 1
          }` + (itself ? dependencyStatement : '');        pursueLogger.defaultPursueCondition(statement);

        return statement;
      };

      const calcRightStatement = (): string => {
        if (itself) {
          const update = `(${stateVariable(goal.id)}'=1)`;
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
        return [child, { left, right }] as const;
      }
      pursueLogger.stepStatement(1, left, right);

      return [child, { left, right }] as const;
    })
    .flatMap(
      ([child, { left, right }]): Array<
        [PursueableNode, PursueStatement]
      > => {
        // second map — execution detail (EDGEV2.txt); may emit multiple lines
        const calcExecutionDetail = (): PursueStatement[] => {
          pursueLogger.pursue(child, 2);

          if (isItself(child)) {
            logger.info(
              '[EXECUTION DETAIL: SKIP] Skipping condition generation for itself on runtime guard generation step',
              2,
            );
            return [{ left, right }];
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
                const children = pursueableChildren.map((c) => c.id);
                if (children.length === 0) {
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
                return pursueChoiceGoal(goal, children, child.id).map(
                  (fragment) => ({
                    left: appendGuards(left, fragment.left),
                    right: fragment.right,
                  }),
                );
              }
              case 'degradation': {
                logger.trace(
                  child.id,
                  'degradation execution detail detected',
                  2,
                );
                return pursueDegradationGoal(
                  goal,
                  goal.properties.engine.executionDetail.degradationList,
                  child.id,
                ).map((fragment) => ({
                  left: appendGuards(left, fragment.left),
                  right: fragment.right,
                }));
              }
              case 'alternative': {
                logger.trace(
                  child.id,
                  'alternative execution detail detected',
                  2,
                );
                const pursueCondition = pursueAlternativeGoal(goal, child.id);
                return [
                  {
                    left: appendGuards(left, pursueCondition),
                    right,
                  },
                ];
              }
              default:
                logger.info(
                  `[EXECUTION DETAIL: SKIP] Skipping condition generation for ${child.id} on runtime guard generation step, no execution detail`,
                  2,
                );
                return [{ left, right }];
            }
          }

          if (goal.relationToChildren === 'and') {
            logger.trace(child.id, 'and goal detected', 2);
            switch (goal.properties.engine.executionDetail?.type) {
              case 'sequence': {
                logger.trace(child.id, 'sequence execution detail detected', 2);
                const pursueCondition = pursueAndSequentialGoal(
                  goal,
                  goal.properties.engine.executionDetail.sequence,
                  child.id,
                );
                return [
                  {
                    left: appendGuards(left, pursueCondition),
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
                return [
                  {
                    left: appendGuards(left, childShouldPursue(child.id)),
                    right,
                  },
                ];
              }
              default:
                logger.info(
                  `[EXECUTION DETAIL: SKIP] Skipping condition generation for ${child.id} on runtime guard generation step, no execution detail`,
                  2,
                );
                return [{ left, right }];
            }
          }

          logger.info(
            `[EXECUTION DETAIL: ERROR] ${child.id} is not an OR or AND goal`,
            2,
          );
          return [{ left, right }];
        };

        const statements = calcExecutionDetail();
        statements.forEach((statement) => {
          pursueLogger.stepStatement(2, statement.left, statement.right);
        });

        return statements.map(
          (statement) => [child, statement] as [PursueableNode, PursueStatement],
        );
      },
    )
    .map(
      ([child, statement]): [PursueableNode, PursueStatement] => {
        // third map — activation / maintain context guards
        const activationContextCondition =
          ((isItself(child) || Node.isTask(child)) &&
            child.properties.engine.execCondition?.assertion?.sentence) ||
          '';

        const maintainContextGuard =
          child.properties.engine.execCondition?.maintain?.sentence &&
          !isItself(child)
            ? `!${achievedFormula(child.id)}`
            : '';

        const left = joinGuards(
          statement.left,
          activationContextCondition || null,
          maintainContextGuard || null,
        );

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
            right: statement.right,
          },
        ];
      },
    )
    .map(([_, statement]) => {
      // fourth map — dedupe (decision thresholds already in calcExecutionDetail)
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
