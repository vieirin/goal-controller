/**
 * kaosexpert's analyses (goal-controller#190): Cailliau and van
 * Lamsweerde's handling of knowledge uncertainty (RE'15, §V–VII).
 *
 * 1. Each leaf obstacle's estimate: its experts' (`Probability[e1]`),
 *    combined by Cooke's model (./cooke), weighted by the calibration
 *    variables; or its own `Probability`, a value or a distribution.
 * 2. Each goal's obstruction superset, as a BDD over the leaf obstacles and
 *    the other uncertain events (§VI.A–B): an obstacle refinement is an AND
 *    of its sub-obstacles (and domain properties), several refinements an
 *    OR; an obstruction obstructs its goal; a refined goal is obstructed
 *    when any sub-goal is (its alternatives: when all are).
 * 3. Monte Carlo (§VI.C, D4): each sample draws every estimate from its
 *    distribution (seeded, `samples` of them), and each goal's probability
 *    of satisfaction is 1 − Pr[OS(G)] for those draws. A goal's
 *    satisfaction uncertainty is the distribution of these values: its
 *    quantiles, its mean, and, against its `RSR` (RE'15's RDS), its
 *    violation uncertainty VU = P(P(G) < RSR) and its uncertainty spread US
 *    = √(Σ (xᵢ − RSR)² / k) over the k samples below the RSR (§III.B).
 *
 * kaosprop's quantities are read as kaosprop reads them, so a model with
 * point estimates only gives kaosprop's EPS in every sample: an
 * obstruction's `Probability` P(¬G|O), an obstacle refinement's P(O|SO),
 * a domain property that holds with its `Probability` (default 1), a leaf
 * goal nothing obstructs failing with 1 − its `ESR`, and a case-driven
 * refinement's legs `Probability` as its cases, each an event of its own in
 * the BDD. Where an obstacle is shared by two branches the BDD counts it
 * once (§VI.A), where kaosprop's tree propagation counts it in each.
 *
 * A second analysis finds the critical obstacles (§VII): each leaf obstacle
 * alone, every other leaf at 0, and the VU and US it causes to each goal
 * with an RSR (RE'15's violation diagram, Table III).
 */
import type { Distribution } from '@goal-controller/dialect';
import { Bdd, FALSE, TRUE, type BddNode } from '../../numeric/bdd';
import {
  complementOf,
  continuousOf,
  type Continuous,
} from '../../numeric/distributions';
import { seededRandom, type Random } from '../../numeric/random';
import { distributionOfSamples } from '../../numeric/samples';
import {
  viewValues,
  type AnalysisCase,
  type AnalysisContext,
  type AnalysisElement,
  type AnalysisModel,
  type AnalysisResult,
  type AnalysisStep,
  type AnalysisValue,
} from '../analysis';
import { hubsOf, obstructionsOf, percent } from '../kaosprop/propagation';
import type { ResourceFile } from '../projectResources';
import { cooke, type CookeResult, type Weighting } from './cooke';
import { kaosexpert } from './definition';
import { readCalibrations, readExperts } from './resources';

const GOAL_KINDS = new Set(['kaos.BehavioralGoal', 'kaos.Softgoal']);
const OBSTACLE = 'kaosObstacles.Obstacle';
const DOMAIN_PROPERTY = 'kaos.DomainProperty';
const CASE_DRIVEN = new Set(['case-driven', 'case']);

/** The options the analyses read: the sample count, the seed, how experts are weighed. */
export type ExpertOptions = {
  samples: number;
  seed: number;
  weighting: Weighting;
};

export const DEFAULT_EXPERT_OPTIONS: ExpertOptions = {
  samples: 10000,
  seed: 1,
  weighting: 're15',
};

const optionsOf = (context?: AnalysisContext): ExpertOptions => {
  const given = context?.options ?? {};
  const int = (key: string, fallback: number) =>
    typeof given[key] === 'number' && Number.isInteger(given[key])
      ? (given[key] as number)
      : fallback;
  return {
    samples: Math.max(1, int('samples', DEFAULT_EXPERT_OPTIONS.samples)),
    seed: int('seed', DEFAULT_EXPERT_OPTIONS.seed),
    weighting: (['re15', 'classical', 'equal'] as const).includes(
      given.weighting as Weighting,
    )
      ? (given.weighting as Weighting)
      : DEFAULT_EXPERT_OPTIONS.weighting,
  };
};

