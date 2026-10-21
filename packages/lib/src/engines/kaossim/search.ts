/**
 * kaossim's design-space search (goal-controller#193, D5): the
 * Pareto-optimal designs over the model's objective functions (RE'11 §IV.A:
 * a design dominates another when it is at least as good on every
 * objective and better on one; a `Min` objective counts negated). Two ways
 * to it:
 *
 * - exhaustive: every design (./simulation's enumeration, in odometer
 *   order, at most `limit`), the oracle (RE'11 §IV.D: "it did not produce
 *   better solutions than exhaustive search");
 * - NSGA-II (Deb, Pratap, Agarwal and Meyarivan, IEEE TEC 6(2) 2002), as
 *   RE'11 ran Matlab's: a chromosome is one option per decision point
 *   (RE'11 §IV.C's encoding, crossovers between decision points' genes, so
 *   every child is a valid design), seeded; fast non-dominated sorting,
 *   crowding distance, binary tournaments, uniform crossover and a
 *   mutation of 1/M per gene. Its result is its last population's first
 *   front.
 *
 * A design whose objectives aren't all resolved has no place in the order:
 * it is reported, not ranked. Each design is simulated once (evaluations
 * are cached by design), with common random numbers (./simulation).
 */
import { seededRandom, type Random } from '../../numeric/random';
import type { QuantitativeModel } from './model';
import {
  designOf,
  enumerateDesigns,
  simulateDesign,
  type DesignChoice,
  type DesignRun,
  type DrawCache,
  type SimulationOptions,
} from './simulation';

/** A design scored: its run, and its objectives as values to maximise (a Min objective negated). */
export type Scored = { run: DesignRun; scores: readonly number[] | null };

/** Whether `a` dominates `b` (both maximised). */
export const dominates = (a: readonly number[], b: readonly number[]) => {
  let better = false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]! < b[i]!) return false;
    if (a[i]! > b[i]!) better = true;
  }
  return better;
};

/** The non-dominated ones, in their order. */
export const paretoFront = <T extends { scores: readonly number[] | null }>(
  scored: readonly T[],
): T[] => {
  const ranked = scored.filter((s) => s.scores !== null);
  return ranked.filter(
    (s) => !ranked.some((t) => t !== s && dominates(t.scores!, s.scores!)),
  );
};

/** A run's scores: its objectives' values, Max as they are, Min negated; null when one is unresolved. */
export const scoresOf = (run: DesignRun): number[] | null => {
  const scores: number[] = [];
  for (const value of run.objectives) {
    if ('missing' in value) return null;
    scores.push(value.objective.modal === 'Max' ? value.value : -value.value);
  }
  return scores.length ? scores : null;
};

export type SearchOptions = SimulationOptions & {
  method: 'exhaustive' | 'nsga2';
  /** exhaustive: at most this many designs */
  limit: number;
  /** NSGA-II's population and generations */
  population: number;
  generations: number;
};

export type SearchResult = {
  method: SearchOptions['method'];
  /** every design evaluated, in the order first evaluated */
  evaluated: readonly Scored[];
  /** the Pareto-optimal ones (exhaustive: of every design; NSGA-II: its last population's first front) */
  front: readonly Scored[];
  /** exhaustive: every design was evaluated */
  complete: boolean;
};

/** An evaluator that simulates each design once. */
const evaluator = (model: QuantitativeModel, options: SimulationOptions) => {
  const cache: DrawCache = new Map();
  const runs = new Map<string, Scored>();
  const order: Scored[] = [];
  return {
    order,
    evaluate: (design: DesignChoice): Scored => {
      const key = designOf(model, design.options).id;
      const known = runs.get(key);
      if (known) return known;
      const run = simulateDesign(model, design, options, cache);
      const scored = { run, scores: scoresOf(run) };
      runs.set(key, scored);
      order.push(scored);
      return scored;
    },
  };
};

/** Every design, simulated; the Pareto front among them. */
export const exhaustiveSearch = (
  model: QuantitativeModel,
  options: SearchOptions,
): SearchResult => {
  const { designs, complete } = enumerateDesigns(model, options.limit);
  const { evaluate, order } = evaluator(model, options);
  for (const design of designs) evaluate(design);
  return {
    method: 'exhaustive',
    evaluated: order,
    front: paretoFront(order),
    complete,
  };
};

type Individual = {
  genes: number[];
  scored: Scored;
  rank: number;
  crowding: number;
};

