import { Node, type GoalNode } from '@goal-controller/goal-tree';
import { getLogger } from '../../../../../logger/logger';
import { separator } from '../../../../../mdp/common';
import {
  achievedFormula,
  stateVariable,
} from '../../../../../template/common';
import type { EdgeGoalNode, EdgeTask } from '../../../../../types';
import { pursueAndAnyOrderGoal, pursueAndSequentialGoal } from './andGoal';
import { construct, orderedChildIds, orderedChildren } from '../children';
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
  const pursueableChildren = orderedChildren(goal);
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
          `[pursue_${child.id}] ${notAchieved} & ${stateVariable(goal.id)}=${itself ? 0 : 1
          }` + (itself ? dependencyStatement : '');
        pursueLogger.defaultPursueCondition(statement);

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

          const childIds = orderedChildIds(goal);
          const withGuard = (fragment: string): PursueStatement[] => [
            { left: appendGuards(left, fragment), right },
          ];
          const kind = construct(goal);
          logger.trace(child.id, `${kind} execution detail`, 2);
          switch (kind) {
            case 'sequence':
              return withGuard(pursueAndSequentialGoal(goal, childIds, child.id));
            case 'anyOrder':
              return withGuard(pursueAndAnyOrderGoal(goal, childIds, child.id));
            case 'interleaved':
              pursueLogger.executionDetail.interleaved();
              return withGuard(childShouldPursue(child.id));
            case 'alternative':
              return withGuard(pursueAlternativeGoal(goal, child.id));
            case 'choice':
              return pursueChoiceGoal(goal, childIds, child.id).map((fragment) => ({
                left: appendGuards(left, fragment.left),
                right: fragment.right,
              }));
            case 'degradation':
              return pursueDegradationGoal(goal, childIds, child.id).map(
                (fragment) => ({
                  left: appendGuards(left, fragment.left),
                  right: fragment.right,
                }),
              );
          }
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
