/**
 * What edge/mapper.ts and edgeV2/mapper.ts make of an element's properties, the same
 * in both (their dialects give the same properties): each engine's mapper is these,
 * with its own dialect and goal type. They read the values as the dialect reads them
 * (goal-controller#187); the texts as written are what the templates write.
 */
import { ISTAR_KIND_OF } from '@goal-controller/dialect';
import {
  edgeGoalChecks,
  firstGoalOrTaskIssue,
  resourceReading,
  type EdgeValues,
} from './checks';
import type {
  Condition,
  Decision,
  EdgeResourceProps,
  EdgeTaskProps,
  ExecCondition,
} from './types';

/** An element's properties as a mapper is given them: read, and as written. */
type Input<K extends 'goal' | 'task' | 'resource'> = {
  props: EdgeValues<K>;
  raw: Partial<Record<string, string>>;
  id: string;
};

type AssertionValue = EdgeValues<'goal'>['assertion'];

/** A condition: its text as written (what the templates write), and the names it reads. */
const conditionOf = (
  value: AssertionValue,
  written: string | undefined,
): Condition => ({
  sentence: written ?? '',
  variables: value?.variables() ?? [],
});

/**
 * The assertion alone (any type but maintain): set as written, a blank one too;
 * unset when absent, empty or unreadable.
 */
const assertionCondition = (
  props: EdgeValues<'goal'> | EdgeValues<'task'>,
  raw: Partial<Record<string, string>>,
): ExecCondition | undefined =>
  raw.assertion && props.assertion !== undefined
    ? { assertion: conditionOf(props.assertion, raw.assertion) }
    : undefined;

/** A reward: its number as written ('' when unset or unreadable). */
const rewardOf = (
  value: number | null | undefined,
  written: string | undefined,
): string => (value == null ? '' : (written ?? ''));

/**
 * The decision variables, `name:space` pairs with an int space, as the dialect reads
 * them: none when unset or unreadable (the dialect's value check says what is wrong).
 */
const decisionOf = (variables: EdgeValues<'goal'>['variables']): Decision => {
  const decisionVars = (variables ?? []).map(({ name, value }) => ({
    variable: name,
    space: value,
  }));
  return { decisionVars, hasDecision: decisionVars.length > 0 };
};

/**
 * A goal's properties, its execution detail (in the engine's dialect) among them; its
 * dependencies are afterCreationMapper's (edgeDependsOn).
 */
export const edgeGoalProps = <TExecution, TGoalNode>({
  props,
  raw,
  id,
  executionDetail,
}: Input<'goal'> & { executionDetail: TExecution | null }) => {
  // dependsOn needs the whole tree: checked later, in afterCreationMapper
  const issue = firstGoalOrTaskIssue('goal', props, raw);
  if (issue) throw new Error(`${issue} (node ${id})`);

  return {
    utility: rewardOf(props.utility, raw.utility),
    cost: rewardOf(props.cost, raw.cost),
    dependsOn: [] as TGoalNode[],
    executionDetail,
    // a maintain goal has both conditions (the checks say so otherwise)
    execCondition:
      props.type === 'maintain'
        ? {
            maintain: conditionOf(props.maintain, raw.maintain),
            assertion: conditionOf(props.assertion, raw.assertion),
          }
        : assertionCondition(props, raw),
    decision: decisionOf(props.variables),
    maxRetries: props.maxRetries ?? 0,
  };
};

export const edgeTaskProps = ({
  props,
  raw,
  id,
}: Input<'task'>): EdgeTaskProps => {
  // a task of type maintain is one of these (maintain is no task key)
  const issue = firstGoalOrTaskIssue('task', props, raw);
  if (issue) throw new Error(`${issue} (node ${id})`);

  return {
    execCondition: assertionCondition(props, raw),
    maxRetries: props.maxRetries ?? 0,
    utility: rewardOf(props.utility, raw.utility),
    cost: rewardOf(props.cost, raw.cost),
  };
};

export const edgeResourceProps = ({
  props,
  raw,
  id,
}: Input<'resource'>): EdgeResourceProps => {
  const { issues, variable } = resourceReading(props, raw);
  if (!variable) throw new Error(`${issues[0]?.message} (node ${id})`);
  return { variable };
};

/**
 * A goal's dependencies, the nodes its dependsOn names (as allNodes holds them), once
 * the tree is built: throws edgeGoalChecks.dependsOn's message for an id that is no
 * goal of it. A dependsOn the dialect left unset (unreadable, or an id that names no
 * goal of the model) is none: generation refuses that model first, with the dialect's
 * own message (goal-controller#274, #290). #266: a Quality is answered by its `kind`
 * (under the iStar naming its `type` is also `goal`).
 *
 * `allNodes` is a getter (not `Map`) so kind-entry maps type-check without Map
 * invariance fighting `KindNode`.
 */
export const edgeDependsOn = <TNode extends { type: string; kind?: string }>(
  self: string,
  { props, raw }: Omit<Input<'goal'>, 'id'>,
  allNodes: { get(id: string): TNode | undefined },
): Extract<TNode, { type: 'goal' }>[] => {
  const { dependsOn } = props;
  const message = edgeGoalChecks.dependsOn?.(
    { props, raw, kind: ISTAR_KIND_OF.goal },
    {
      self,
      kindOf: (id) => {
        const node = allNodes.get(id);
        if (!node) return undefined;
        // #266: entries put istar.Quality on the node; type alone is still 'goal'
        if (node.kind) return node.kind;
        if (
          node.type === 'goal' ||
          node.type === 'task' ||
          node.type === 'resource'
        ) {
          return ISTAR_KIND_OF[node.type];
        }
        return undefined;
      },
    },
  );
  if (message) throw new Error(message);
  // #233: allNodes holds the tree's own nodes (afterCreation updates in place)
  return (dependsOn ?? []).map((id) => {
    const node = allNodes.get(id);
    if (!node) throw new Error(`dependsOn node ${id} not found (node ${self})`);
    return node;
  }) as Extract<TNode, { type: 'goal' }>[];
};
