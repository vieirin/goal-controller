/**
 * kaossim's simulation (goal-controller#193): a design's objective functions
 * by Monte Carlo, as Heaven and Letier simulate a goal model (RE'11 §III.A):
 *
 * - the design picks one option per decision point; the goals, refinements
 *   and assignments it keeps are the active ones (a goal refined or
 *   assigned one way only is kept as it is);
 * - each quality variable has one definition in the design: a goal's
 *   estimate, the kept refinement's equation, or the kept assignment's
 *   estimate; a design's `set` replaces it with its own estimate (FSE'04
 *   §5.1's what-if). None: the variable is unresolved, and so is every
 *   objective that depends on it (it gets no number, only the list of what
 *   it lacks);
 * - N samples: a leaf variable's N values are drawn from its distribution
 *   (§III.A's step 2), independently of every other leaf (FSE'04 §4.3's
 *   assumption), each variable once per sample (shared by every equation
 *   that reads it, §III.A's Gsim); an equation's values are computed from
 *   its variables', element-wise (step 3). A Boolean variable is 0 or 1;
 *   its estimate is the probability it is true (a value, or a distribution
 *   of that probability: a draw of it, then a Bernoulli draw);
 * - an objective function is the share of the samples its condition holds
 *   in (a probability, the frequentist reading of step 4) or its
 *   expression's mean, with its Monte Carlo standard error.
 *
 * Draws are seeded per variable (its name and the run's seed), so two
 * designs sharing a leaf's estimate draw the same values for it (common
 * random numbers: a comparison between designs is not blurred by noise),
 * and a run is reproducible.
 */
import type { Distribution } from '@goal-controller/dialect';
import type {
  AssertionReading,
  ExpressionTree,
} from '@goal-controller/goal-language';
import { continuousOf } from '../../numeric/distributions';
import { seededRandom } from '../../numeric/random';
import type { Design } from './designs';
import type {
  Assignment,
  DecisionPoint,
  ObjectiveFunction,
  QuantitativeModel,
  Refinement,
  VariableDefinition,
} from './model';

/** A design's picks, as the simulation reads them: an id, a name, the SysRefs, the estimates it sets. */
export type DesignChoice = Pick<Design, 'id' | 'name' | 'options' | 'set'>;

/** What a design keeps of the model: its goals, its refinements and assignments, the links they are. */
export type ActiveModel = {
  goals: ReadonlySet<string>;
  refinements: ReadonlyMap<string, Refinement>;
  assignments: ReadonlyMap<string, Assignment>;
  /** the ids it consists of (goals, hubs, links), for the workbench's selection */
  selection: readonly string[];
  /** a decision point it reaches and picks no option of, or several */
  problems: readonly string[];
};

/** The goals, refinements and assignments a design keeps, from the roots down. */
export const activeModel = (
  model: QuantitativeModel,
  picks: ReadonlySet<string>,
): ActiveModel => {
  const goals = new Set<string>();
  const refinements = new Map<string, Refinement>();
  const assignments = new Map<string, Assignment>();
  const selection: string[] = [];
  const problems: string[] = [];
  const nameOf = (id: string) => model.goals.get(id)?.name.trim() || id;
  /** the way a goal is kept: its only one, or the picked one */
  const kept = <W extends { id: string; sysRef: string }>(
    goal: string,
    ways: readonly W[],
    via: string,
  ): W | undefined => {
    if (ways.length <= 1) return ways[0];
    const picked = ways.filter((w) => picks.has(w.sysRef));
    if (picked.length === 1) return picked[0];
    problems.push(
      picked.length
        ? `${nameOf(goal)}: the design picks ${picked.length} of its ${via}s (${picked.map((w) => w.sysRef).join(', ')})`
        : `${nameOf(goal)}: the design picks none of its ${via}s (${ways.map((w) => w.sysRef || '?').join(', ')})`,
    );
    return undefined;
  };
  const visit = (goal: string) => {
    if (goals.has(goal) || !model.goals.has(goal)) return;
    goals.add(goal);
    selection.push(goal);
    const assignment = kept(
      goal,
      model.assignments.get(goal) ?? [],
      'assignment',
    );
    if (assignment) {
      assignments.set(goal, assignment);
      selection.push(assignment.id, assignment.agent);
    }
    const refinement = kept(
      goal,
      model.refinements.get(goal) ?? [],
      'refinement',
    );
    if (!refinement) return;
    refinements.set(goal, refinement);
    selection.push(refinement.id, ...refinement.links);
    for (const child of refinement.children) visit(child);
  };
  for (const root of model.roots) visit(root);
  return { goals, refinements, assignments, selection, problems };
};