const filesOf = (
  context: AnalysisContext | undefined,
  kind: string,
): ResourceFile[] =>
  Object.entries(context?.resources?.[kind] ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, text]) => ({ path, text }));

/** An element's kaosexpert values, its keyed ones (`Probability[e1]`) too. */
const valuesOf = (
  owner: 'element' | 'link',
  item:
    | AnalysisElement
    | { kind: string; properties: Readonly<Record<string, string>> },
) => viewValues(kaosexpert, owner, item) as Readonly<Record<string, unknown>>;

/** An uncertain event: a variable of the BDD, and how a sample draws its probability. */
type Event = {
  /** what it is, for the report */
  label: string;
  /** a constant, or a distribution to draw from */
  value: number | (Continuous & { sample?: (random: Random) => number });
};

/** What the analyses build once per model: the events, each element's formula, the experts' weights. */
export type ExpertAnalysis = {
  bdd: Bdd;
  events: Event[];
  /** the leaf obstacles' events, by element id */
  leaves: Map<string, number>;
  /** each goal's obstruction superset, each obstacle's occurrence, by element id */
  formulas: Map<string, BddNode>;
  /** the obstacles' ids (their formula is their occurring; a goal's, its obstruction) */
  obstacles: ReadonlySet<string>;
  /** what each leaf obstacle's estimate is, for the report */
  estimates: Map<string, string>;
  weights: CookeResult | null;
  experts: { id: string; name: string }[];
  notes: string[];
  options: ExpertOptions;
};

/** The quantiles of a distribution value given as quantiles: at the levels; another's, read at them. */
const quantilesAt = (
  distribution: Distribution,
  levels: readonly number[],
): number[] =>
  distribution.kind === 'quantiles'
    ? [...distribution.values]
    : levels.map((l) => continuousOf(distribution).quantile(l));

