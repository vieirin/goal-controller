/**
 * The property checks edge/mapper.ts and edgeV2/mapper.ts both make (they're near-copies
 * of each other): a shared module, since the checks are identical today. Split it if the
 * two engines' rules ever diverge.
 *
 * They read the values the dialect read (goal-controller#187, #222: `props`): a value
 * the dialect cannot read is its own diagnostic (the dialect's value check says it), so
 * no check is run on it, and the mapper reads it as unset.
 */
import { ISTAR_KIND_OF, type DECLARATION_KEYS } from '@goal-controller/dialect';
import {
  readProperties,
  type PropertyValues,
} from '@goal-controller/goal-language';
import { checkOn, checks, type Check } from '../checks';
import { edgeProperties } from './properties';
import type { EdgeResourceVariable } from './types';

/** A key a resource's declaration sets (`{int 0..100 = 80}`). */
type DeclaredKey = (typeof DECLARATION_KEYS)[number];

type Issue = { key: string; message: string };

type EdgeKind = 'goal' | 'task' | 'resource';

/** An element's values as the Edge dialects read them (unset: absent). */
export type EdgeValues<K extends EdgeKind> = PropertyValues<
  (typeof edgeProperties)[K]
>;

/** The Edge dialects' properties, as `readProperties` and `checkOn` read them. */
const EDGE = { properties: edgeProperties };

/** A check on a goal's properties, on a resource's. */
const onGoal = checkOn(EDGE, { element: 'goal' });
const onResource = checkOn(EDGE, { element: 'resource' });

/** The message of the first issue on this key. */
const messageOn = (issues: Issue[], key: string): string | null =>
  issues.find((i) => i.key === key)?.message ?? null;

/**
 * goal/task issues, the maintain condition's: the first entry is the one the mapper
 * throws. The decision variables and maxRetries have none of their own: a pair, or an
 * int below its min, that the dialect can't read is its value check's.
 */
const goalOrTaskIssues = (
  kind: 'goal' | 'task',
  values: EdgeValues<'goal'> | EdgeValues<'task'>,
  raw: Partial<Record<string, string>>,
): Issue[] => {
  const issues: Issue[] = [];

  if (values.type === 'maintain') {
    // not a task key: a task can never have one
    const maintain = 'maintain' in values ? values.maintain : undefined;
    // absent or blank: the Inspector validates with maintain:'' while typing
    if (!maintain) {
      issues.push({
        key: 'maintain',
        message: `[INVALID MODEL]: Maintain condition for ${kind} must have 'maintain' and 'assertion'; got maintain: none, assertion: ${values.assertion?.text() || "'empty condition'"}`,
      });
    } else if (!values.assertion) {
      issues.push({
        key: 'assertion',
        message: `[INVALID MODEL]: Maintain condition for ${kind} must have 'maintain' and 'assertion'; got maintain: ${raw.maintain}, assertion: 'empty condition'`,
      });
    }
  }

  return issues;
};

/** An iStar kind by the name the Edge dialects give it (`istar.Task`: `task`). */
const EDGE_KIND_NAME: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(ISTAR_KIND_OF).map(([name, kind]) => [kind, name]),
);

/** afterCreationMapper's dependsOn resolution, word for word (existence, then goal-ness). */
const dependsOnCheck = onGoal(({ props }, { self, kindOf }) => {
  for (const id of props.dependsOn ?? []) {
    const kind = kindOf(id);
    if (!kind) {
      return `[INVALID MODEL]: Dependency ${id} not found for node ${self}`;
    }
    if (kind !== ISTAR_KIND_OF.goal) {
      return `[INVALID MODEL]: Dependency ${id} for node ${self} must be a goal, got ${EDGE_KIND_NAME[kind] ?? kind}`;
    }
  }
  return null;
});

/**
 * A resource's variable, or its issues (in mapResourceProps's order, one branch per
 * resource type): the first is the one the mapper throws.
 */