/**
 * A design from picks, one per decision point: the picks at the decision
 * points it reaches (a pick below an alternative it doesn't keep is no part
 * of it), its id and name theirs.
 */
export const designOf = (
  model: QuantitativeModel,
  picks: readonly string[],
): DesignChoice => {
  const active = activeModel(model, new Set(picks));
  const reached = model.decisions
    .filter((d) => active.goals.has(d.goal))
    .flatMap((d) => d.options.filter((o) => picks.includes(o.sysRef)))
    .map((o) => o.sysRef);
  return {
    id: reached.join('+') || 'model',
    name: reached.join(', ') || 'The model',
    options: reached,
    set: new Map(),
  };
};

/** Every design of the model: one option per decision point a design reaches, each combination once. */
export const enumerateDesigns = (
  model: QuantitativeModel,
  limit = Infinity,
): { designs: DesignChoice[]; complete: boolean } => {
  const designs: DesignChoice[] = [];
  const seen = new Set<string>();
  const decisions = model.decisions;
  let complete = true;
  // a product over the decision points, odometer-wise (the last fastest);
  // picks differing only where a design doesn't reach are the same design
  const index = decisions.map(() => 0);
  const total = decisions.reduce((n, d) => n * d.options.length, 1);
  for (let k = 0; k < total; k++) {
    const design = designOf(
      model,
      decisions.map((d, i) => d.options[index[i]!]!.sysRef),
    );
    if (!seen.has(design.id)) {
      if (designs.length >= limit) {
        complete = false;
        break;
      }
      seen.add(design.id);
      designs.push(design);
    }
    for (let i = decisions.length - 1; i >= 0; i--) {
      index[i]! += 1;
      if (index[i]! < decisions[i]!.options.length) break;
      index[i] = 0;
    }
  }
  return { designs, complete };
};

/** An objective's value in a design: its estimate and standard error, or what it lacks. */
export type ObjectiveValue =
  | { objective: ObjectiveFunction; value: number; stderr: number }
  | { objective: ObjectiveFunction; missing: readonly string[] };

/** A design simulated: its objectives' values, its variables' samples, what went wrong. */
export type DesignRun = {
  design: DesignChoice;
  active: ActiveModel;
  objectives: readonly ObjectiveValue[];
  /** each resolved variable's samples */
  samples: ReadonlyMap<string, Float64Array>;
  /** each unresolved variable, with the leaves it lacks */
  missing: ReadonlyMap<string, readonly string[]>;
  problems: readonly string[];
};

export type SimulationOptions = { samples: number; seed: number };

