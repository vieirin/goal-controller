/**
 * kaosprop's analyses (goal-controller#181): Cailliau and van Lamsweerde's
 * probabilistic obstacle analysis (RE'12, §IV and Table I; REJ 18(2) 2013).
 * Probabilities go up the obstacle refinement trees, from the root
 * obstacles to the leaf goals they obstruct, and up the goal refinement
 * graph:
 *
 * - an obstacle refinement (a hub) occurs when all its sub-obstacles do
 *   and they lead to the obstacle: `Π P(SOi) · P(O | SO1..n)`, the hub's
 *   `Probability` (default 1); a domain property in it holds (1). Several
 *   refinements of one obstacle are an OR: `1 − Π(1 − P(hub))`. With one
 *   sub-obstacle per refinement, that is RE'12's OR rule,
 *   `1 − Π(1 − P(SOi) · P(O | SOi))`. A leaf obstacle's is its estimate;
 * - a leaf goal is satisfied when none of its obstacles violates it:
 *   `Π(1 − P(Oi) · P(¬G | Oi))`, each obstruction's `Probability` (default
 *   1). One nothing obstructs is its `ESR`, an estimate (default 1);
 * - a goal refinement (a hub), by its tactic: case-driven,
 *   `Σ P(CSi) · P(SGi)` over its legs' `Probability`; any other, or none,
 *   `Π P(SGi)` (Table I's milestone-driven, guard-introduction,
 *   divide-and-conquer, uncontrollability- and unmonitorability-driven
 *   rules). Several refinements of one goal are alternatives, either of
 *   which suffices: `1 − Π(1 − P(hub))` (RE'12's general rule with
 *   `P(G | SGi, ¬SGj) = 1`);
 * - a goal's EPS is that probability; with an `RSR`, its violation
 *   severity is `SV = RSR − EPS`, a warning when positive.
 *
 * The result is one case, run as steps, one per element computed, each
 * saying how (the propagation report). A second analysis lists the
 * critical combinations of leaf obstacles (RE'12 §V): the singletons and
 * pairs that, occurring alone (every other leaf obstacle at 0), leave a
 * goal with an RSR under it.
 *
 * Every quantity and tactic is read as kaosprop's dialect reads it
 * (`viewValues`, goal-controller#244): a value written with an error is
 * unset, so it counts as its default, and the dialect's checks report it.
 */
import {
  viewValues,
  type AnalysisCase,
  type AnalysisElement,
  type AnalysisLink,
  type AnalysisModel,
  type AnalysisResult,
  type AnalysisStep,
  type AnalysisValue,
  type ViewValues,
} from '../analysis';
import { kaosprop } from './definition';

const GOAL_KINDS = new Set(['kaos.BehavioralGoal', 'kaos.Softgoal']);
const OBSTACLE = 'kaosObstacles.Obstacle';
const GOAL_REFINEMENT = 'kaos.RefinementLink';
const OBSTACLE_REFINEMENT = 'kaosObstacles.ObstacleRefinementLink';
const OBSTRUCTION = 'kaosObstacles.ObstructionLink';

/** A refinement's tactic, KAOSTools' names read as the ones they stand for. */
const CASE_DRIVEN = new Set(['case-driven', 'case']);

type KaospropValues = ViewValues<typeof kaosprop>;
/** An element's values, as its kind's in kaosprop's dialect. */
const valuesOf = (element: AnalysisElement): KaospropValues =>
  viewValues(kaosprop, 'element', element);
/** A link's values, as its kind's in kaosprop's dialect. */
const linkValuesOf = (link: AnalysisLink): KaospropValues =>
  viewValues(kaosprop, 'link', link);

/** A probability as people read it: `92.77%`. */
export const percent = (p: number): string =>
  `${(Math.round(p * 10000) / 100).toFixed(2)}%`;

/** One element's probability, and how it was computed. */
export type KaosStep = { id: string; probability: number; why: string };

/** What the propagation gives: each goal's EPS, each obstacle's probability, in order. */
export type KaosPropagation = {
  /** goals' EPS and obstacles' probabilities, by piStar id */
  probabilities: ReadonlyMap<string, number>;
  steps: readonly KaosStep[];
};

/** A refinement: its hub, the element it refines, and its legs (child, P(CS)). */
export type Hub = {
  id: string;
  kind: string;
  parent: string;
  legs: { child: string; probability: number | null | undefined }[];
  values: KaospropValues;
};

