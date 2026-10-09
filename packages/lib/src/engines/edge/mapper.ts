/**
 * Edge Engine Mapper
 * Maps raw iStar model properties to Edge/PRISM engine-specific properties
 */
import {
  createEngineMapper,
  type GoalNode,
  type GoalTreeType,
  type RawProps,
  type Resource,
  type Task,
} from '@goal-controller/goal-tree';
import { propertyKeys } from '@goal-controller/dialect';
import { edge } from './definition';
import {
  edgeGoalChecks,
  firstGoalOrTaskIssue,
  firstResourceIssue,
} from '../edgeFamily/checks';
import { assertionVariables as variablesIn } from '@goal-controller/goal-language';
import type {
  Decision,
  EdgeResourceProps,
  EdgeTaskProps,
  ExecCondition,
  GoalExecutionDetail,
} from './types';

// the custom properties it reads, per kind: from the engine's definition
export const EDGE_GOAL_KEYS = propertyKeys(edge, 'goal');
export const EDGE_TASK_KEYS = propertyKeys(edge, 'task');
export const EDGE_RESOURCE_KEYS = propertyKeys(edge, 'resource');

// Type aliases for the allowed keys
export type EdgeGoalKey = (typeof EDGE_GOAL_KEYS)[number];
export type EdgeTaskKey = (typeof EDGE_TASK_KEYS)[number];
export type EdgeResourceKey = (typeof EDGE_RESOURCE_KEYS)[number];

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
        `[INVALID DECISION]: decision must be a variable and space: got ${decision}, expected format variable:space`,
      );
    }
    if (isNaN(parseInt(d[1] ?? ''))) {
      throw new Error(
        `[INVALID DECISION]: space must be a number: got ${d[1]}`,
      );
    }
  });

  return parsedDecision.map((d) => ({
    variable: d[0]?.trim() ?? '',
    space: parseInt(d[1] ?? '', 10),
  }));
};

/**
 * Parse and validate maxRetries value
 * Returns 0 if not provided, throws if invalid
 */
const parseMaxRetries = (
  maxRetries: string | undefined,
  nodeType: 'goal' | 'task',
): number => {
  if (!maxRetries) {
    return 0;
  }
  const parsed = parseInt(maxRetries, 10);
  if (isNaN(parsed) || parsed < 0) {
    throw new Error(
      `[INVALID ${nodeType.toUpperCase()}]: maxRetries must be a non-negative integer: got "${maxRetries}"`,
    );
  }
  return parsed;
};

const getMaintainCondition = (
  customProperties: RawProps<EdgeGoalKey> | RawProps<EdgeTaskKey>,
  nodeType: 'goal' | 'task',
): ExecCondition | undefined => {
  if (customProperties.type === 'maintain') {
    if (!('maintain' in customProperties)) {
      throw new Error(
        `[INVALID MODEL]: Maintain condition for ${nodeType} must have 'maintain' and 'assertion'; got maintain: none, assertion: ${customProperties.assertion || "'empty condition'"}`,
      );
    }
    if (!customProperties.maintain || !customProperties.assertion) {
      console.warn(
        `[INVALID MODEL]: Maintain condition for ${nodeType} must have maintain and assertion: got maintain:${
          customProperties.maintain || "'empty condition'"
        } and assertion:${customProperties.assertion || "'empty condition'"}`,
      );
    }

    return {
      maintain: {
        sentence: customProperties.maintain ?? '',
        variables: variablesIn(customProperties.maintain ?? ''),
      },
      assertion: {
        sentence: customProperties.assertion ?? '',
        variables: variablesIn(customProperties.assertion ?? ''),
      },
    };
  }

  if (customProperties.assertion) {
    const assertionVariables = variablesIn(customProperties.assertion);

    return {
      assertion: {
        sentence: customProperties.assertion,
        variables: assertionVariables,
      },
    };
  }

  return undefined;
};

// Using an interface allows circular references (interfaces are lazily evaluated)
// This gives us proper typing: dependsOn[0].properties.engine is EdgeGoalPropsResolved
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export interface EdgeGoalPropsResolved {
  utility: string;
  cost: string;
  dependsOn: EdgeGoalNode[];
  executionDetail: GoalExecutionDetail | null;
  execCondition?: ExecCondition;
  decision: Decision;
  maxRetries: number;
}

/**
 * Parse dependsOn string into array of goal IDs
 */
const parseDependsOn = (dependsOn: string | undefined): string[] => {
  if (!dependsOn) {
    return [];
  }
  return dependsOn
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
};

/**
 * Edge Engine Mapper for creating EDGE/PRISM-compatible goal trees
 * Engine types are explicit, key types are inferred from the allowedKeys arrays
 */
export const edgeEngineMapper = createEngineMapper<
  EdgeGoalPropsResolved,
  EdgeTaskProps,
  EdgeResourceProps
