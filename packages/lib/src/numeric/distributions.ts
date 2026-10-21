/**
 * Distributions as numbers (goal-controller#190): the dialect's
 * `distribution` value (`@goal-controller/dialect`'s `Distribution`, as
 * written) as something to sample, and to read quantiles and a CDF from.
 * Generic: no engine's; the quantitative round shares it (#189).
 *
 * - Beta(α, β): its inverse CDF is the inverse regularised incomplete beta
 *   function (./special);
 * - PERT[min, mode, max]: a Beta scaled to [min, max], α = 1 + 4(mode −
 *   min)/(max − min), β = 1 + 4(max − mode)/(max − min) (Vose, *Risk
 *   Analysis*, 2008; KAOSTools' `PERTEstimate`, mean (min + 4·mode + max)/6);
 * - triangular and uniform, closed forms;
 * - quantiles: a CDF through each value at its level, linear between them
 *   (a piecewise uniform density), from a lower to an upper bound at levels
 *   0 and 1, as Cooke's classical model interpolates an expert's quantiles
 *   (RE'15's tool, ExpertOpinionSharp's `QuantileDistribution`);
 * - exponential (its mean, goal-controller#193) and normal, closed forms
 *   (the normal's quantile by ./special's Φ⁻¹), their support unbounded;
 * - a point: that value;
 * - a mixture: components with weights (a decision maker's combination).
 */
import type { Distribution } from '@goal-controller/dialect';
import { betaInc, invBetaInc, normalCdf, normalQuantile } from './special';
import type { Random } from './random';

/** A univariate distribution: its quantile function (inverse CDF), CDF, support and mean. */
export type Continuous = {
  quantile(u: number): number;
  cdf(x: number): number;
  min: number;
  max: number;
  mean: number;
};

/** A distribution with its CDF through `points[i]` at `levels[i]` (levels from 0 to 1), linear between. */
export const piecewise = (
  levels: readonly number[],
  points: readonly number[],
): Continuous => {
  const last = points.length - 1;
  let mean = 0;
  for (let i = 1; i <= last; i++)
    mean += (levels[i]! - levels[i - 1]!) * ((points[i]! + points[i - 1]!) / 2);
  return {
    min: points[0]!,
    max: points[last]!,
    mean,
    quantile: (u) => {
      let i = 1;
      while (i < last && u >= levels[i]!) i++;
      const span = levels[i]! - levels[i - 1]!;
      const t = span > 0 ? (u - levels[i - 1]!) / span : 0;
      return points[i - 1]! + t * (points[i]! - points[i - 1]!);
    },
    cdf: (x) => {
      if (x < points[0]!) return 0;
      if (x >= points[last]!) return 1;
      let i = 1;
      while (i < last && x >= points[i]!) i++;
      const width = points[i]! - points[i - 1]!;
      const t = width > 0 ? (x - points[i - 1]!) / width : 1;
      return levels[i - 1]! + t * (levels[i]! - levels[i - 1]!);
    },
  };
};

const point = (value: number): Continuous => ({
  min: value,
  max: value,
  mean: value,
  quantile: () => value,
  cdf: (x) => (x < value ? 0 : 1),
});

/** Beta(α, β) on [min, max]. */
const scaledBeta = (
  alpha: number,
  beta: number,
  min = 0,
  max = 1,
): Continuous =>
  max <= min
    ? point(min)
    : {
        min,
        max,
        mean: min + ((max - min) * alpha) / (alpha + beta),
        quantile: (u) => min + (max - min) * invBetaInc(u, alpha, beta),
        cdf: (x) => betaInc(alpha, beta, (x - min) / (max - min)),
      };