/** FNV-1a of a variable's name, mixed with the run's seed: its draws' own seed. */
const seedOf = (seed: number, name: string) => {
  let h = 0x811c9dc5 ^ seed;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/** Draws, cached per variable and estimate (a design that shares a leaf's estimate shares its draws). */
export type DrawCache = Map<string, Float64Array>;

const draw = (
  name: string,
  distribution: Distribution,
  boolean: boolean,
  { samples, seed }: SimulationOptions,
): Float64Array => {
  const random = seededRandom(seedOf(seed, name));
  const out = new Float64Array(samples);
  if (distribution.kind === 'point') {
    const p = distribution.value;
    for (let s = 0; s < samples; s++)
      out[s] = boolean ? (random() < p ? 1 : 0) : p;
    return out;
  }
  const c = continuousOf(distribution);
  for (let s = 0; s < samples; s++) {
    const x = c.quantile(random());
    out[s] = boolean ? (random() < x ? 1 : 0) : x;
  }
  return out;
};

const truth = (x: number) => x !== 0;

/** One design's simulation. */
export const simulateDesign = (
  model: QuantitativeModel,
  design: DesignChoice,
  options: SimulationOptions,
  cache: DrawCache = new Map(),
): DesignRun => {
  const n = options.samples;
  const active = activeModel(model, new Set(design.options));
  const problems = [...active.problems];
  const known = new Set(
    model.decisions.flatMap((d) => d.options.map((o) => o.sysRef)),
  );
  for (const pick of design.options)
    if (!known.has(pick))
      problems.push(`${design.name}: ${pick} is no option of the model`);

  // each variable's definition in this design, and where it is
  const definitions = new Map<
    string,
    { definition: VariableDefinition; at: string }
  >();
  const define = (
    from: ReadonlyMap<string, VariableDefinition>,
    at: string,
  ) => {
    for (const [name, definition] of from) {
      const other = definitions.get(name);
      if (other)
        problems.push(
          `${name} is defined twice in ${design.name}: by ${other.at} and by ${at}`,
        );
      else definitions.set(name, { definition, at });
    }
  };
  const nameOf = (id: string) => model.goals.get(id)?.name.trim() || id;
  for (const goal of active.goals) {
    define(model.estimates.get(goal) ?? new Map(), nameOf(goal));
    const refinement = active.refinements.get(goal);
    if (refinement)
      define(refinement.definitions, `a refinement of ${nameOf(goal)}`);
    const assignment = active.assignments.get(goal);
    if (assignment)
      define(assignment.definitions, `${nameOf(goal)}'s assignment`);
  }
  for (const [name, { distribution, text }] of design.set)
    definitions.set(name, {
      definition: { kind: 'distribution', distribution, text },
      at: design.name,
    });

  const samples = new Map<string, Float64Array>();
  const missing = new Map<string, readonly string[]>();
  const visiting = new Set<string>();
  type Read = Float64Array | { missing: readonly string[] };
  const isBoolean = (name: string) =>
    model.variables.get(name)?.sort === 'Boolean';

  const variable = (name: string): Read => {
    const done = samples.get(name);
    if (done) return done;
    const lacking = missing.get(name);
    if (lacking) return { missing: lacking };
    const found = definitions.get(name);
    if (!found || visiting.has(name)) {
      if (found) problems.push(`${name} is defined in terms of itself`);
      missing.set(name, [name]);
      return { missing: [name] };
    }
    visiting.add(name);
    const { definition } = found;
    let read: Read;
    if (definition.kind === 'distribution') {
      const boolean = isBoolean(name);
      const key = `${name}\u0000${definition.text}\u0000${boolean}`;
      let drawn = cache.get(key);
      if (!drawn) {
        drawn = draw(name, definition.distribution, boolean, options);
        cache.set(key, drawn);
      }
      read = drawn;
    } else if (definition.kind === 'equation') {
      read = expression(definition.expression);
      if (!('missing' in read) && isBoolean(name))
        read = read.map((x) => (truth(x) ? 1 : 0));
    } else read = condition(definition.condition);
    visiting.delete(name);
    if ('missing' in read) missing.set(name, read.missing);
    else samples.set(name, read);
    return read;
  };

  const unresolved = (reads: readonly Read[]): Read | null => {
    const lacking = new Set<string>();
    for (const read of reads)
      if ('missing' in read) for (const m of read.missing) lacking.add(m);
    return lacking.size ? { missing: [...lacking] } : null;
  };
  const constant = (x: number) => new Float64Array(n).fill(x);
  const map2 = (
    a: Float64Array,
    b: Float64Array,
    f: (x: number, y: number) => number,
  ) => {
    const out = new Float64Array(n);
    for (let s = 0; s < n; s++) out[s] = f(a[s]!, b[s]!);
    return out;
  };

  const expression = (tree: ExpressionTree): Read => {
    switch (tree.kind) {
      case 'number':
        return constant(Number(tree.value));
      case 'var':
        return variable(tree.name);
      case 'ref':
        return variable(tree.id);
      case 'member':
        problems.push(
          `${tree.ref}.${tree.member}: an equation reads no member`,
        );
        return { missing: [`${tree.ref}.${tree.member}`] };
      case 'unary': {
        const x = expression(tree.expr);
        return 'missing' in x ? x : x.map((v) => -v);
      }
      case 'binary': {
        const a = expression(tree.left);
        const b = expression(tree.right);
        const lacking = unresolved([a, b]);
        if (lacking) return lacking;
        const [x, y] = [a as Float64Array, b as Float64Array];
        switch (tree.operator) {
          case '+':
            return map2(x, y, (p, q) => p + q);
          case '-':
            return map2(x, y, (p, q) => p - q);
          case '*':
            return map2(x, y, (p, q) => p * q);
          case '/':
            return map2(x, y, (p, q) => p / q);
        }
      }
      case 'call': {
        const args = tree.args.map(expression);
        const lacking = unresolved(args);
        if (lacking) return lacking;
        const [a, b, c] = args as Float64Array[];
        if (tree.name === 'if' && a && b && c) {
          const out = new Float64Array(n);
          for (let s = 0; s < n; s++) out[s] = truth(a[s]!) ? b[s]! : c[s]!;
          return out;
        }
        if (tree.name === 'min' && a && b) return map2(a, b, Math.min);
        if (tree.name === 'max' && a && b) return map2(a, b, Math.max);
        problems.push(`${tree.name}(…): no such function in an equation`);
        return { missing: [`${tree.name}(…)`] };
      }
    }
  };

  const COMPARE: Readonly<
    Record<string, ((x: number, y: number) => boolean) | undefined>
  > = {
    '=': (x, y) => x === y,
    '!=': (x, y) => x !== y,
    '<': (x, y) => x < y,
    '<=': (x, y) => x <= y,
    '>': (x, y) => x > y,
    '>=': (x, y) => x >= y,
  };
  const condition = (tree: AssertionReading | null): Read => {
    if (!tree) return constant(1);
    switch (tree.kind) {
      case 'and':
      case 'or': {
        const a = condition(tree.left);
        const b = condition(tree.right);
        const lacking = unresolved([a, b]);
        if (lacking) return lacking;
        return tree.kind === 'and'
          ? map2(a as Float64Array, b as Float64Array, (p, q) =>
              truth(p) && truth(q) ? 1 : 0,
            )
          : map2(a as Float64Array, b as Float64Array, (p, q) =>
              truth(p) || truth(q) ? 1 : 0,
            );
      }
      case 'not': {
        const x = condition(tree.expr);
        return 'missing' in x ? x : x.map((v) => (truth(v) ? 0 : 1));
      }
      case 'paren':
        return condition(tree.expr);
      case 'bool':
        return constant(tree.value ? 1 : 0);
      case 'var': {
        const x = variable(tree.variable);
        return 'missing' in x ? x : x.map((v) => (truth(v) ? 1 : 0));
      }
      case 'assign': {
        if (tree.member) {
          problems.push(
            `${tree.variable}.${tree.member}: a condition reads no member`,
          );
          return { missing: [`${tree.variable}.${tree.member}`] };
        }
        const x = variable(tree.variable);
        const holds = tree.value !== Boolean(tree.negated);
        return 'missing' in x ? x : x.map((v) => (truth(v) === holds ? 1 : 0));
      }
      case 'comparison': {
        const compare = COMPARE[tree.operator];
        const a = expression(tree.left);
        const b = expression(tree.right);
        const lacking = unresolved([a, b]);
        if (lacking) return lacking;
        if (!compare) return { missing: [tree.operator] };
        return map2(a as Float64Array, b as Float64Array, (p, q) =>
          compare(p, q) ? 1 : 0,
        );
      }
      case 'member':
        problems.push(
          `${tree.ref}.${tree.member}: a condition reads no member`,
        );
        return { missing: [`${tree.ref}.${tree.member}`] };
      case 'call':
        problems.push(`${tree.name}(…): a condition calls no function`);
        return { missing: [`${tree.name}(…)`] };
    }
  };

  const objectives: ObjectiveValue[] = [];
  for (const objective of model.objectives) {
    if (!active.goals.has(objective.goal)) continue;
    const read =
      objective.def.measure === 'probability'
        ? condition(objective.def.event)
        : expression(objective.def.of);
    if ('missing' in read) {
      objectives.push({ objective, missing: read.missing });
      continue;
    }
    let sum = 0;
    let squares = 0;
    for (const x of read) {
      sum += x;
      squares += x * x;
    }
    const mean = sum / n;
    const variance =
      n > 1 ? Math.max(0, (squares - n * mean * mean) / (n - 1)) : 0;
    objectives.push({
      objective,
      value: mean,
      stderr: Math.sqrt(variance / n),
    });
  }
  // every variable of a kept goal, for the report (its distribution)
  for (const name of model.variables.keys())
    if (active.goals.has(model.variables.get(name)!.goal)) variable(name);

  return { design, active, objectives, samples, missing, problems };
};

/** The decision points a design reaches, with the option it picks there (none: undecided). */
export const picksOf = (
  model: QuantitativeModel,
  run: Pick<DesignRun, 'design' | 'active'>,
): { decision: DecisionPoint; pick: string | undefined }[] =>
  model.decisions
    .filter((d) => run.active.goals.has(d.goal))
    .map((decision) => ({
      decision,
      pick: decision.options.find((o) => run.design.options.includes(o.sysRef))
        ?.sysRef,
    }));
