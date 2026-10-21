/**
 * The selection of countermeasures (goal-controller#191 part B, D4):
 * Cailliau and van Lamsweerde, SEAMS'17 §VI.B–C, as the paper defines it
 * (quoted in packages/dialect/docs/frameworks.md, "Step 4 part B"):
 *
 * - a countermeasure is a countermeasure goal with every resolution link
 *   it is the source of (SEAMS'17's Table I selects goals: Achieve
 *   [LocalsWarnedByEmail…] resolves two obstacles and costs one);
 * - a selection is a set of them, integrated together (./transform.ts) into
 *   a variant that kaosprop propagates;
 * - **safe**: every high-level goal's ESR is greater than its RSR (the
 *   paper's RDS); the high-level goals are the goals with an RSR;
 * - **consistent**: "conflicting countermeasures shall not be selected
 *   together: {CMi, CMj, Dom} ⊭ false for i≠j", a Conflict link (KAOS's
 *   `{G1, G2, Dom} ⊨ false`) read as such: no Conflict joins two goals of
 *   the selection, nor a goal of the selection and a goal the variant
 *   still has in use (reachable from the model's roots, or from the
 *   selection);
 * - the **resolution cost** is the sum of the selected countermeasures'
 *   costs: a countermeasure's `Cost` (the largest of its links') when the
 *   model sets any, else 1 each (ADS's and KAOSTools' optimisers, and
 *   Table I's costs: the number of countermeasures);
 * - **cost-optimal**: "no other selection increases the probability of
 *   satisfaction of the high-level goal without increasing the resolution
 *   cost", among the consistent ones; with several high-level goals, their
 *   satisfaction rates' mean (§V's "weighted sum", equal weights);
 * - the **chosen** selection: §VI.C's two problems, the minimal cost of a
 *   safe and consistent selection, then the largest satisfaction rate at
 *   that cost. When none is safe, the largest satisfaction rate at the
 *   lowest cost, flagged (the thesis, ch. 7: "the selection that maximizes
 *   the satisfaction rate of the high-level goals is picked").
 *
 * The search is §VI.C's naive one, O(2ⁿ), bounded: selections are
 * evaluated in the order of their cost (the empty one first), at most
 * `limit` of them. With 2ⁿ within the limit every selection is evaluated;
 * past it, the search stops once the cost level of the first safe
 * selection is complete (the chosen one is then exact), or at the limit
 * (the result says it is not).
 *
 * `semantics: 'kaostools'` reproduces KAOSTools' `NaiveCountermeasure
 * SelectionOptimizer` (05a5125) instead: no consistency, the empty
 * selection only for the minimal cost, and the largest satisfaction rate
 * over every non-empty selection when the minimal cost is 0 or none is
 * safe.
 */
import {
  type AnalysisCase,
  type AnalysisContext,
  type AnalysisModel,
  type AnalysisResult,
  type AnalysisValue,
  viewValues,
} from '../analysis';
import { kaosprop } from '../kaosprop/definition';
import {
  percent,
  probabilityValue,
  propagateProbabilities,
} from '../kaosprop/propagation';
import {
  applyCountermeasures,
  countermeasuresOf,
  kaosModelOfView,
  kaosresView,
  type Countermeasure,
  type CountermeasureProblem,
  type KaosModel,
  type ResolutionScope,
} from './transform';

const GOAL_KINDS = new Set(['kaos.BehavioralGoal', 'kaos.Softgoal']);
const GOAL_HUB = 'kaos.RefinementLinkHub';
const GOAL_LEG = 'kaos.RefinementLinkStart';
const GOAL_END = 'kaos.RefinementLinkEnd';
const OBSTACLE_LEG = 'kaosObstacles.ObstacleRefinementLinkStart';
const OBSTACLE_END = 'kaosObstacles.ObstacleRefinementLinkEnd';
const OBSTRUCTION = 'kaosObstacles.ObstructionLink';
const ASSIGNMENT = 'kaos.ResponsibilityAssignment';
const CONFLICT = 'kaos.Conflict';
const RESOLUTION = 'kaosObstacles.ResolutionLink';

