/**
 * The agent's run over a scenario: its goal base G, its beliefs B, and the
 * transition rules of each adopted goal (./architecture) applied until none
 * fires, step after step. A step's beliefs and outcomes are the world's
 * answer to what the agent pursues (#134 D5).
 *
 * - Adoption (§4.2): a root goal is adopted when its creation condition
 *   becomes true, or at the first step without one (AAMAS 2009 fn. 1:
 *   creation conditions are for root goals). An error is a root goal whose
 *   condition is its creation condition (#134 D7).
 * - deliberate(g, B) (§4.2.2, "in its simplest form … the whole set of
 *   subgoals") returns a goal's children in the order its sequence links
 *   put them; an OR-decomposed goal's alternatives, the one whose means
 *   contribute most to the qualities first (§3.1: "the agent will pursue
 *   the subgoal that maximizes contribution to its softgoal", which the
 *   paper leaves unformalised; ours, #134 D8); then the links' order.
 * - A subgoal is adopted when its parent may (`mayAdopt`): the first of Γ
 *   no active goal inhibits. A task, or a goal the scenario gives an
 *   outcome, is executed: the step's outcome is its result. Any other goal
 *   runs its own lifecycle; its parent waits until it is dropped.
 * - Dropping a goal adds success(g) or failed(g) to B (§4.2.4); a failed
 *   goal's failures (its failure links) occur.
 */
import type { Tropos4asElement, Tropos4asModel } from '../model';
import { goalTypeOf, onFailureOf } from '../model';
import type { Outcome, Scenario } from '../scenarios';
import type { CONDITION_KEYS, GoalState, RuleName } from '../vocabulary';
import {
  mayAdopt,
  nextTransition,
  subgoalTransition,
  type GoalInstance,
  type Transition,
} from './architecture';
import {
  conditionOf,
  failedOf,
  FALSE,
  successOf,
  type Condition,
} from './conditions';
import {
  achieve,
  maintain,
  perform,
  type Instantiation,
} from './instantiations';

/** One line of the trace: a goal's rule and what it led to. */
export type TraceRow = {
  /** the scenario's step, from 1 */
  step: number;
  /** the goal's (or the executed element's) id */
  goal: string;
  /** the rule that fired; `outcome` for an executed element's result */
  rule: RuleName | 'outcome';
  /** its state after the rule; `success` or `failed` once dropped (an outcome: `success` or `failure`) */
  state: GoalState | 'success' | 'failed' | Outcome;
  /** Γ after the rule */
  gamma: readonly string[];
};

/** A goal at the end of a step: its state (or how it was dropped) and the last rule. */
export type GoalStatus = {
  state: GoalState | 'success' | 'failed';
  rule: RuleName;
};

export type LifecycleRun = {
  scenario: Scenario;
  rows: readonly TraceRow[];
  /** each step's goals, by id, as the step left them (a goal never adopted is absent) */
  steps: readonly {
    label: string;
    goals: ReadonlyMap<string, GoalStatus>;
    /** the failures that have occurred, by id */
    failures: ReadonlySet<string>;
  }[];
};

/** How many rules a step may fire before the run is said not to settle. */
const MAX_TRANSITIONS = 10_000;

/** a goal's condition properties, and an error's */
type ConditionKey = (typeof CONDITION_KEYS)[number] | 'condition';

const condition = (
  goal: Tropos4asElement,
  key: ConditionKey,
  goals: ReadonlySet<string>,
): Condition | null =>
  conditionOf(goal.values[key], goal.properties[key], goals);

/** A goal's instance of §4.3, from its type and conditions. */
export const instantiationOf = (
  goal: Tropos4asElement,
  goals: ReadonlySet<string> = new Set(),
): Instantiation => {
  if (goal.kind === 'error') return perform();
  const type = goalTypeOf(goal);
  if (type === 'perform') return perform();
  if (type === 'maintain') {
    const m = condition(goal, 'maintain', goals);
    if (!m)
      throw new Error(
        `${goal.label} is a maintain-goal without its maintain condition`,
      );
    return maintain(
      m,
      condition(goal, 'drop', goals) ?? FALSE,
      condition(goal, 'target', goals) ?? undefined,
    );
  }
  const s = condition(goal, 'achievement', goals);
  // without a success condition there is nothing to evaluate: it runs as P
  return s
    ? achieve(s, condition(goal, 'failure', goals) ?? FALSE, onFailureOf(goal))
    : perform();
};

type Runtime = GoalInstance & {
  goal: Tropos4asElement;
  parent?: Runtime;
  /** the subgoal adopted and not yet returned */
  awaiting?: string;
};