>()({
  // goal texts are read in the definition's dialect (goal-tree derives the reader)
  dialect: edge,
  allowedGoalKeys: EDGE_GOAL_KEYS,
  allowedTaskKeys: EDGE_TASK_KEYS,
  allowedResourceKeys: EDGE_RESOURCE_KEYS,
  mapGoalProps: ({ raw, executionDetail, id }) => {
    // dependsOn needs the whole tree: checked later, in afterCreationMapper
    const issue = firstGoalOrTaskIssue('goal', raw);
    if (issue) throw new Error(`${issue} (node ${id})`);

    const decisionVars = parseDecision(raw.variables);
    const execCondition = getMaintainCondition(raw, 'goal');

    return {
      utility: raw.utility || '',
      cost: raw.cost || '',
      dependsOn: [],
      executionDetail,
      execCondition,
      decision: {
        decisionVars,
        hasDecision: decisionVars.length > 0,
      } satisfies Decision,
      maxRetries: parseMaxRetries(raw.maxRetries, 'goal'),
    };
  },

  mapTaskProps: ({ raw, id }) => {
    const issue = firstGoalOrTaskIssue('task', raw);
    if (issue) throw new Error(`${issue} (node ${id})`);

    const execCondition = getMaintainCondition(raw, 'task');

    return {
      execCondition,
      maxRetries: parseMaxRetries(raw.maxRetries, 'task'),
      utility: raw.utility || '',
      cost: raw.cost || '',
    };
  },

  mapResourceProps: ({ raw, id }) => {
    const issue = firstResourceIssue(raw);
    if (issue) throw new Error(`${issue} (node ${id})`);

    const { type, initialValue, lowerBound, upperBound } = raw;

    switch (type) {
      case 'bool': {
        // Validate initialValue is strictly 'true' or 'false'
        if (initialValue !== 'true' && initialValue !== 'false') {
          throw new Error(
            `[INVALID RESOURCE]: Boolean resource must have initialValue of 'true' or 'false', got: ${initialValue === undefined ? 'undefined' : `"${initialValue}"`}`,
          );
        }
        return {
          variable: {
            type: 'boolean' as const,
            initialValue: initialValue === 'true',
          },
        };
      }
      case 'int': {
        // Check for null/undefined/empty string explicitly to allow "0" as valid value
        if (
          initialValue == null ||
          lowerBound == null ||
          upperBound == null ||
          initialValue === '' ||
          lowerBound === '' ||
          upperBound === ''
        ) {
          throw new Error(
            '[INVALID RESOURCE]: Integer resource must have an initial value, lower bound, and upper bound',
          );
        }

        const lowerBoundInt = parseInt(lowerBound, 10);
        const upperBoundInt = parseInt(upperBound, 10);

        if (isNaN(lowerBoundInt) || isNaN(upperBoundInt)) {
          throw new Error(
            '[INVALID RESOURCE]: Resource must have valid numeric lower and upper bounds',
          );
        }

        if (lowerBoundInt > upperBoundInt) {
          throw new Error(
            `[INVALID RESOURCE]: Resource lower bound (${lowerBoundInt}) must be less than or equal to upper bound (${upperBoundInt})`,
          );
        }

        const initialValueInt = parseInt(initialValue, 10);

        if (isNaN(initialValueInt)) {
          throw new Error(
            `[INVALID RESOURCE]: Resource must have a valid numeric initial value, got: "${initialValue}"`,
          );
        }

        // Validate initialValue is within bounds
        if (
          initialValueInt < lowerBoundInt ||
          initialValueInt > upperBoundInt
        ) {
          throw new Error(
            `[INVALID RESOURCE]: Initial value (${initialValueInt}) must be within bounds [${lowerBoundInt}, ${upperBoundInt}]`,
          );
        }

        return {
          variable: {
            type: 'int' as const,
            initialValue: initialValueInt,
            lowerBound: lowerBoundInt,
            upperBound: upperBoundInt,
          },
        };
      }
      default:
        throw new Error(
          `[INVALID RESOURCE]: Unsupported resource type: ${type}`,
        );
    }
  },

  afterCreationMapper: ({ node, allNodes, rawProperties }) => {
    // Only process goal nodes for dependsOn resolution
    if (rawProperties.nodeType !== 'goal' || node.type !== 'goal') {
      // For non-goal nodes, return the existing engine props
      return node.properties.engine;
    }

    const dependsOnMessage = edgeGoalChecks.dependsOn?.(rawProperties.raw, {
      self: node.id,
      kindOf: (id) => allNodes.get(id)?.type,
    });
    if (dependsOnMessage) throw new Error(dependsOnMessage);

    const depIds = parseDependsOn(rawProperties.raw.dependsOn);
    const resolvedDeps = depIds.map((id) => allNodes.get(id) as EdgeGoalNode);

    return {
      ...node.properties.engine,
      dependsOn: resolvedDeps,
    };
  },
});

/**
 * Type aliases for Edge-specific tree types
 */
export type EdgeGoalNode = GoalNode<
  EdgeGoalPropsResolved,
  EdgeTaskProps,
  EdgeResourceProps
>;
export type EdgeTask = Task<EdgeTaskProps, EdgeResourceProps>;
export type EdgeResource = Resource<EdgeResourceProps>;
export type EdgeGoalTree = GoalTreeType<
  EdgeGoalPropsResolved,
  EdgeTaskProps,
  EdgeResourceProps
>;
