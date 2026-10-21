/**
 * Samples as a distribution (goal-controller#190; shared with the
 * quantitative round, goal-controller#193, D3): a Monte Carlo run's draws of
 * one quantity as the quantiles, mean and histogram an analysis value
 * carries (`AnalysisDistribution`).
 */
import type { AnalysisDistribution } from '../engines/analysis';

/** The quantile levels a sampled value's distribution is reported at. */
export const REPORTED_QUANTILES = [0.05, 0.25, 0.5, 0.75, 0.95];

/** A sample's quantile (the order statistic at ⌈p·n⌉, as the samples are sorted). */
export const quantileOf = (sorted: Float64Array, p: number) =>
  sorted[
    Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))
  ]!;

/** The samples as a distribution: quantiles, mean, a histogram of 20 bins over their range. */
export const distributionOfSamples = (
  samples: Float64Array,
): AnalysisDistribution => {
  const sorted = Float64Array.from(samples).sort();
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;
  const bins = 20;
  const shares = Array.from({ length: bins }, () => 0);
  for (const x of sorted) {
    const i =
      max > min
        ? Math.min(bins - 1, Math.floor(((x - min) / (max - min)) * bins))
        : 0;
    shares[i]! += 1 / sorted.length;
  }
  return {
    quantiles: REPORTED_QUANTILES.map((p) => ({
      p,
      value: quantileOf(sorted, p),
    })),
    mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    samples: sorted.length,
    histogram: { min, max, shares },
  };
};
