/**
 * Cooke's classical model (Cooke, *Experts in Uncertainty*, 1991), as
 * Cailliau and van Lamsweerde's RE'15 applies it (§V, D3 of
 * goal-controller#190): each expert gets a calibration score (how well its
 * quantiles catch the known values of the calibration variables) and an
 * information score (how narrow its quantiles are), its weight is their
 * product, normalised, and an obstacle's estimate is the experts'
 * quantile distributions mixed by weight (the decision maker).
 *
 * `re15` scores as RE'15's tool did (KAOSTools' UncertaintySimulation, March
 * 2015, over ExpertOpinionSharp's `CookFramework`, both MIT), which is how
 * the paper's numbers were made. It departs from the textbook model:
 *
 * - the bins' expected masses are (.05, .45, .45, .05) for three quantiles,
 *   whatever the model's levels (the fire alarm and ADS declare (.1, .5,
 *   .9)); for another count, the levels' own masses;
 * - every variable an expert estimated counts, leaf obstacles too (N):
 *   information is averaged over all of them, and the calibration's
 *   empirical masses s are realisations per bin over N, so they sum to less
 *   than 1 once leaves are estimated;
 * - each bin's term of the relative information I(s, p) is clamped at 0,
 *   and the calibration score is 1 − χ²₍B−1₎(2·N·I);
 * - the cut-off α is the one maximising the decision maker's information
 *   score (Brent's search on [0, the largest weight], `optimal`).
 *
 * The fire alarm's calibration scores (Expert1 0.9305, Expert2 1) are these
 * rules' with N = 16 (13 leaves, 3 calibration variables): one of Expert1's
 * realisations in a 5 % tail bin gives 1 − χ²₃(2·ln 1.25) = 0.9305.
 * `classical` is the textbook model: the levels' masses, calibration
 * variables only (s sums to 1, no clamp), information over them, no
 * cut-off. `equal` weighs every expert the same.
 */
import { chiSquaredCdf } from '../../numeric/special';
import { localMin } from '../../numeric/minimize';
import {
  intrinsicRange,
  mixture,
  piecewise,
  type Continuous,
} from '../../numeric/distributions';

export type Weighting = 're15' | 'classical' | 'equal';
export const WEIGHTINGS: readonly Weighting[] = ['re15', 'classical', 'equal'];

/**
 * One variable: each expert's quantiles at the levels, and its known value
 * when it is a calibration variable. An expert who gave a named
 * distribution (`pert[…]`) is scored on its quantiles at the levels, and
 * mixed into the decision maker as that distribution (`distributions`).
 */
export type CookeVariable = {
  id: string;
  estimates: ReadonlyMap<string, readonly number[]>;
  known?: number;
  distributions?: ReadonlyMap<string, Continuous>;
};

export type CookeInput = {
  /** the quantiles' cumulative probabilities, ascending (`(.1, .5, .9)`) */
  levels: readonly number[];
  /** the experts, in order (each one estimating at least one variable is one) */
  experts: readonly string[];
  variables: readonly CookeVariable[];
  weighting?: Weighting;
  /** the intrinsic range's overshoot, each side (default 10 %) */
  overshoot?: number;
};

/** An expert's scores. */
export type ExpertScore = {
  expert: string;
  information: number;
  calibration: number;
  /** its normalised weight (0: cut off) */
  weight: number;
  /** its realisations' masses per bin (s), and the χ² statistic 2·N·I(s, p) */
  bins: readonly number[];
  statistic: number;
  /** the variables it estimated (N) and the calibration variables among them */
  variables: number;
  calibrationVariables: number;
};

export type CookeResult = {
  weighting: Weighting;
  /** the bins' expected masses (p) */
  masses: readonly number[];
  /** the cut-off α weights were computed with */
  alpha: number;
  scores: readonly ExpertScore[];
  /** a variable's decision maker: its experts' quantile distributions mixed by weight */
  decisionMaker(
    id: string,
  ): (Continuous & { sample(r: () => number): number }) | null;
  /** a variable's range: its experts' quantiles and known value, with the overshoot */
  rangeOf(id: string): readonly [number, number] | null;
};

/** The bins' masses: the levels' (classical), or RE'15's tool's (.05, .45, .45, .05) for three quantiles. */
const massesOf = (
  levels: readonly number[],
  weighting: Weighting,
): number[] => {
  if (weighting === 're15' && levels.length === 3)
    return [0.05, 0.45, 0.45, 0.05];
  return [...levels, 1].map((l, i) => l - (i ? levels[i - 1]! : 0));
};

const TINY = Number.EPSILON;

