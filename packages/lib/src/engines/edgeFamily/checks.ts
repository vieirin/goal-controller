/**
 * The property checks edge/mapper.ts and edgeV2/mapper.ts both make (they're near-copies
 * of each other): a shared module, since the checks are identical today. Split it if the
 * two engines' rules ever diverge.
 */
import type { CheckNameOf } from '@goal-controller/dialect';
import { edge } from '../edge/definition';
import type { Check } from '../checks';
import type { EdgeGoalKey, EdgeResourceKey, EdgeTaskKey } from '../edge/mapper';

type Issue = { key: string; message: string };

/**
 * goal/task issues, in mapGoalProps/mapTaskProps's own evaluation order (parseDecision,
 * then getMaintainCondition, then parseMaxRetries): the first entry is the one the mapper
 * throws first.
 */
const goalOrTaskIssues = (
  kind: 'goal' | 'task',
  raw: Partial<Record<string, string>>,
): Issue[] => {
  const issues: Issue[] = [];

  if (kind === 'goal' && raw.variables) {
    const decision = raw.variables;
    for (const part of decision.split(',').map((d) => d.split(':'))) {
      if (part.length !== 2) {
        issues.push({
          key: 'variables',
          message: `[INVALID DECISION]: decision must be a variable and space: got ${decision}, expected format variable:space`,
        });
        break; // the mapper's forEach throws on the first bad pair
      }
      if (isNaN(parseInt(part[1] ?? ''))) {
        issues.push({
          key: 'variables',
          message: `[INVALID DECISION]: space must be a number: got ${part[1]}`,
        });
        break;
      }
    }
  }

  if (raw.type === 'maintain') {
    // absent or blank: the Inspector validates with maintain:'' while typing, and the
    // mapper used to only throw when the key was missing
    if (!raw.maintain?.trim()) {
      issues.push({
        key: 'maintain',
        message: `[INVALID MODEL]: Maintain condition for ${kind} must have 'maintain' and 'assertion'; got maintain: none, assertion: ${raw.assertion?.trim() || "'empty condition'"}`,
      });
    } else if (!raw.assertion?.trim()) {
      issues.push({
        key: 'assertion',
        message: `[INVALID MODEL]: Maintain condition for ${kind} must have 'maintain' and 'assertion'; got maintain: ${raw.maintain}, assertion: 'empty condition'`,
      });
    }
  }

  if (raw.maxRetries) {
    const parsed = parseInt(raw.maxRetries, 10);
    if (isNaN(parsed) || parsed < 0) {
      issues.push({
        key: 'maxRetries',
        message: `[INVALID ${kind.toUpperCase()}]: maxRetries must be a non-negative integer: got "${raw.maxRetries}"`,
      });
    }
  }

  return issues;
};

/** afterCreationMapper's dependsOn resolution, word for word (existence, then goal-ness). */
const dependsOnCheck: Check = (raw, { self, kindOf }) => {
  const ids = (raw.dependsOn ?? '')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
  for (const id of ids) {
    const kind = kindOf(id);
    if (!kind) {
      return `[INVALID MODEL]: Dependency ${id} not found for node ${self}`;
    }
    if (kind !== 'goal') {
      return `[INVALID MODEL]: Dependency ${id} for node ${self} must be a goal, got ${kind}`;
    }
  }
  return null;
};

/** mapResourceProps issues, in its own evaluation order (one branch per resource type). */
const resourceIssues = (raw: Partial<Record<string, string>>): Issue[] => {
  const { type, initialValue, lowerBound, upperBound } = raw;

  switch (type) {
    case 'bool': {
      if (initialValue !== 'true' && initialValue !== 'false') {
        return [
          {
            key: 'initialValue',
            message: `[INVALID RESOURCE]: Boolean resource must have initialValue of 'true' or 'false', got: ${initialValue === undefined ? 'undefined' : `"${initialValue}"`}`,
          },
        ];
      }
      return [];
    }
    case 'int': {
      const missingKeys: EdgeResourceKey[] = [];
      if (initialValue == null || initialValue === '')
        missingKeys.push('initialValue');
      if (lowerBound == null || lowerBound === '')
        missingKeys.push('lowerBound');
      if (upperBound == null || upperBound === '')
        missingKeys.push('upperBound');
      if (missingKeys.length > 0) {
        const message =
          '[INVALID RESOURCE]: Integer resource must have an initial value, lower bound, and upper bound';
        return missingKeys.map((key) => ({ key, message }));
      }

      const lowerBoundInt = parseInt(lowerBound as string, 10);
      const upperBoundInt = parseInt(upperBound as string, 10);
      const badBoundKeys: EdgeResourceKey[] = [];
      if (isNaN(lowerBoundInt)) badBoundKeys.push('lowerBound');
      if (isNaN(upperBoundInt)) badBoundKeys.push('upperBound');
      if (badBoundKeys.length > 0) {
        const message =
          '[INVALID RESOURCE]: Resource must have valid numeric lower and upper bounds';
        return badBoundKeys.map((key) => ({ key, message }));
      }

      if (lowerBoundInt > upperBoundInt) {
        const message = `[INVALID RESOURCE]: Resource lower bound (${lowerBoundInt}) must be less than or equal to upper bound (${upperBoundInt})`;
        return [
          { key: 'lowerBound', message },
          { key: 'upperBound', message },
        ];
      }

      const initialValueInt = parseInt(initialValue as string, 10);
      if (isNaN(initialValueInt)) {
        return [
          {
            key: 'initialValue',
            message: `[INVALID RESOURCE]: Resource must have a valid numeric initial value, got: "${initialValue}"`,
          },
        ];
      }

      if (initialValueInt < lowerBoundInt || initialValueInt > upperBoundInt) {
        return [
          {
            key: 'initialValue',
            message: `[INVALID RESOURCE]: Initial value (${initialValueInt}) must be within bounds [${lowerBoundInt}, ${upperBoundInt}]`,
          },
        ];
      }

      return [];
    }
    default:
      return [
        {
          key: 'type',
          message: `[INVALID RESOURCE]: Unsupported resource type: ${type}`,
        },
      ];
  }
};