/**
 * The model's refinements, by the element they refine (KAOS's goals',
 * obstacles'); kaosexpert reads them too (its dialect's hubs and legs are
 * kaosprop's).
 */
export const hubsOf = (model: AnalysisModel): Map<string, Hub[]> => {
  const byParent = new Map<string, Hub[]>();
  for (const kind of [GOAL_REFINEMENT, OBSTACLE_REFINEMENT]) {
    const hubs = new Map<string, Hub>();
    for (const element of model.elements)
      if (element.kind === `${kind}Hub`)
        hubs.set(element.id, {
          id: element.id,
          kind,
          parent: '',
          legs: [],
          values: valuesOf(element),
        });
    for (const link of model.links) {
      const hub = hubs.get(
        link.kind === `${kind}End` ? link.source : link.target,
      );
      if (!hub) continue;
      if (link.kind === `${kind}End`) hub.parent = link.target;
      else if (link.kind === `${kind}Start`)
        hub.legs.push({
          child: link.source,
          probability: linkValuesOf(link).Probability,
        });
    }
    for (const hub of hubs.values())
      if (hub.parent)
        byParent.set(hub.parent, [...(byParent.get(hub.parent) ?? []), hub]);
  }
  return byParent;
};

/** The model's obstructions, by the goal they obstruct: the obstacle and P(¬G|O) as written. */
export const obstructionsOf = (
  model: AnalysisModel,
): Map<string, { obstacle: string; p: number | null | undefined }[]> => {
  const obstructions = new Map<
    string,
    { obstacle: string; p: number | null | undefined }[]
  >();
  for (const link of model.links)
    if (link.kind === OBSTRUCTION)
      obstructions.set(link.target, [
        ...(obstructions.get(link.target) ?? []),
        { obstacle: link.source, p: linkValuesOf(link).Probability },
      ]);
  return obstructions;
};

/** `1 − Π(1 − pᵢ)`: any of independent events. */
const any = (ps: readonly number[]) => 1 - ps.reduce((a, p) => a * (1 - p), 1);
const all = (ps: readonly number[]) => ps.reduce((a, p) => a * p, 1);
const round = (p: number) => Math.round(p * 1e12) / 1e12;

/**
 * Every goal's and obstacle's probability, and the steps that gave them.
 * `leaves` overrides leaf obstacles' estimates (a combination: the others
 * at 0), by piStar id.
 */