export const runLifecycle = (
  model: Tropos4asModel,
  scenario: Scenario,
): LifecycleRun => {
  const goalIds = new Set(model.goals.map((goal) => goal.label));
  const instantiations = new Map(
    model.goals.map((goal) => [goal, instantiationOf(goal, goalIds)]),
  );
  const creations = new Map(
    model.goals.map((goal) => [
      goal,
      condition(
        goal,
        goal.kind === 'error' ? 'condition' : 'creation',
        goalIds,
      ),
    ]),
  );
  const labelOf = (key: string) => model.find(key)?.label ?? key;
  const executed = new Set(
    scenario.steps.flatMap((step) => Object.keys(step.outcomes).map(labelOf)),
  );
  const isExecuted = (element: Tropos4asElement) =>
    element.kind !== 'goal' && element.kind !== 'error'
      ? true
      : executed.has(element.label) ||
        model.refinement(element).children.length === 0;
  const roots = model.goals.filter((goal) => !model.parentOf(goal));

  const beliefs = new Map<string, boolean | number | string>();
  const G: Runtime[] = [];
  const returned = new Map<string, Outcome>();
  const status = new Map<string, GoalStatus>();
  const failures = new Set<string>();
  const creationWas = new Map<Tropos4asElement, boolean>();
  const rows: TraceRow[] = [];
  const steps: LifecycleRun['steps'][number][] = [];
  let step = 0;

  const row = (
    goal: string,
    rule: TraceRow['rule'],
    state: TraceRow['state'],
    gamma: readonly string[],
  ) => {
    rows.push({ step, goal, rule, state, gamma });
    if (rule !== 'outcome')
      status.set(goal, { state: state as GoalStatus['state'], rule });
  };

  /** deliberate(g, B): its children, in the order its sequence links put them */
  const deliberate = (goal: Tropos4asElement): string[] => {
    const { relation, children: linked } = model.refinement(goal);
    const children =
      relation === 'OR'
        ? linked
            .map((child, i) => ({ child, i, by: model.contributionOf(child) }))
            .sort((a, b) => b.by - a.by || a.i - b.i)
            .map(({ child }) => child)
        : linked;
    const ordered: Tropos4asElement[] = [];
    while (ordered.length < children.length) {
      const next =
        children.find(
          (child) =>
            !ordered.includes(child) &&
            model
              .predecessors(child)
              .every((p) => !children.includes(p) || ordered.includes(p)),
        ) ?? children.find((child) => !ordered.includes(child))!;
      ordered.push(next);
    }
    return ordered.map((child) => child.label);
  };

  const active = (goal: Tropos4asElement) =>
    G.some((rt) => rt.goal === goal && rt.state !== 'Suspended');
  const inhibited = (id: string) => {
    const element = model.find(id);
    return element ? model.inhibitors(element).some(active) : false;
  };

  const adopt = (goal: Tropos4asElement, parent?: Runtime) => {
    const { relation } = model.refinement(goal);
    G.push({
      goal,
      state: 'Suspended',
      gamma: [],
      relation: relation ?? 'AND',
      instantiation: instantiations.get(goal)!,
      ...(parent && { parent }),
    });
    row(goal.label, 'adopt', 'Suspended', []);
  };

  const believe = (id: string, outcome: Outcome) => {
    beliefs.set(successOf(id), outcome === 'success');
    beliefs.set(failedOf(id), outcome !== 'success');
  };

  const apply = (rt: Runtime, transition: Transition) => {
    rt.state = transition.state;
    rt.gamma = transition.gamma;
    const id = rt.goal.label;
    if (!transition.dropped) {
      row(id, transition.rule, transition.state, transition.gamma);
      return;
    }
    row(id, transition.rule, transition.dropped, transition.gamma);
    G.splice(G.indexOf(rt), 1);
    const outcome = transition.dropped === 'success' ? 'success' : 'failure';
    believe(id, outcome);
    if (rt.parent) returned.set(id, outcome);
    if (outcome === 'failure')
      for (const failure of model.failuresOf(rt.goal))
        failures.add(failure.label);
  };

  /** One rule of a goal, or its subgoal's return; false when it waits. */
  const advance = (rt: Runtime, outcomes: Map<string, Outcome>): boolean => {
    if (!G.includes(rt)) return false;
    if (rt.awaiting) {
      const child = rt.awaiting;
      let outcome = returned.get(child);
      if (outcome) returned.delete(child);
      else {
        if (G.some((other) => other.goal.label === child)) return false;
        outcome = outcomes.get(child);
        if (!outcome) return false;
        outcomes.delete(child);
        row(child, 'outcome', outcome, []);
        believe(child, outcome);
      }
      rt.awaiting = undefined;
      apply(rt, subgoalTransition(rt, child, outcome));
      return true;
    }
    const transition = nextTransition(rt, beliefs, () => deliberate(rt.goal));
    if (transition) {
      apply(rt, transition);
      return true;
    }
    if (!mayAdopt(rt, beliefs)) return false;
    const subgoal = rt.gamma.find((id) => !inhibited(id));
    if (!subgoal) return false;
    rt.awaiting = subgoal;
    const element = model.find(subgoal);
    if (element && !isExecuted(element)) adopt(element, rt);
    return true;
  };

  for (const scenarioStep of scenario.steps) {
    step += 1;
    for (const [name, value] of Object.entries(scenarioStep.beliefs))
      beliefs.set(name, value);
    const outcomes = new Map(
      Object.entries(scenarioStep.outcomes).map(([key, outcome]) => [
        labelOf(key),
        outcome,
      ]),
    );
    for (const root of roots) {
      const creation = creations.get(root);
      const now = creation ? creation.holds(beliefs) : true;
      const before = creationWas.get(root) ?? false;
      creationWas.set(root, now);
      if (now && !before && !G.some((rt) => rt.goal === root)) adopt(root);
    }
    let fired = 0;
    for (let progress = true; progress;) {
      progress = false;
      // a pass over G as it was: adopting and dropping change it meanwhile
      for (const rt of G.slice())
        if (advance(rt, outcomes)) {
          progress = true;
          if (++fired > MAX_TRANSITIONS)
            throw new Error(
              `The lifecycle doesn't settle at step ${step} (${scenarioStep.label}): over ${MAX_TRANSITIONS} transitions`,
            );
        }
    }
    steps.push({
      label: scenarioStep.label,
      goals: new Map(
        model.goals.flatMap((goal) => {
          const s = status.get(goal.label);
          return s ? [[goal.label, s] as const] : [];
        }),
      ),
      failures: new Set(failures),
    });
  }
  return { scenario, rows, steps };
};