/** Two satisfaction rates closer than this are equal. */
const EPSILON = 1e-12;

/** Whose definitions the selection follows. */
export type SelectionSemantics = 'seams17' | 'kaostools';

export type SelectionOptions = {
  /** where an integration's obstacle is false (./transform.ts) */
  scope: ResolutionScope;
  semantics: SelectionSemantics;
  /** the most selections evaluated */
  limit: number;
};

export const DEFAULT_SELECTION_OPTIONS: SelectionOptions = {
  scope: 'anchor',
  semantics: 'seams17',
  limit: 4096,
};

/** A countermeasure goal: the resolutions it is the source of, its cost. */
export type CountermeasureGoal = {
  goal: string;
  name: string;
  resolutions: readonly Countermeasure[];
  cost: number;
};

/** A selection evaluated. */
export type Selection = {
  /** its countermeasure goals' ids, in the model's order */
  goals: readonly string[];
  cost: number;
  /** each high-level goal's ESR in its variant (one the variant no longer has: absent) */
  esr: ReadonlyMap<string, number>;
  /** the high-level goals' ESRs' mean: what is maximised */
  satisfaction: number;
  safe: boolean;
  consistent: boolean;
  /** the Conflict links it breaks, as pairs of goal ids */
  conflicts: readonly (readonly [string, string])[];
  costOptimal: boolean;
  /** what its integration said (an error: a resolution not applied) */
  problems: readonly CountermeasureProblem[];
};

export type SelectionResult = {
  options: SelectionOptions;
  /** the countermeasures the search selects among */
  countermeasures: readonly CountermeasureGoal[];
  /** countermeasure goals none of whose resolutions applies alone: left out, with why */
  excluded: readonly {
    goal: string;
    problems: readonly CountermeasureProblem[];
  }[];
  /** `Cost`: the model sets a countermeasure's cost; `count`: none, each costs 1 */
  costBasis: 'Cost' | 'count';
  /** the goals whose satisfaction rates are maximised (with an RSR: the ones safety is about) */
  highLevel: readonly { id: string; name: string; rsr: number | null }[];
  /** every selection evaluated, in the order of their cost */
  selections: readonly Selection[];
  /** 2ⁿ */
  candidates: number;
  /** every candidate evaluated */
  exhaustive: boolean;
  /** the minimal cost of a safe (and, under SEAMS'17, consistent) selection; null: none found */
  minimalCost: number | null;
  /** the chosen selections (ties); the first is drawn */
  chosen: readonly Selection[];
  /** the chosen ones are §VI.C's: the minimal cost's level evaluated whole, or every selection */
  exact: boolean;
};

const isScope = (value: unknown): value is ResolutionScope =>
  value === 'anchor' || value === 'model';
const isSemantics = (value: unknown): value is SelectionSemantics =>
  value === 'seams17' || value === 'kaostools';

/** The options an analysis's context sets, each its default otherwise. */
export const selectionOptionsOf = (
  context?: AnalysisContext,
): SelectionOptions => {
  const given = context?.options ?? {};
  const limit = given.limit;
  return {
    scope: isScope(given.scope) ? given.scope : DEFAULT_SELECTION_OPTIONS.scope,
    semantics: isSemantics(given.semantics)
      ? given.semantics
      : DEFAULT_SELECTION_OPTIONS.semantics,
    limit:
      typeof limit === 'number' && Number.isInteger(limit) && limit >= 1
        ? limit
        : DEFAULT_SELECTION_OPTIONS.limit,
  };
};

/** The model's countermeasure goals, in the model's order of their first resolution. */
const countermeasureGoalsOf = (
  model: KaosModel,
): { goals: CountermeasureGoal[]; costBasis: 'Cost' | 'count' } => {
  const byGoal = new Map<string, Countermeasure[]>();
  for (const countermeasure of countermeasuresOf(model))
    byGoal.set(countermeasure.goal, [
      ...(byGoal.get(countermeasure.goal) ?? []),
      countermeasure,
    ]);
  const costBasis = [...byGoal.values()].some((rs) =>
    rs.some((r) => r.cost !== null),
  )
    ? 'Cost'
    : 'count';
  return {
    costBasis,
    goals: [...byGoal].map(([goal, resolutions]) => ({
      goal,
      name: model.elements.get(goal)?.name.trim() || goal,
      resolutions,
      cost:
        costBasis === 'count'
          ? 1
          : Math.max(0, ...resolutions.map((r) => r.cost ?? 0)),
    })),
  };
};