const triangular = (min: number, mode: number, max: number): Continuous => {
  if (max <= min) return point(min);
  const f = (mode - min) / (max - min);
  return {
    min,
    max,
    mean: (min + mode + max) / 3,
    quantile: (u) =>
      u < f
        ? min + Math.sqrt(u * (max - min) * (mode - min))
        : max - Math.sqrt((1 - u) * (max - min) * (max - mode)),
    cdf: (x) =>
      x <= min
        ? 0
        : x >= max
          ? 1
          : x <= mode
            ? (x - min) ** 2 / ((max - min) * (mode - min))
            : 1 - (max - x) ** 2 / ((max - min) * (max - mode)),
  };
};

/**
 * Where a quantile distribution's CDF reaches 0 and 1: its lowest and
 * highest values, widened by `overshoot` of their range on each side
 * (Cooke's intrinsic range, k = 10 % by default).
 */
export const intrinsicRange = (
  values: readonly number[],
  overshoot = 0.1,
): [number, number] => {
  const low = Math.min(...values);
  const high = Math.max(...values);
  const margin = (high - low) * overshoot;
  return [low - margin, high + margin];
};

/**
 * A distribution value as numbers. Its quantiles are at `levels` (each
 * quantile's cumulative probability, ascending: the model's `(.1, .5, .9)`),
 * between `range` (default: their own intrinsic range); a quantile list of
 * another length than the levels is an error.
 */
export const continuousOf = (
  distribution: Distribution,
  {
    levels = [0.1, 0.5, 0.9],
    range,
  }: { levels?: readonly number[]; range?: readonly [number, number] } = {},
): Continuous => {
  switch (distribution.kind) {
    case 'point':
      return point(distribution.value);
    case 'beta':
      return scaledBeta(distribution.alpha, distribution.beta);
    case 'uniform':
      return distribution.max <= distribution.min
        ? point(distribution.min)
        : piecewise([0, 1], [distribution.min, distribution.max]);
    case 'triangular':
      return triangular(distribution.min, distribution.mode, distribution.max);
    case 'pert': {
      const { min, mode, max } = distribution;
      if (max <= min) return point(min);
      return scaledBeta(
        1 + (4 * (mode - min)) / (max - min),
        1 + (4 * (max - mode)) / (max - min),
        min,
        max,
      );
    }
    case 'exponential': {
      const { mean } = distribution;
      return {
        min: 0,
        max: Infinity,
        mean,
        quantile: (u) => -mean * Math.log1p(-u),
        cdf: (x) => (x <= 0 ? 0 : -Math.expm1(-x / mean)),
      };
    }
    case 'normal': {
      const { mean, sd } = distribution;
      if (sd <= 0) return point(mean);
      return {
        min: -Infinity,
        max: Infinity,
        mean,
        quantile: (u) => mean + sd * normalQuantile(u),
        cdf: (x) => normalCdf((x - mean) / sd),
      };
    }
    case 'quantiles': {
      const { values } = distribution;
      if (values.length !== levels.length)
        throw new Error(
          `${values.length} quantiles, for ${levels.length} levels (${levels.join(', ')})`,
        );
      const [low, high] = range ?? intrinsicRange(values);
      return piecewise([0, ...levels, 1], [low, ...values, high]);
    }
  }
};

/** 1 − X: another continuous, mirrored (goal-controller#199, a leaf goal's 1 − ESR). */
export const complementOf = (c: Continuous): Continuous => ({
  min: 1 - c.max,
  max: 1 - c.min,
  mean: 1 - c.mean,
  quantile: (u) => 1 - c.quantile(1 - u),
  cdf: (x) => 1 - c.cdf(1 - x),
});

/**
 * The elicited (a0, m, b0) of a triangular distribution, extended by
 * distributing `tail` of the mass before a0 and after b0 (Garvey, ed.,
 * *Probability Methods for Cost Uncertainty Analysis*, 2000, as Sabetzadeh
 * et al. apply it, HASE'11 §III-B2, Figure 3; goal-controller#199): the min
 * `a` and max `b` of a new triangular(a, m, b) whose CDF reaches `tail` at
 * a0 and `1 - tail` at b0 (the mode m unchanged). Two quadratics, coupled
 * by (b − a): solved by 2D Newton's method (its Jacobian, by finite
 * differences), from a close initial guess.
 */
