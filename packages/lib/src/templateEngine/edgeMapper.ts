/**
 * Edge Engine Mapper
 * Maps raw iStar model properties to Edge/PRISM engine-specific properties
 */
import type {
  EngineMapper,
  GoalExecutionDetail,
  GoalNode,
  GoalTreeType,
  RawGoalProps,
  RawTaskProps,
  Task,
} from '@goal-controller/goal-tree';
import type {
  Decision,
  EdgeGoalProps,
  EdgeTaskProps,
  ExecCondition,
} from './types';

import { getAssertionVariables } from '@goal-controller/goal-tree';

const parseDecision = (
  decision: string | undefined,
): Array<{ variable: string; space: number }> => {
  if (!decision) {
    return [];
  }
  const parsedDecision = decision.split(',').map((d) => d.split(':'));
  parsedDecision.forEach((d) => {
    if (d.length !== 2) {
      throw new Error(
        `[INVALID DECISION] decision must be a variable and space: got ${decision}, expected format variable:space`,
      );
    }
    if (isNaN(parseInt(d[1] ?? ''))) {
      throw new Error(`[INVALID DECISION] space must be a number: got ${d[1]}`);
    }
  });

  return parsedDecision.map((d) => ({
    variable: d[0]?.trim() ?? '',
    space: parseInt(d[1] ?? ''),
  }));
};

const getMaintainCondition = (
  customProperties: RawGoalProps | RawTaskProps,
  nodeType: 'goal' | 'task',
): ExecCondition | undefined => {
  if (customProperties.type === 'maintain') {
    if (!customProperties.maintain && !customProperties.assertion) {
      console.warn(
        `[INVALID MODEL]: Maintain condition for ${nodeType} must have maintain and assertion: got maintain:${
          customProperties.maintain || "'empty condition'"
        } and assertion:${customProperties.assertion || "'empty condition'"}`,
      );
    }

    return {
      maintain: {
        sentence: customProperties.maintain ?? '',
        variables: getAssertionVariables({
          assertionSentence: customProperties.maintain ?? '',
        }),
      },
      assertion: {
        sentence: customProperties.assertion ?? '',
        variables: getAssertionVariables({
          assertionSentence: customProperties.assertion ?? '',
        }),
      },
    };
  }

  if (customProperties.assertion) {
    const assertionVariables = getAssertionVariables({
      assertionSentence: customProperties.assertion,
    });

    return {
      assertion: {
        sentence: customProperties.assertion,
        variables: assertionVariables,
      },
    };
  }

  return undefined;
};

// Resolved types with concrete GoalNode reference
export type EdgeGoalPropsResolved = EdgeGoalProps<
  GoalNode<EdgeGoalProps<unknown>, EdgeTaskProps>
>;

/**
 * Edge Engine Mapper for creating EDGE/PRISM-compatible goal trees
 */
export const edgeEngineMapper: EngineMapper<
  EdgeGoalPropsResolved,
  EdgeTaskProps
> = {
  mapGoalProps: ({
    raw,
    executionDetail,
    dependsOn,
  }: {
    raw: RawGoalProps;
    executionDetail: GoalExecutionDetail | null;
    dependsOn: Array<GoalNode<EdgeGoalPropsResolved, EdgeTaskProps>>;
  }) => {
    const decisionVars = parseDecision(raw.variables);
    const execCondition = getMaintainCondition(raw, 'goal');

    return {
      utility: raw.utility || '',
      cost: raw.cost || '',
      dependsOn,
      executionDetail,
      execCondition,
      decision: {
        decisionVars,
        hasDecision: decisionVars.length > 0,
      } satisfies Decision,
      maxRetries: raw.maxRetries ? parseInt(raw.maxRetries) : 0,
    };
  },

  mapTaskProps: ({ raw }: { raw: RawTaskProps }) => {
    const execCondition = getMaintainCondition(raw, 'task');

    return {
      execCondition,
      maxRetries: raw.maxRetries ? parseInt(raw.maxRetries) : 0,
    };
  },
};

/**
 * Type aliases for Edge-specific tree types
 */
export type EdgeGoalNode = GoalNode<EdgeGoalPropsResolved, EdgeTaskProps>;
export type EdgeTask = Task<EdgeTaskProps>;
export type EdgeGoalTree = GoalTreeType<EdgeGoalPropsResolved, EdgeTaskProps>;