/** The goal refinement graph of a model: each goal's sub-goals. */
const subGoalsOf = (model: KaosModel): Map<string, string[]> => {
  const parentOfHub = new Map<string, string>();
  for (const link of model.links.values())
    if (link.kind === GOAL_END) parentOfHub.set(link.source, link.target);
  const children = new Map<string, string[]>();
  for (const link of model.links.values())
    if (link.kind === GOAL_LEG) {
      const parent = parentOfHub.get(link.target);
      if (parent !== undefined)
        children.set(parent, [...(children.get(parent) ?? []), link.source]);
    }
  return children;
};

/** Goals no refinement has as a sub-goal. */
const rootGoalsOf = (model: KaosModel): string[] => {
  const below = new Set(
    [...subGoalsOf(model).values()].flatMap((children) => children),
  );
  return [...model.elements.values()]
    .filter((e) => GOAL_KINDS.has(e.kind) && !below.has(e.id))
    .map((e) => e.id);
};

/** What `from` reaches down a model's goal refinements. */
const reach = (model: KaosModel, from: Iterable<string>): Set<string> => {
  const children = subGoalsOf(model);
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    for (const child of children.get(id) ?? []) visit(child);
  };
  for (const id of from) visit(id);
  return seen;
};

/**
 * The selections of `items` (sorted by cost, ascending) in the order of
 * their total cost, the empty one first: each cost level whole, its
 * selections in the model's order.
 */
function* byCost(
  items: readonly { cost: number; index: number }[],
): Generator<{ cost: number; members: number[] }[]> {
  // a heap of (cost, last item, members): from a selection whose last
  // item is k, "add k + 1" and "replace k by k + 1" reach every selection
  // once, in nondecreasing cost (the costs are sorted and ≥ 0)
  type Node = { cost: number; last: number; members: number[] };
  const heap: Node[] = [];
  const push = (node: Node) => {
    heap.push(node);
    for (let i = heap.length - 1; i > 0;) {
      const parent = (i - 1) >> 1;
      if (heap[parent]!.cost <= heap[i]!.cost) break;
      [heap[parent], heap[i]] = [heap[i]!, heap[parent]!];
      i = parent;
    }
  };
  const pop = (): Node => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const [l, r] = [2 * i + 1, 2 * i + 2];
        let least = i;
        if (l < heap.length && heap[l]!.cost < heap[least]!.cost) least = l;
        if (r < heap.length && heap[r]!.cost < heap[least]!.cost) least = r;
        if (least === i) break;
        [heap[least], heap[i]] = [heap[i]!, heap[least]!];
        i = least;
      }
    }
    return top;
  };
  if (items.length) push({ cost: items[0]!.cost, last: 0, members: [0] });
  let level: { cost: number; members: number[] }[] = [{ cost: 0, members: [] }];
  const order = (members: number[]) =>
    members.map((m) => items[m]!.index).sort((a, b) => a - b);
  const flush = () =>
    level
      .map((s) => ({ cost: s.cost, members: order(s.members) }))
      .sort(
        (a, b) =>
          a.members.length - b.members.length ||
          a.members.join(',').localeCompare(b.members.join(','), 'en', {
            numeric: true,
          }),
      );
  while (heap.length) {
    const node = pop();
    if (node.cost > level[0]!.cost + EPSILON) {
      yield flush();
      level = [];
    }
    level.push({ cost: node.cost, members: node.members });
    const next = node.last + 1;
    if (next < items.length) {
      push({
        cost: node.cost + items[next]!.cost,
        last: next,
        members: [...node.members, next],
      });
      push({
        cost: node.cost - items[node.last]!.cost + items[next]!.cost,
        last: next,
        members: [...node.members.slice(0, -1), next],
      });
    }
  }
  yield flush();
}