/** The model read for the analyses: Cooke's weights, the events, the formulas. */
export const expertAnalysis = (
  model: AnalysisModel,
  context?: AnalysisContext,
): ExpertAnalysis => {
  const options = optionsOf(context);
  const notes: string[] = [];
  const experts = readExperts(filesOf(context, 'expert'));
  const { calibrations } = readCalibrations(filesOf(context, 'calibration'));
  const levels = experts.levels;
  const elements = new Map(model.elements.map((e) => [e.id, e]));
  const nameOf = (id: string) => elements.get(id)?.name.trim() ?? id;

  // refinements, by the element they refine (kaosprop's reading: the same keys)
  const hubs = hubsOf(model);
  const obstructions = obstructionsOf(model);

  // the leaf obstacles' estimates: the experts', Cooke's combination of them
  const leafIds = model.elements
    .filter((e) => e.kind === OBSTACLE && !(hubs.get(e.id)?.length ?? 0))
    .map((e) => e.id);
  const keyedOf = (id: string) => {
    const values = valuesOf('element', elements.get(id)!);
    const own = new Map<string, Distribution>();
    for (const [key, value] of Object.entries(values)) {
      const keyed = /^Probability\[(.+)\]$/.exec(key);
      if (keyed && value) own.set(keyed[1]!, value as Distribution);
    }
    return { own, plain: (values.Probability as Distribution | null) ?? null };
  };
  const declared = experts.experts.map((e) => ({
    id: e.id,
    name: e.name ?? e.id,
  }));
  const expertIds = declared.map((e) => e.id);
  const estimatesOf = new Map(leafIds.map((id) => [id, keyedOf(id)]));
  for (const id of leafIds)
    for (const expert of estimatesOf.get(id)!.own.keys())
      if (!expertIds.includes(expert)) {
        expertIds.push(expert);
        declared.push({ id: expert, name: expert });
        notes.push(`${expert} is no declared expert: weighed as one`);
      }
  for (const c of calibrations)
    for (const expert of c.estimates.keys())
      if (!expertIds.includes(expert)) {
        expertIds.push(expert);
        declared.push({ id: expert, name: expert });
        notes.push(`${expert} is no declared expert: weighed as one`);
      }
  const variableOf = (
    id: string,
    estimates: ReadonlyMap<string, Distribution>,
    known?: number,
  ) => {
    const quantiles = new Map<string, number[]>();
    const distributions = new Map<string, Continuous>();
    for (const [expert, distribution] of estimates) {
      if (
        distribution.kind === 'quantiles' &&
        distribution.values.length !== levels.length
      ) {
        notes.push(
          `${id}: ${expert}'s estimate has ${distribution.values.length} quantiles, not ${levels.length} (${experts.quantiles}): not read`,
        );
        continue;
      }
      quantiles.set(expert, quantilesAt(distribution, levels));
      if (distribution.kind !== 'quantiles')
        distributions.set(expert, continuousOf(distribution, { levels }));
    }
    return {
      id,
      estimates: quantiles,
      ...(known !== undefined && { known }),
      ...(distributions.size && { distributions }),
    };
  };
  const leafVariables = leafIds
    .filter((id) => estimatesOf.get(id)!.own.size)
    .map((id) => variableOf(id, estimatesOf.get(id)!.own));
  const calibrationVariables = calibrations
    .filter((c) => c.value !== null && c.estimates.size)
    .map((c) => variableOf(`calibration:${c.key}`, c.estimates, c.value!));
  const weights =
    leafVariables.length && expertIds.length
      ? cooke({
          levels,
          experts: expertIds,
          variables: [...leafVariables, ...calibrationVariables],
          weighting: options.weighting,
        })
      : null;

  // the events and the formulas
  const bdd = new Bdd();
  const events: Event[] = [];
  const event = (label: string, value: Event['value']): BddNode => {
    if (typeof value === 'number' && value >= 1) return TRUE;
    if (typeof value === 'number' && value <= 0) return FALSE;
    events.push({ label, value });
    return bdd.newVariable();
  };
  const leaves = new Map<string, number>();
  const estimates = new Map<string, string>();
  const formulas = new Map<string, BddNode>();
  const visiting = new Set<string>();

  const leafObstacle = (id: string): BddNode => {
    const { own, plain } = estimatesOf.get(id)!;
    let value: Event['value'];
    if (own.size && weights) {
      const dm = weights.decisionMaker(id);
      if (dm) {
        value = dm;
        estimates.set(
          id,
          `${weights.weighting === 'equal' ? 'the experts’ estimates, equally weighed' : 'Cooke’s combination'} of ${[...own.keys()].join(', ')}`,
        );
      } else {
        value = 0;
        estimates.set(id, 'no expert it is estimated by has a weight: 0');
      }
    } else if (plain) {
      value =
        plain.kind === 'point' ? plain.value : continuousOf(plain, { levels });
      estimates.set(
        id,
        plain.kind === 'point'
          ? 'its estimate'
          : `its distribution (${plain.kind})`,
      );
    } else {
      value = 0;
      estimates.set(id, 'no estimate: 0');
    }
    const before = events.length;
    const node = event(nameOf(id), value);
    if (events.length > before) leaves.set(id, events.length - 1);
    return node;
  };

  const domainProperty = (id: string): BddNode => {
    const plain = valuesOf('element', elements.get(id)!).Probability as
      | Distribution
      | null
      | undefined;
    if (!plain) return TRUE;
    return event(
      nameOf(id),
      plain.kind === 'point' ? plain.value : continuousOf(plain, { levels }),
    );
  };

  /** an obstacle's occurrence, or a domain property's holding, as a formula */
  const occurs = (id: string): BddNode => {
    const known = formulas.get(id);
    if (known !== undefined) return known;
    const element = elements.get(id);
    if (!element) return FALSE;
    if (element.kind === DOMAIN_PROPERTY) {
      const node = domainProperty(id);
      formulas.set(id, node);
      return node;
    }
    if (element.kind !== OBSTACLE) return FALSE;
    if (visiting.has(id)) return FALSE;
    visiting.add(id);
    const refinements = hubs.get(id) ?? [];
    const branches = refinements.map((hub) => {
      const given = hub.values.Probability ?? 1;
      return bdd.and(
        ...hub.legs.map((leg) => occurs(leg.child)),
        given === 1 ? TRUE : event(`P(O|SO) of ${nameOf(id)}`, given),
      );
    });
    // HASE'11's β (goal-controller#199): the obstacle's own Beta, read only
    // with more than one refinement (an OR of them, where it does not fold
    // into any one hub's own product, frameworks.md "Step 3 part B")
    if (branches.length > 1) {
      const beta = valuesOf('element', element).Beta as Distribution | null;
      if (beta)
        branches.push(
          event(
            `β of ${nameOf(id)}`,
            beta.kind === 'point' ? beta.value : continuousOf(beta, { levels }),
          ),
        );
    }
    const node = branches.length ? bdd.or(...branches) : leafObstacle(id);
    visiting.delete(id);
    formulas.set(id, node);
    return node;
  };

  /** a goal's obstruction superset (OS(G), §VI.A) */
  const obstructed = (id: string): BddNode => {
    const known = formulas.get(id);
    if (known !== undefined) return known;
    const element = elements.get(id);
    if (!element || !GOAL_KINDS.has(element.kind) || visiting.has(id))
      return FALSE;
    visiting.add(id);
    const refinements = hubs.get(id) ?? [];
    const own = (obstructions.get(id) ?? []).map(({ obstacle, p = 1 }) =>
      bdd.and(
        occurs(obstacle),
        p === 1 || p === null
          ? TRUE
          : event(`P(¬G|O) of ${nameOf(obstacle)} on ${nameOf(id)}`, p),
      ),
    );
    let node: BddNode;
    if (refinements.length) {
      const alternatives = refinements.map((hub) => {
        const tactic = hub.values.Tactic ?? '';
        if (!CASE_DRIVEN.has(tactic)) {
          // HASE'11's α (goal-controller#199), folded into this hub's own
          // Probability slot (kaosprop's P(G|SG1..n), frameworks.md "Step 3
          // part B"): obstructed if any sub-goal is, or by it, independently
          const given = hub.values.Probability ?? 1;
          const children = hub.legs.map((leg) => obstructed(leg.child));
          return given >= 1
            ? bdd.or(...children)
            : bdd.or(event(`α of ${nameOf(id)}`, 1 - given), ...children);
        }
        // case-driven: one case holds, its sub-goal obstructed or not; the
        // cases as a chain of events, each given the ones before don't hold
        const cases = hub.legs.map((leg) => leg.probability ?? null);
        if (cases.length === 2 && cases.filter((c) => c === null).length === 1)
          cases[cases.indexOf(null)] = 1 - cases.find((c) => c !== null)!;
        let rest = 1;
        let formula: BddNode = TRUE; // no case holds: the goal fails
        const chain = hub.legs.map((leg, i) => {
          const c = cases[i] ?? 0;
          const conditional = rest > 0 ? Math.min(1, c / rest) : 0;
          rest -= c;
          return { leg, conditional };
        });
        for (const { leg, conditional } of chain.reverse())
          formula = bdd.ite(
            conditional >= 1
              ? TRUE
              : conditional <= 0
                ? FALSE
                : event(
                    `case ${nameOf(leg.child)} of ${nameOf(id)}`,
                    conditional,
                  ),
            obstructed(leg.child),
            formula,
          );
        // alpha applies to a case-driven hub the same way (rv199): an
        // independent residual-failure event OR'd with the case chain's own
        const given = hub.values.Probability ?? 1;
        return given >= 1
          ? formula
          : bdd.or(event(`α of ${nameOf(id)}`, 1 - given), formula);
      });
      node = bdd.or(bdd.and(...alternatives), ...own);
    } else if (own.length) node = bdd.or(...own);
    else {
      // HASE'11's P(G) (goal-controller#199): a leaf goal's ESR, now a
      // distribution too; its complement (1 − ESR) is the failure event's
      const esr = valuesOf('element', element).ESR as Distribution | null;
      node = !esr
        ? FALSE
        : event(
            `1 − ESR of ${nameOf(id)}`,
            esr.kind === 'point'
              ? 1 - esr.value
              : complementOf(continuousOf(esr, { levels })),
          );
    }
    visiting.delete(id);
    formulas.set(id, node);
    return node;
  };

  for (const element of model.elements)
    if (GOAL_KINDS.has(element.kind)) obstructed(element.id);
    else if (element.kind === OBSTACLE) occurs(element.id);

  return {
    bdd,
    events,
    leaves,
    formulas,
    obstacles: new Set(
      model.elements.filter((e) => e.kind === OBSTACLE).map((e) => e.id),
    ),
    estimates,
    weights,
    experts: declared,
    notes,
    options,
  };
};