/** The first issue mapGoalProps/mapTaskProps/mapResourceProps would throw today, if any. */
export const firstGoalOrTaskIssue = (
  kind: 'goal' | 'task',
  raw: Partial<Record<string, string>>,
): string | null => goalOrTaskIssues(kind, raw)[0]?.message ?? null;
export const firstResourceIssue = (
  raw: Partial<Record<string, string>>,
): string | null => resourceIssues(raw)[0]?.message ?? null;

export const edgeGoalChecks: Partial<Record<EdgeGoalKey, Check>> = {
  variables: (raw) =>
    goalOrTaskIssues('goal', raw).find((i) => i.key === 'variables')?.message ??
    null,
  maintain: (raw) =>
    goalOrTaskIssues('goal', raw).find((i) => i.key === 'maintain')?.message ??
    null,
  assertion: (raw) =>
    goalOrTaskIssues('goal', raw).find((i) => i.key === 'assertion')?.message ??
    null,
  maxRetries: (raw) =>
    goalOrTaskIssues('goal', raw).find((i) => i.key === 'maxRetries')
      ?.message ?? null,
  dependsOn: dependsOnCheck,
};

// 'maintain' isn't an allowed task key (EDGE_TASK_KEYS), so a task can never satisfy
// getMaintainCondition's 'maintain' in raw check once type is 'maintain': mapTaskProps
// always throws it, through firstGoalOrTaskIssue, with no key to attach it to in the UI.
export const edgeTaskChecks: Partial<Record<EdgeTaskKey, Check>> = {
  maxRetries: (raw) =>
    goalOrTaskIssues('task', raw).find((i) => i.key === 'maxRetries')
      ?.message ?? null,
};

export const edgeResourceChecks: Partial<Record<EdgeResourceKey, Check>> = {
  type: (raw) =>
    resourceIssues(raw).find((i) => i.key === 'type')?.message ?? null,
  initialValue: (raw) =>
    resourceIssues(raw).find((i) => i.key === 'initialValue')?.message ?? null,
  lowerBound: (raw) =>
    resourceIssues(raw).find((i) => i.key === 'lowerBound')?.message ?? null,
  upperBound: (raw) =>
    resourceIssues(raw).find((i) => i.key === 'upperBound')?.message ?? null,
};

/**
 * The checks the Edge definitions name (`check: 'edge.goal.dependsOn'`), by
 * name: where an editor binds a definition's properties to these functions.
 */
export const edgeCheckRegistry = {
  'edge.goal.variables': edgeGoalChecks.variables!,
  'edge.goal.maintain': edgeGoalChecks.maintain!,
  'edge.goal.assertion': edgeGoalChecks.assertion!,
  'edge.goal.maxRetries': edgeGoalChecks.maxRetries!,
  'edge.goal.dependsOn': edgeGoalChecks.dependsOn!,
  'edge.task.maxRetries': edgeTaskChecks.maxRetries!,
  'edge.resource.type': edgeResourceChecks.type!,
  'edge.resource.initialValue': edgeResourceChecks.initialValue!,
  'edge.resource.lowerBound': edgeResourceChecks.lowerBound!,
  'edge.resource.upperBound': edgeResourceChecks.upperBound!,
} satisfies Record<EdgeCheckName, Check>;

export type EdgeCheckName = CheckNameOf<typeof edge>;