/** What a selection's variant gives: its model and its propagation. */
const variantOf = (
  model: KaosModel,
  goals: readonly CountermeasureGoal[],
  scope: ResolutionScope,
) => {
  const variant = applyCountermeasures(
    model,
    goals.flatMap((g) => g.resolutions.map((r) => r.id)),
    { scope },
  );
  const view = kaosresView(variant.model);
  return {
    variant,
    view,
    probabilities: propagateProbabilities(view).probabilities,
  };
};

/**
 * The model's countermeasures selected (see the module's comment): every
 * selection evaluated, the safe, consistent and cost-optimal ones, the
 * chosen one.
 */
export const selectCountermeasures = (
  model: KaosModel,
  options: Partial<SelectionOptions> = {},
): SelectionResult => {
  const opts: SelectionOptions = { ...DEFAULT_SELECTION_OPTIONS, ...options };
  const kaostools = opts.semantics === 'kaostools';
  const { goals: all, costBasis } = countermeasureGoalsOf(model);
  const cmIds = new Set(all.map((g) => g.goal));

  // the high-level goals: those with an RSR; else the roots (no
  // countermeasure goal), whose satisfaction is maximised with none required
  const view = kaosresView(model);
  const rsrOf = new Map(
    view.elements
      .filter((e) => GOAL_KINDS.has(e.kind))
      .map((e) => [e.id, viewValues(kaosprop, 'element', e).RSR ?? null]),
  );
  const withRsr = [...rsrOf].filter(([, rsr]) => rsr !== null);
  const roots = rootGoalsOf(model).filter((id) => !cmIds.has(id));
  const highLevel = (withRsr.length ? withRsr.map(([id]) => id) : roots).map(
    (id) => ({
      id,
      name: model.elements.get(id)?.name.trim() || id,
      rsr: rsrOf.get(id) ?? null,
    }),
  );

  // a countermeasure none of whose resolutions applies alone is left out
  const excluded: SelectionResult['excluded'][number][] = [];
  const goals = all.filter((goal) => {
    const { variant } = variantOf(model, [goal], opts.scope);
    if (variant.applied.length) return true;
    excluded.push({ goal: goal.goal, problems: variant.problems });
    return false;
  });

  const conflicts = [...model.links.values()]
    .filter((l) => l.kind === CONFLICT)
    .map((l) => [l.source, l.target] as const);

  const evaluate = (members: readonly number[]): Selection => {
    const chosen = members.map((m) => goals[m]!);
    const { variant, probabilities } = variantOf(model, chosen, opts.scope);
    const selected = new Set(chosen.map((g) => g.goal));
    const inUse = reach(variant.model, [...roots, ...selected]);
    const broken = conflicts.filter(
      ([a, b]) =>
        (selected.has(a) || selected.has(b)) && inUse.has(a) && inUse.has(b),
    );
    const esr = new Map(
      highLevel.flatMap(({ id }) =>
        probabilities.has(id) ? [[id, probabilities.get(id)!] as const] : [],
      ),
    );
    const present = highLevel.filter(({ id }) => esr.has(id));
    return {
      goals: chosen.map((g) => g.goal),
      cost: chosen.reduce((sum, g) => sum + g.cost, 0),
      esr,
      satisfaction: present.length
        ? present.reduce((sum, { id }) => sum + esr.get(id)!, 0) /
          present.length
        : 0,
      safe: present.every(
        ({ id, rsr }) => rsr === null || esr.get(id)! - rsr > EPSILON,
      ),
      consistent: kaostools || broken.length === 0,
      conflicts: broken,
      costOptimal: false,
      problems: variant.problems,
    };
  };

  const items = goals
    .map((g, index) => ({ cost: g.cost, index }))
    .sort((a, b) => a.cost - b.cost || a.index - b.index);
  const candidates = 2 ** goals.length;
  const everything = candidates <= opts.limit;
  const selections: Selection[] = [];
  /** a candidate for the chosen one: safe and consistent (SEAMS'17), or safe and non-empty (KAOSTools) */
  const counts = (s: Selection) =>
    s.safe && s.consistent && (!kaostools || s.goals.length > 0);
  let minimalCost: number | null = null;
  let levelDone = false;
  search: for (const level of byCost(items)) {
    for (const { members } of level) {
      if (selections.length >= opts.limit) break search;
      const selection = evaluate(members);
      selections.push(selection);
      // KAOSTools: the empty selection's safety makes the minimal cost 0
      if (
        minimalCost === null &&
        (counts(selection) ||
          (kaostools && selection.goals.length === 0 && selection.safe))
      )
        minimalCost = selection.cost;
    }
    if (minimalCost !== null) {
      levelDone = true;
      if (!everything && !kaostools) break;
    }
  }
  const exhaustive = selections.length === candidates;

  // cost-optimal: no consistent selection costing no more is more satisfying
  const consistent = selections
    .filter((s) => s.consistent)
    .sort((a, b) => a.cost - b.cost);
  let best = -Infinity;
  for (let i = 0; i < consistent.length;) {
    let j = i;
    while (
      j < consistent.length &&
      Math.abs(consistent[j]!.cost - consistent[i]!.cost) <= EPSILON
    )
      best = Math.max(best, consistent[j++]!.satisfaction);
    for (let k = i; k < j; k++)
      consistent[k]!.costOptimal =
        consistent[k]!.satisfaction >= best - EPSILON;
    i = j;
  }

  // the most satisfying, the cheapest of them (KAOSTools keeps every tie)
  const most = (pool: readonly Selection[]): Selection[] => {
    const top = Math.max(...pool.map((s) => s.satisfaction));
    const ties = pool.filter((s) => s.satisfaction >= top - EPSILON);
    if (kaostools) return ties;
    const cheapest = Math.min(...ties.map((s) => s.cost));
    return ties.filter((s) => s.cost <= cheapest + EPSILON);
  };
  let chosen: Selection[];
  if (kaostools) {
    const nonEmpty = selections.filter((s) => s.goals.length > 0);
    chosen =
      minimalCost !== null && minimalCost > 0
        ? most(nonEmpty.filter((s) => s.cost <= minimalCost! + EPSILON))
        : nonEmpty.length
          ? most(nonEmpty)
          : [];
  } else if (minimalCost !== null)
    chosen = most(
      selections.filter(
        (s) => counts(s) && Math.abs(s.cost - minimalCost!) <= EPSILON,
      ),
    );
  else chosen = consistent.length ? most(consistent) : [];

  return {
    options: opts,
    countermeasures: goals,
    excluded,
    costBasis,
    highLevel,
    selections,
    candidates,
    exhaustive,
    minimalCost,
    chosen,
    exact: exhaustive || (levelDone && !kaostools),
  };
};