/** Every sample's probability per element: a goal's of satisfaction, an obstacle's of occurring. */
export const simulate = (
  analysis: ExpertAnalysis,
  ids: readonly string[],
  { only }: { only?: string } = {},
): Map<string, Float64Array> => {
  const { bdd, events, formulas, options, leaves } = analysis;
  const random = seededRandom(options.seed);
  const out = new Map(ids.map((id) => [id, new Float64Array(options.samples)]));
  const p = new Float64Array(events.length);
  const onlyIndex = only === undefined ? undefined : leaves.get(only);
  const leafIndices = new Set(leaves.values());
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  for (let s = 0; s < options.samples; s++) {
    events.forEach((e, i) => {
      const draw =
        typeof e.value === 'number'
          ? e.value
          : e.value.sample
            ? e.value.sample(random)
            : e.value.quantile(random());
      // §VII: one leaf obstacle alone, every other leaf at 0
      p[i] =
        only !== undefined && leafIndices.has(i) && i !== onlyIndex
          ? 0
          : clamp(draw);
    });
    const cache = new Map<BddNode, number>();
    for (const id of ids) {
      const node = formulas.get(id) ?? FALSE;
      const occurring = bdd.probability(node, p, cache);
      out.get(id)![s] = analysis.obstacles.has(id) ? occurring : 1 - occurring;
    }
  }
  return out;
};