export const cooke = ({
  levels,
  experts,
  variables,
  weighting = 're15',
  overshoot = 0.1,
}: CookeInput): CookeResult => {
  const p = massesOf(levels, weighting);
  const bins = p.length;
  const ranges = new Map<string, [number, number]>();
  for (const v of variables) {
    const values = [...v.estimates.values()].flat();
    if (v.known !== undefined) values.push(v.known);
    if (values.length) ranges.set(v.id, intrinsicRange(values, overshoot));
  }
  /** an expert's interpolated masses per bin on a variable (r) */
  const interpolated = (v: CookeVariable, q: readonly number[]) => {
    const [low, high] = ranges.get(v.id)!;
    const points = [low, ...q, high];
    return p.map((_, i) => (points[i + 1]! - points[i]!) / (high - low));
  };
  const relative = (r: readonly number[]) =>
    p.reduce(
      (sum, pi, i) => sum + pi * Math.log(pi / Math.max(r[i]!, TINY)),
      0,
    );

  const raw = experts.map((expert) => {
    const own = variables.filter((v) => v.estimates.has(expert));
    const scored =
      weighting === 'classical'
        ? own.filter((v) => v.known !== undefined)
        : own;
    const calibrating = own.filter((v) => v.known !== undefined);
    const n = scored.length;
    const information = n
      ? scored.reduce(
          (sum, v) => sum + relative(interpolated(v, v.estimates.get(expert)!)),
          0,
        ) / n
      : 0;
    const counts = p.map(() => 0);
    for (const v of calibrating) {
      const q = v.estimates.get(expert)!;
      // bin i: q[i−1] ≤ known < q[i] (ExpertOpinionSharp's empirical distribution)
      let i = 0;
      while (i < q.length && q[i]! <= v.known!) i++;
      counts[i]!++;
    }
    const s = counts.map((c) => (n ? c / n : 0));
    const divergence = s.reduce((sum, si, i) => {
      const term = si > 0 ? si * Math.log(si / p[i]!) : 0;
      return sum + (weighting === 're15' ? Math.max(0, term) : term);
    }, 0);
    const statistic = 2 * n * divergence;
    // classical: an expert with no calibration variable has no calibration
    const calibration =
      weighting === 'classical' && !calibrating.length
        ? 0
        : 1 - chiSquaredCdf(bins - 1, statistic);
    return {
      expert,
      information,
      calibration,
      bins: s,
      statistic,
      variables: own.length,
      calibrationVariables: calibrating.length,
    };
  });

  const weightsAt = (alpha: number): number[] => {
    if (weighting === 'equal') return experts.map(() => 1 / experts.length);
    const unscaled = raw.map((r) =>
      r.calibration >= alpha ? r.calibration * r.information : 0,
    );
    const total = unscaled.reduce((a, b) => a + b, 0);
    return total > 0 ? unscaled.map((w) => w / total) : unscaled;
  };

  /** the decision maker's information score at a cut-off (ExpertOpinionSharp's GetDMInformationScore) */
  const dmInformation = (alpha: number) => {
    const w = weightsAt(alpha);
    const sum = w.reduce((a, b) => a + b, 0);
    let score = 0;
    for (const v of variables) {
      const r = p.map((_, i) => {
        let mass = 0;
        experts.forEach((expert, e) => {
          const q = v.estimates.get(expert);
          if (q) mass += w[e]! * interpolated(v, q)[i]!;
        });
        return sum > 0 ? mass / sum : mass;
      });
      score += p.reduce(
        (s, pi, i) => s + (r[i]! > 0 ? pi * Math.log(pi / r[i]!) : 0),
        0,
      );
    }
    return variables.length ? score / variables.length : 0;
  };

  let alpha = 0;
  if (weighting === 're15' && experts.length > 1) {
    const upper = Math.max(...weightsAt(0));
    if (upper > 0) alpha = localMin(0, upper, (a) => -dmInformation(a));
  }
  const weights = weightsAt(alpha);
  const scores: ExpertScore[] = raw.map((r, i) => ({
    ...r,
    weight: weights[i]!,
  }));

  const byId = new Map(variables.map((v) => [v.id, v]));
  return {
    weighting,
    masses: p,
    alpha,
    scores,
    rangeOf: (id) => ranges.get(id) ?? null,
    decisionMaker: (id) => {
      const v = byId.get(id);
      const range = ranges.get(id);
      if (!v || !range) return null;
      const components = experts.flatMap((expert, e) => {
        const q = v.estimates.get(expert);
        return q && weights[e]! > 0
          ? [
              {
                weight: weights[e]!,
                distribution:
                  v.distributions?.get(expert) ??
                  piecewise([0, ...levels, 1], [range[0], ...q, range[1]]),
              },
            ]
          : [];
      });
      const total = components.reduce((a, c) => a + c.weight, 0);
      return total > 0
        ? mixture(components.map((c) => ({ ...c, weight: c.weight / total })))
        : null;
    },
  };
};