/** At most this many cases: the chosen, the cost-optimal and the safe ones first. */
const CASES = 256;

/**
 * The selection as an analysis result: a case per selection (the chosen
 * first, then the safe and cost-optimal ones, the other safe ones, the
 * other cost-optimal ones, the rest; at most 256), each the variant's
 * values on the model's elements, the elements it keeps in use its
 * selection (the canvas dims the rest), and a summary of its cost and its
 * high-level goals' ESR.
 */
export const runSelection = (
  view: AnalysisModel,
  _resource?: Readonly<Record<string, string>>,
  context?: AnalysisContext,
): AnalysisResult => {
  const model = kaosModelOfView(view);
  const result = selectCountermeasures(model, selectionOptionsOf(context));
  const { selections, chosen } = result;
  const rank = (s: Selection) =>
    chosen.includes(s)
      ? 0
      : s.safe && s.consistent && s.costOptimal
        ? 1
        : s.safe && s.consistent
          ? 2
          : s.costOptimal
            ? 3
            : 4;
  const shown = [...selections]
    .map((s, i) => ({ s, i }))
    .sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i)
    .slice(0, CASES)
    .map(({ s }) => s);
  const names = new Map(result.countermeasures.map((g) => [g.goal, g.name]));
  const countermeasureGoals = new Set(
    countermeasuresOf(model).map((c) => c.goal),
  );
  const roots = rootGoalsOf(model).filter((id) => !countermeasureGoals.has(id));
  const original = new Set([...model.elements.keys(), ...model.links.keys()]);
  const searched = `${selections.length} of ${result.candidates} selections${
    result.exhaustive ? '' : `, in cost order (limit ${result.options.limit})`
  }; ${selections.filter((s) => s.safe && s.consistent).length} safe and consistent; minimal cost ${
    result.minimalCost ?? 'none'
  }${result.exact ? '' : ' (the search stopped before it was exact)'}`;
  return {
    cases: shown.map((selection, n): AnalysisCase => {
      const picked = result.countermeasures.filter((g) =>
        selection.goals.includes(g.goal),
      );
      const {
        variant,
        view: variantView,
        probabilities,
      } = variantOf(model, picked, result.options.scope);
      const elements = new Map(variantView.elements.map((e) => [e.id, e]));
      const values: Record<string, AnalysisValue> = {};
      for (const [id, p] of probabilities)
        if (original.has(id))
          values[id] = probabilityValue(elements.get(id)!, p);
      const isChosen = chosen.includes(selection);
      const label = `${isChosen ? (selection.safe ? 'Chosen: ' : 'Best, none safe: ') : ''}${
        selection.goals.length
          ? selection.goals.map((g) => names.get(g) ?? g).join(' + ')
          : 'no countermeasure'
      }`;
      const flags = [
        selection.safe ? 'safe' : 'not safe',
        selection.consistent
          ? 'consistent'
          : `inconsistent (${selection.conflicts.map(([a, b]) => `${a} ⚡ ${b}`).join(', ')})`,
        ...(selection.costOptimal ? ['cost-optimal'] : []),
        ...(selection.problems.some((p) => p.severity === 'error')
          ? [
              `${selection.problems.filter((p) => p.severity === 'error').length} resolution(s) not applied`,
            ]
          : []),
      ];
      return {
        id: `selection-${selection.goals.join('+') || 'none'}`,
        label,
        values,
        selection: selectionOf(variant.model, roots, selection.goals).filter(
          (id) => original.has(id),
        ),
        summary: `cost ${selection.cost}; ${result.highLevel
          .map(({ id, name, rsr }) => {
            const esr = selection.esr.get(id);
            return `${name}: ${esr === undefined ? 'not in the variant' : `ESR ${percent(esr)}`}${
              rsr === null ? '' : ` (RSR ${percent(rsr)})`
            }`;
          })
          .join(', ')}; ${flags.join(', ')}${n === 0 ? `. ${searched}` : ''}`,
      };
    }),
  };
};