export const resourceReading = (
  values: EdgeValues<'resource'>,
  raw: Partial<Record<string, string>>,
): { issues: Issue[]; variable: EdgeResourceVariable | null } => {
  const { initialValue, lowerBound, upperBound } = values;
  const issues = (keys: DeclaredKey[], message: string) => ({
    issues: keys.map((key) => ({ key, message })),
    variable: null,
  });

  switch (values.type) {
    case 'bool': {
      if (typeof initialValue !== 'boolean') {
        return issues(
          ['initialValue'],
          `[INVALID RESOURCE]: Boolean resource must have initialValue of 'true' or 'false', got: ${raw.initialValue === undefined ? 'undefined' : `"${raw.initialValue}"`}`,
        );
      }
      return {
        issues: [],
        variable: { type: 'boolean', initialValue },
      };
    }
    case 'int': {
      // unset, blank or unreadable (an int resource's initial value reads as an int)
      if (
        typeof initialValue !== 'number' ||
        lowerBound == null ||
        upperBound == null
      ) {
        const missing = [
          typeof initialValue !== 'number' && 'initialValue',
          lowerBound == null && 'lowerBound',
          upperBound == null && 'upperBound',
        ].filter((key): key is DeclaredKey => key !== false);
        return issues(
          missing,
          '[INVALID RESOURCE]: Integer resource must have an initial value, lower bound, and upper bound',
        );
      }

      if (lowerBound > upperBound) {
        return issues(
          ['lowerBound', 'upperBound'],
          `[INVALID RESOURCE]: Resource lower bound (${lowerBound}) must be less than or equal to upper bound (${upperBound})`,
        );
      }

      if (initialValue < lowerBound || initialValue > upperBound) {
        return issues(
          ['initialValue'],
          `[INVALID RESOURCE]: Initial value (${initialValue}) must be within bounds [${lowerBound}, ${upperBound}]`,
        );
      }

      return {
        issues: [],
        variable: { type: 'int', initialValue, lowerBound, upperBound },
      };
    }
    default:
      return {
        issues: [
          {
            key: 'type',
            message: `[INVALID RESOURCE]: Unsupported resource type: ${raw.type}`,
          },
        ],
        variable: null,
      };
  }
};

/** The first issue mapGoalProps/mapTaskProps throws, if any: of the values the mapper is given. */
export const firstGoalOrTaskIssue = (
  kind: 'goal' | 'task',
  values: EdgeValues<'goal'> | EdgeValues<'task'>,
  raw: Partial<Record<string, string>>,
): string | null => goalOrTaskIssues(kind, values, raw)[0]?.message ?? null;

/** The first issue mapResourceProps throws, if any: of the strings, read as the dialect reads them. */
export const firstResourceIssue = (
  raw: Partial<Record<string, string>>,
): string | null =>
  resourceReading(
    readProperties(EDGE, { element: 'resource' }, raw).values,
    raw,
  ).issues[0]?.message ?? null;

/** The check of a goal's key: its first issue. */
const goalCheck = (key: string): Check =>
  onGoal(({ props, raw }) =>
    messageOn(goalOrTaskIssues('goal', props, raw), key),
  );

/** The check of a resource's key: its first issue. */
const resourceCheck = (key: string): Check =>
  onResource(({ props, raw }) =>
    messageOn(resourceReading(props, raw).issues, key),
  );

export const edgeGoalChecks = checks({
  maintain: goalCheck('maintain'),
  assertion: goalCheck('assertion'),
  dependsOn: dependsOnCheck,
});

// 'maintain' isn't a task key (EDGE_TASK_KEYS), so a task can never satisfy the
// maintain condition once its type is 'maintain': mapTaskProps always throws it,
// through firstGoalOrTaskIssue, with no key to attach it to in the UI. A task's
// keys have no engine check: the dialect's value checks say what is wrong (#251).
export const edgeTaskChecks = checks({});

export const edgeResourceChecks = checks({
  type: resourceCheck('type'),
  initialValue: resourceCheck('initialValue'),
  lowerBound: resourceCheck('lowerBound'),
  upperBound: resourceCheck('upperBound'),
});

/**
 * The names of the Edge engines' checks: what a property's `check` may be
 * (listed, not derived from the registry: the checks read the dialect's
 * values, typed by the definition, which names them).
 */
export type EdgeCheckName =
  | 'edge.goal.maintain'
  | 'edge.goal.assertion'
  | 'edge.goal.dependsOn'
  | 'edge.resource.type'
  | 'edge.resource.initialValue'
  | 'edge.resource.lowerBound'
  | 'edge.resource.upperBound';

/**
 * The checks the Edge definitions name, by name: one for each name (a
 * missing or an unknown one doesn't compile). A property's `check` is typed
 * with them (`EdgeCheckName`), and `specsFromDefinition` needs one for every
 * name a definition gives.
 */
export const edgeCheckRegistry = checks<EdgeCheckName>({
  'edge.goal.maintain': edgeGoalChecks.maintain,
  'edge.goal.assertion': edgeGoalChecks.assertion,
  'edge.goal.dependsOn': edgeGoalChecks.dependsOn,
  'edge.resource.type': edgeResourceChecks.type,
  'edge.resource.initialValue': edgeResourceChecks.initialValue,
  'edge.resource.lowerBound': edgeResourceChecks.lowerBound,
  'edge.resource.upperBound': edgeResourceChecks.upperBound,
});