/** Deb et al.'s fast non-dominated sort: the fronts, best first (unscored ones last, in a front of their own). */
const sortFronts = (population: Individual[]): Individual[][] => {
  const scored = population.filter((p) => p.scored.scores !== null);
  const unscored = population.filter((p) => p.scored.scores === null);
  const dominated = scored.map(() => [] as number[]);
  const count = scored.map(() => 0);
  const fronts: number[][] = [[]];
  scored.forEach((p, i) => {
    scored.forEach((q, j) => {
      if (i === j) return;
      if (dominates(p.scored.scores!, q.scored.scores!)) dominated[i]!.push(j);
      else if (dominates(q.scored.scores!, p.scored.scores!)) count[i]! += 1;
    });
    if (count[i] === 0) fronts[0]!.push(i);
  });
  for (let f = 0; fronts[f]!.length; f++) {
    const next: number[] = [];
    for (const i of fronts[f]!)
      for (const j of dominated[i]!) if (--count[j]! === 0) next.push(j);
    fronts.push(next);
  }
  const result = fronts
    .filter((front) => front.length)
    .map((front, rank) =>
      front.map((i) => {
        scored[i]!.rank = rank;
        return scored[i]!;
      }),
    );
  if (unscored.length) {
    for (const u of unscored) u.rank = result.length;
    result.push(unscored);
  }
  return result;
};

/** Each member's crowding distance in its front (Deb et al. §III.B). */
const crowd = (front: Individual[]) => {
  for (const p of front) p.crowding = 0;
  const m = front[0]?.scored.scores?.length ?? 0;
  for (let k = 0; k < m; k++) {
    const sorted = [...front].sort(
      (a, b) => a.scored.scores![k]! - b.scored.scores![k]!,
    );
    const low = sorted[0]!.scored.scores![k]!;
    const high = sorted[sorted.length - 1]!.scored.scores![k]!;
    sorted[0]!.crowding = Infinity;
    sorted[sorted.length - 1]!.crowding = Infinity;
    if (high === low) continue;
    for (let i = 1; i < sorted.length - 1; i++)
      sorted[i]!.crowding +=
        (sorted[i + 1]!.scored.scores![k]! -
          sorted[i - 1]!.scored.scores![k]!) /
        (high - low);
  }
};

/** The better of two by rank, then crowding (the crowded-comparison operator). */
const better = (a: Individual, b: Individual) =>
  a.rank !== b.rank
    ? a.rank < b.rank
      ? a
      : b
    : a.crowding >= b.crowding
      ? a
      : b;

/** NSGA-II over the decision points, seeded; its last population's first front. */
export const nsga2Search = (
  model: QuantitativeModel,
  options: SearchOptions,
): SearchResult => {
  const decisions = model.decisions;
  const random: Random = seededRandom(options.seed);
  const { evaluate, order } = evaluator(model, options);
  const pick = (n: number) => Math.min(n - 1, Math.floor(random() * n));
  const individual = (genes: number[]): Individual => ({
    genes,
    scored: evaluate(
      designOf(
        model,
        genes.map((g, i) => decisions[i]!.options[g]!.sysRef),
      ),
    ),
    rank: 0,
    crowding: 0,
  });
  const size = Math.max(2, options.population);
  let population = Array.from({ length: size }, () =>
    individual(decisions.map((d) => pick(d.options.length))),
  );
  const select = () => {
    for (const front of sortFronts(population)) crowd(front);
    return () =>
      better(
        population[pick(population.length)]!,
        population[pick(population.length)]!,
      );
  };
  const mutation = decisions.length ? 1 / decisions.length : 0;
  for (let g = 0; g < options.generations; g++) {
    const tournament = select();
    const offspring: Individual[] = [];
    while (offspring.length < size) {
      const a = tournament();
      const b = tournament();
      // uniform crossover, a decision point's gene from either parent
      const genes = decisions.map((d, i) => {
        const gene = random() < 0.5 ? a.genes[i]! : b.genes[i]!;
        return random() < mutation ? pick(d.options.length) : gene;
      });
      offspring.push(individual(genes));
    }
    // one copy of each design (duplicates would crowd out the front's
    // other members: a common NSGA-II refinement for discrete problems)
    const pool = new Map<Scored, Individual>();
    for (const p of [...population, ...offspring])
      if (!pool.has(p.scored)) pool.set(p.scored, p);
    const fronts = sortFronts([...pool.values()]);
    const next: Individual[] = [];
    for (const front of fronts) {
      crowd(front);
      if (next.length + front.length <= size) next.push(...front);
      else {
        next.push(
          ...[...front]
            .sort((x, y) => y.crowding - x.crowding)
            .slice(0, size - next.length),
        );
        break;
      }
    }
    population = next;
  }
  const first = sortFronts(population)[0] ?? [];
  const front = [...new Set(first.map((p) => p.scored))].filter(
    (s) => s.scores !== null,
  );
  return {
    method: 'nsga2',
    evaluated: order,
    front: paretoFront(front),
    complete: false,
  };
};

/** The search the options ask for. */
export const searchDesigns = (
  model: QuantitativeModel,
  options: SearchOptions,
): SearchResult =>
  options.method === 'nsga2'
    ? nsga2Search(model, options)
    : exhaustiveSearch(model, options);