/**
 * What a variant keeps in use: the goals the model's roots (as given, no
 * countermeasure goal) and the selection reach
 * down its refinements, the obstacle trees that obstruct them, their
 * agents and the selection's resolutions; the links among them.
 */
const selectionOf = (
  model: KaosModel,
  roots: readonly string[],
  selected: readonly string[],
): string[] => {
  const kept = reach(model, [...roots, ...selected]);
  const links = [...model.links.values()];
  // hubs of kept goals, obstacles below them, agents assigned to them
  for (let grew = true; grew;) {
    grew = false;
    for (const link of links) {
      const add = (id: string) => {
        if (!kept.has(id)) {
          kept.add(id);
          grew = true;
        }
      };
      if (
        (link.kind === GOAL_END || link.kind === OBSTACLE_END) &&
        kept.has(link.target)
      )
        add(link.source);
      else if (
        (link.kind === GOAL_LEG || link.kind === OBSTACLE_LEG) &&
        kept.has(link.target) &&
        model.elements.get(link.target)?.kind !== GOAL_HUB
      )
        add(link.source);
      else if (link.kind === OBSTRUCTION && kept.has(link.target))
        add(link.source);
      else if (link.kind === ASSIGNMENT && kept.has(link.target))
        add(link.source);
      else if (
        link.kind === RESOLUTION &&
        selected.includes(link.source) &&
        kept.has(link.source)
      )
        add(link.target);
    }
  }
  return [
    ...kept,
    ...links
      .filter(
        (l) =>
          kept.has(l.source) &&
          kept.has(l.target) &&
          (l.kind !== RESOLUTION || selected.includes(l.source)),
      )
      .map((l) => l.id),
  ];
};