export const extendTriangular = (
  a0: number,
  m: number,
  b0: number,
  tail = 0.05,
): { min: number; max: number } => {
  if (!(a0 < b0))
    throw new Error(
      `extendTriangular: a0 < b0 is needed (not ${a0}, ${b0}): no range to extend`,
    );
  if (!(a0 <= m && m <= b0))
    throw new Error(
      `extendTriangular: a0 ≤ m ≤ b0 is needed (not ${a0} ≤ ${m} ≤ ${b0})`,
    );
  const f = (a: number, b: number) => (a0 - a) ** 2 - tail * (b - a) * (m - a);
  const g = (a: number, b: number) => (b - b0) ** 2 - tail * (b - a) * (b - m);
  // f and g each factor as (a0 − a)·[…] and (b0 − b)·[…]: a = a0 (b = b0)
  // is always a spurious root, degenerate exactly when m = a0 (m = b0), the
  // mode at an elicited bound. The initial guess is offset by the elicited
  // range (b0 − a0), not by (m − a0)/(b0 − m), which collapses to 0 there
  // and traps Newton on the spurious root.
  const range = b0 - a0;
  let a = a0 - range * 0.5;
  let b = b0 + range * 0.5;
  const h = 1e-7;
  for (let i = 0; i < 100; i++) {
    const fa = (f(a + h, b) - f(a - h, b)) / (2 * h);
    const fb = (f(a, b + h) - f(a, b - h)) / (2 * h);
    const ga = (g(a + h, b) - g(a - h, b)) / (2 * h);
    const gb = (g(a, b + h) - g(a, b - h)) / (2 * h);
    const det = fa * gb - fb * ga;
    if (!det) break;
    const fv = f(a, b);
    const gv = g(a, b);
    const da = (fv * gb - fb * gv) / det;
    const db = (fa * gv - fv * ga) / det;
    a -= da;
    b -= db;
    if (Math.abs(da) < 1e-14 && Math.abs(db) < 1e-14) break;
  }
  const tolerance = 1e-6 * Math.max(1, range);
  if (
    !(a < m && m < b) ||
    Math.abs(f(a, b)) > tolerance ||
    Math.abs(g(a, b)) > tolerance
  )
    throw new Error(
      `extendTriangular: no valid (a, b) found for (${a0}, ${m}, ${b0}), tail ${tail}`,
    );
  return { min: a, max: b };
};

/** A mixture of distributions, by weight (summing to 1): a decision maker's. */
export const mixture = (
  components: readonly { weight: number; distribution: Continuous }[],
): Continuous & { sample(random: Random): number } => {
  const used = components.filter((c) => c.weight > 0);
  const min = Math.min(...used.map((c) => c.distribution.min));
  const max = Math.max(...used.map((c) => c.distribution.max));
  const cdf = (x: number) =>
    used.reduce((sum, c) => sum + c.weight * c.distribution.cdf(x), 0);
  return {
    min,
    max,
    mean: used.reduce((sum, c) => sum + c.weight * c.distribution.mean, 0),
    cdf,
    quantile: (u) => {
      if (used.length === 1) return used[0]!.distribution.quantile(u);
      let low = min;
      let high = max;
      for (let i = 0; i < 100 && high - low > 1e-15; i++) {
        const mid = (low + high) / 2;
        if (cdf(mid) < u) low = mid;
        else high = mid;
      }
      return (low + high) / 2;
    },
    // a component by its weight, then a draw from it (two draws, as
    // KAOSTools' MixtureDistribution samples)
    sample: (random) => {
      const pick = random();
      let cumulative = 0;
      let chosen = used[used.length - 1]!;
      for (const c of used) {
        cumulative += c.weight;
        if (pick < cumulative) {
          chosen = c;
          break;
        }
      }
      return chosen.distribution.quantile(random());
    },
  };
};