export const propagateProbabilities = (
  model: AnalysisModel,
  leaves?: ReadonlyMap<string, number>,
): KaosPropagation => {
  const elements = new Map(model.elements.map((e) => [e.id, e]));
  const nameOf = (id: string) => elements.get(id)?.name.trim() ?? id;
  const hubs = hubsOf(model);
  const obstructions = obstructionsOf(model);
  const probabilities = new Map<string, number>();
  const steps: KaosStep[] = [];
  const visiting = new Set<string>();

  const settle = (id: string, p: number, why: string): number => {
    const value = round(p);
    probabilities.set(id, value);
    steps.push({ id, probability: value, why });
    return value;
  };
  const named = (id: string) =>
    `${nameOf(id)} (${percent(probabilityOfElement(id))})`;

  /** a refinement's probability, and its reason */
  const hubProbability = (hub: Hub): [number, string] => {
    if (hub.kind === OBSTACLE_REFINEMENT) {
      const given = hub.values.Probability ?? 1;
      const p =
        all(hub.legs.map((leg) => probabilityOfElement(leg.child))) * given;
      return [
        p,
        `AND of ${hub.legs.map((leg) => named(leg.child)).join(', ')}${
          given !== 1 ? ` × P(O|SO) ${given}` : ''
        }`,
      ];
    }
    const tactic = hub.values.Tactic ?? '';
    if (CASE_DRIVEN.has(tactic)) {
      const cases = hub.legs.map((leg) => leg.probability ?? NaN);
      // two cases, one given: the other is its complement
      if (cases.length === 2 && cases.filter(Number.isNaN).length === 1)
        cases[cases.findIndex(Number.isNaN)] =
          1 - cases.find((c) => !Number.isNaN(c))!;
      const known = cases.map((c) => (Number.isNaN(c) ? 0 : c));
      const p = known.reduce(
        (a, c, i) => a + c * probabilityOfElement(hub.legs[i]!.child),
        0,
      );
      const total = round(known.reduce((a, c) => a + c, 0));
      return [
        p,
        `case-driven: ${hub.legs
          .map((leg, i) => `${known[i]} × ${named(leg.child)}`)
          .join(
            ' + ',
          )}${total === 1 ? '' : ` (the cases sum to ${total}, not 1)`}`,
      ];
    }
    // any other tactic's rule is the product of the sub-goals' (Table I)
    const rule = tactic || 'no tactic, milestone-driven';
    return [
      all(hub.legs.map((leg) => probabilityOfElement(leg.child))),
      `${rule}: ${hub.legs.map((leg) => named(leg.child)).join(' × ')}`,
    ];
  };

  /** an element's probability: an obstacle's occurring, a goal's satisfaction */
  function probabilityOfElement(id: string): number {
    const known = probabilities.get(id);
    if (known !== undefined) return known;
    const element = elements.get(id);
    if (!element) return 1;
    // a domain property holds (1); nothing else is a factor
    if (element.kind !== OBSTACLE && !GOAL_KINDS.has(element.kind)) return 1;
    if (visiting.has(id)) return element.kind === OBSTACLE ? 0 : 1;
    visiting.add(id);
    try {
      return element.kind === OBSTACLE ? obstacle(element) : goal(element);
    } finally {
      visiting.delete(id);
    }
  }

  const obstacle = (element: AnalysisElement): number => {
    const refinements = hubs.get(element.id) ?? [];
    if (refinements.length === 0) {
      if (leaves?.has(element.id))
        return settle(
          element.id,
          leaves.get(element.id)!,
          leaves.get(element.id)
            ? 'its estimate, in this combination'
            : 'not in this combination',
        );
      const given = valuesOf(element).Probability;
      return settle(
        element.id,
        given ?? 0,
        given != null ? 'its estimate' : 'no estimate: 0',
      );
    }
    const parts = refinements.map(hubProbability);
    if (parts.length === 1)
      return settle(element.id, parts[0]![0], parts[0]![1]);
    return settle(
      element.id,
      any(parts.map(([p]) => p)),
      `OR of ${parts.map(([p, why]) => `${percent(p)} (${why})`).join('; ')}`,
    );
  };

  const goal = (element: AnalysisElement): number => {
    const refinements = hubs.get(element.id) ?? [];
    const obstructing = obstructions.get(element.id) ?? [];
    const factors = obstructing.map(({ obstacle: o, p }) => {
      const given = p ?? 1;
      return {
        p: 1 - probabilityOfElement(o) * given,
        why: `${named(o)}${given !== 1 ? ` × P(¬G|O) ${given}` : ''}`,
      };
    });
    const obstructed = factors.length
      ? `obstructed by ${factors.map((f) => f.why).join(', ')}`
      : '';
    if (refinements.length === 0) {
      if (factors.length)
        return settle(
          element.id,
          all(factors.map((f) => f.p)),
          `leaf, ${obstructed}`,
        );
      const given = valuesOf(element).ESR;
      return settle(
        element.id,
        given ?? 1,
        given != null
          ? 'leaf, nothing obstructs it: its ESR'
          : 'leaf, nothing obstructs it',
      );
    }
    const parts = refinements.map(hubProbability);
    const refined =
      parts.length === 1
        ? parts[0]!
        : ([
            any(parts.map(([p]) => p)),
            `alternatives, either suffices: ${parts
              .map(([p, why]) => `${percent(p)} (${why})`)
              .join('; ')}`,
          ] as [number, string]);
    return settle(
      element.id,
      refined[0] * all(factors.map((f) => f.p)),
      obstructed ? `${refined[1]}; ${obstructed}` : refined[1],
    );
  };

  for (const element of model.elements)
    if (element.kind === OBSTACLE || GOAL_KINDS.has(element.kind))
      probabilityOfElement(element.id);
  return { probabilities, steps };
};

/** A goal's RSR, when it has one. */
const rsrOf = (element: AnalysisElement | undefined): number | null =>
  (element && valuesOf(element).RSR) ?? null;

/** An element's value on the model: an obstacle's P, a goal's EPS (and SV, a warning when positive). */
export const probabilityValue = (
  element: AnalysisElement,
  p: number,
): AnalysisValue => {
  if (element.kind === OBSTACLE) return { value: p, label: `P ${percent(p)}` };
  const rsr = rsrOf(element);
  if (rsr === null) return { value: p, label: `EPS ${percent(p)}` };
  const sv = round(rsr - p);
  return {
    value: p,
    label: `EPS ${percent(p)} · SV ${percent(sv)}`,
    ...(sv > 0 && { severity: 'warning' }),
  };
};