/** SU(p): the share of the samples below p (§III.B; VU is SU at the RSR). */
export const satisfactionUncertainty = (samples: Float64Array, p: number) => {
  let below = 0;
  for (const x of samples) if (x < p) below++;
  return below / samples.length;
};

/** US: the samples' semi-standard deviation below the RSR, √(Σ (xᵢ − RSR)² / k) (§III.B). */
export const uncertaintySpread = (samples: Float64Array, rsr: number) => {
  let sum = 0;
  let k = 0;
  for (const x of samples)
    if (x < rsr) {
      sum += (x - rsr) ** 2;
      k++;
    }
  return k ? Math.sqrt(sum / k) : 0;
};

const round = (n: number, digits = 4) =>
  Math.round(n * 10 ** digits) / 10 ** digits;

/** A goal's value: its mean probability of satisfaction; with an RSR, VU and US (a warning when VU > 0). */
const goalValue = (
  element: AnalysisElement,
  samples: Float64Array,
): AnalysisValue & { vu?: number; us?: number } => {
  const distribution = distributionOfSamples(samples);
  const rsr = valuesOf('element', element).RSR as number | undefined;
  const mean = `P ${percent(distribution.mean)}`;
  if (rsr === undefined)
    return { value: distribution.mean, label: mean, distribution };
  const vu = satisfactionUncertainty(samples, rsr);
  const us = uncertaintySpread(samples, rsr);
  return {
    value: distribution.mean,
    label: `${mean} · VU ${round(vu)} · US ${round(us)}`,
    distribution,
    ...(vu > 0 && { severity: 'warning' as const }),
    vu,
    us,
  };
};

const obstacleValue = (samples: Float64Array): AnalysisValue => {
  const distribution = distributionOfSamples(samples);
  return {
    value: distribution.mean,
    label: `P ${percent(distribution.mean)}`,
    distribution,
  };
};

/** The ids a run reports on: every goal and obstacle, in the model's order. */
const reported = (model: AnalysisModel) =>
  model.elements
    .filter((e) => GOAL_KINDS.has(e.kind) || e.kind === OBSTACLE)
    .map((e) => e.id);

