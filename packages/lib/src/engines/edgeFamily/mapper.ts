/**
 * What edge/mapper.ts and edgeV2/mapper.ts make of an element's properties, the same
 * in both (their dialects give the same properties): each engine's mapper is these,
 * with its own dialect and goal type. They read the values as the dialect reads them
 * (goal-controller#187); the texts as written are what the templates write.
 */
import { ISTAR_KIND_OF } from '@goal-controller/dialect';
import { parseValue } from '@goal-controller/goal-language';
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
 * dependencies are the entry's afterCreation's (edgeGoalWithDependencies).
 */
export const edgeGoalProps = <TExecution, TGoalNode>({
  props,
  raw,
  id,
  executionDetail,
}: Input<'goal'> & { executionDetail: TExecution | null }) => {
  // dependsOn needs the whole tree: checked later, in the entry's afterCreation
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

/** A node as edgeDependsOn looks it up: its type, and its kind when entries set one. */
type DependsOnNode = {
  type: string;
  kind?: string;
  // open: per-role nodes have isQuality; entries have engine (goal-controller#266)
  properties?: object;
};

/**
 * A goal's dependencies, the nodes its dependsOn names (as allNodes holds them), once
 * the tree is built: throws edgeGoalChecks.dependsOn's message for an id that is no
 * goal of it. Unreadable: none. A dependsOn the dialect left unset because an id
 * names no goal of the model (goal-controller#270) still refuses when the text is a
 * readable list — dropping it would change generation.
 */
export const edgeDependsOn = <TNode = DependsOnNode>(
  self: string,
  { props, raw }: Omit<Input<'goal'>, 'id'>,
  allNodes: { get(id: string): unknown },
): TNode[] => {
  // #270: raw keeps the text; props is unset when an id names no element, or no
  // goal. Re-read the ids so edgeGoalChecks.dependsOn still throws as before.
  const dependsOn =
    props.dependsOn ??
    (() => {
      const text = raw.dependsOn;
      if (!text?.trim()) return undefined;
      const read = parseValue('refList', text);
      if (read.errors.length || read.value == null) return undefined;
      return [...read.value];
    })();

  const message = edgeGoalChecks.dependsOn?.(
    { props: { ...props, dependsOn }, raw, kind: ISTAR_KIND_OF.goal },
    {
      self,
      kindOf: (id) => {
        const node = allNodes.get(id) as DependsOnNode | undefined | null;
        if (!node) return undefined;
        // entries: kind is on the node; per-role sugar: Quality is a goal with
        // isQuality (goal-controller#266)
        if (node.kind) return node.kind;
        const isQuality =
          node.properties != null &&
          'isQuality' in node.properties &&
          Boolean((node.properties as { isQuality?: boolean }).isQuality);
        if (node.type === 'goal' && isQuality) return ISTAR_KIND_OF.quality;
        const type = node.type as keyof typeof ISTAR_KIND_OF;
        return ISTAR_KIND_OF[type];
      },
    },
  );
  if (message) throw new Error(message);
  return (dependsOn ?? []).map((id) => allNodes.get(id) as TNode);
};