/** The propagation as an analysis result: one case, a step per element computed. */
export const runPropagation = (model: AnalysisModel): AnalysisResult => {
  const { probabilities, steps } = propagateProbabilities(model);
  const elements = new Map(model.elements.map((e) => [e.id, e]));
  const values: Record<string, AnalysisValue> = {};
  const series: AnalysisStep[] = steps.map(({ id, probability, why }) => {
    const element = elements.get(id)!;
    values[id] = probabilityValue(element, probability);
    return {
      label: `${element.name.trim()}: ${values[id]!.label} (${why})`,
      values: { ...values },
    };
  });
  return {
    cases: [
      {
        id: 'probabilities',
        label: 'Probabilities',
        values: Object.fromEntries(
          [...probabilities].map(([id, p]) => [
            id,
            probabilityValue(elements.get(id)!, p),
          ]),
        ),
        steps: series,
      },
    ],
  };
};

/** A combination of leaf obstacles and what it does to a goal with an RSR. */
export type CriticalCombination = {
  goal: string;
  obstacles: readonly string[];
  eps: number;
  sv: number;
};

/**
 * The leaf obstacles' singletons and pairs that are critical for a goal
 * with an RSR (RE'12 §V; REJ'13 §6.4): occurring alone, at their estimates,
 * every other leaf obstacle at 0, they leave the goal's EPS under its RSR
 * (`SV > 0`). Most severe first.
 */
export const criticalCombinations = (
  model: AnalysisModel,
): CriticalCombination[] => {
  const hubs = hubsOf(model);
  const leaves = model.elements.filter(
    (e) => e.kind === OBSTACLE && !(hubs.get(e.id)?.length ?? 0),
  );
  const estimate = (e: AnalysisElement) => valuesOf(e).Probability ?? 0;
  const goals = model.elements.filter(
    (e) => GOAL_KINDS.has(e.kind) && rsrOf(e) !== null,
  );
  if (!goals.length) return [];
  const combinations = [
    ...leaves.map((a) => [a]),
    ...leaves.flatMap((a, i) => leaves.slice(i + 1).map((b) => [a, b])),
  ];
  const found: CriticalCombination[] = [];
  for (const combination of combinations) {
    const overrides = new Map(
      leaves.map((leaf) => [
        leaf.id,
        combination.includes(leaf) ? estimate(leaf) : 0,
      ]),
    );
    const { probabilities } = propagateProbabilities(model, overrides);
    for (const goal of goals) {
      const eps = probabilities.get(goal.id) ?? 1;
      const sv = round(rsrOf(goal)! - eps);
      if (sv > 0)
        found.push({
          goal: goal.id,
          obstacles: combination.map((o) => o.id),
          eps,
          sv,
        });
    }
  }
  return found.sort((a, b) => b.sv - a.sv);
};

/** The critical combinations as an analysis result: one case each, a selection of its obstacles. */
export const runCriticalCombinations = (
  model: AnalysisModel,
): AnalysisResult => {
  const elements = new Map(model.elements.map((e) => [e.id, e]));
  const nameOf = (id: string) => elements.get(id)?.name.trim() ?? id;
  const hubs = hubsOf(model);
  const leaves = model.elements.filter(
    (e) => e.kind === OBSTACLE && !(hubs.get(e.id)?.length ?? 0),
  );
  return {
    cases: criticalCombinations(model).map(
      ({ goal, obstacles, eps, sv }): AnalysisCase => {
        const overrides = new Map(
          leaves.map((leaf) => [
            leaf.id,
            obstacles.includes(leaf.id) ? (valuesOf(leaf).Probability ?? 0) : 0,
          ]),
        );
        const { probabilities } = propagateProbabilities(model, overrides);
        return {
          id: `${goal}:${obstacles.join('+')}`,
          label: `${obstacles.map(nameOf).join(' + ')}: SV ${percent(sv)}`,
          values: Object.fromEntries(
            [...probabilities].map(([id, p]) => [
              id,
              probabilityValue(elements.get(id)!, p),
            ]),
          ),
          selection: [...obstacles, goal],
          summary: `${nameOf(goal)}: EPS ${percent(eps)}, SV ${percent(sv)}`,
        };
      },
    ),
  };
};