/** The satisfaction uncertainty as an analysis result: one case, its steps the report. */
export const runUncertainty = (
  model: AnalysisModel,
  _resource?: Readonly<Record<string, string>>,
  context?: AnalysisContext,
): AnalysisResult => {
  const analysis = expertAnalysis(model, context);
  const elements = new Map(model.elements.map((e) => [e.id, e]));
  const ids = reported(model);
  const runs = simulate(analysis, ids);
  const values: Record<string, AnalysisValue> = {};
  const steps: AnalysisStep[] = [];
  const step = (label: string) => steps.push({ label, values: { ...values } });
  const { weights, options } = analysis;
  step(
    `${options.samples} samples, seed ${options.seed}; ${analysis.events.length} uncertain events, BDD of ${analysis.bdd.variables} variables`,
  );
  if (weights) {
    const names = new Map(analysis.experts.map((e) => [e.id, e.name]));
    for (const score of weights.scores)
      step(
        `${names.get(score.expert) ?? score.expert}: information ${round(score.information)}, calibration ${round(score.calibration)}, weight ${round(score.weight)} (${weights.weighting}${weights.alpha ? `, cut-off ${round(weights.alpha)}` : ''})`,
      );
  }
  for (const note of analysis.notes) step(note);
  for (const id of ids) {
    const element = elements.get(id)!;
    const samples = runs.get(id)!;
    values[id] = GOAL_KINDS.has(element.kind)
      ? goalValue(element, samples)
      : obstacleValue(samples);
    const {
      vu: _vu,
      us: _us,
      ...value
    } = values[id] as AnalysisValue & {
      vu?: number;
      us?: number;
    };
    values[id] = value;
    step(
      `${element.name.trim()}: ${value.label}${analysis.estimates.has(id) ? ` (${analysis.estimates.get(id)})` : ''}`,
    );
  }
  return {
    cases: [
      {
        id: 'uncertainty',
        label: 'Satisfaction uncertainty',
        values: { ...values },
        steps,
      },
    ],
  };
};

/** One leaf obstacle's effect on a goal with an RSR, alone (§VII, Table III). */
export type CriticalObstacle = {
  obstacle: string;
  goal: string;
  vu: number;
  us: number;
};

/** Each leaf obstacle alone against each goal with an RSR: its VU and US, the most violating first. */
export const criticalObstacles = (
  model: AnalysisModel,
  context?: AnalysisContext,
): {
  analysis: ExpertAnalysis;
  found: CriticalObstacle[];
  runs: Map<string, Map<string, Float64Array>>;
} => {
  const analysis = expertAnalysis(model, context);
  const goals = model.elements.filter(
    (e) => GOAL_KINDS.has(e.kind) && valuesOf('element', e).RSR !== undefined,
  );
  const ids = reported(model);
  const found: CriticalObstacle[] = [];
  const runs = new Map<string, Map<string, Float64Array>>();
  for (const obstacle of analysis.leaves.keys()) {
    const run = simulate(analysis, ids, { only: obstacle });
    runs.set(obstacle, run);
    for (const goal of goals) {
      const rsr = valuesOf('element', goal).RSR as number;
      const samples = run.get(goal.id)!;
      found.push({
        obstacle,
        goal: goal.id,
        vu: satisfactionUncertainty(samples, rsr),
        us: uncertaintySpread(samples, rsr),
      });
    }
  }
  found.sort((a, b) => b.vu - a.vu || b.us - a.us);
  return { analysis, found, runs };
};

/** The critical obstacles as an analysis result: one case per obstacle and goal it violates (VU > 0). */
export const runCriticalObstacles = (
  model: AnalysisModel,
  _resource?: Readonly<Record<string, string>>,
  context?: AnalysisContext,
): AnalysisResult => {
  const elements = new Map(model.elements.map((e) => [e.id, e]));
  const nameOf = (id: string) => elements.get(id)?.name.trim() ?? id;
  const { found, runs } = criticalObstacles(model, context);
  return {
    cases: found
      .filter((c) => c.vu > 0)
      .map(({ obstacle, goal, vu, us }): AnalysisCase => {
        const run = runs.get(obstacle)!;
        return {
          id: `${goal}:${obstacle}`,
          label: `${nameOf(obstacle)}: VU ${round(vu)} · US ${round(us)}`,
          values: Object.fromEntries(
            [...run].map(([id, samples]) => {
              const element = elements.get(id)!;
              if (!GOAL_KINDS.has(element.kind))
                return [id, obstacleValue(samples)];
              const { vu: _v, us: _u, ...value } = goalValue(element, samples);
              return [id, value];
            }),
          ),
          selection: [obstacle, goal],
          summary: `${nameOf(goal)}: VU ${round(vu)}, US ${round(us)}, ${nameOf(obstacle)} alone`,
        };
      }),
  };
};
