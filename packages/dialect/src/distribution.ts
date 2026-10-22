/**
 * A `distribution` value (goal-controller#190): a probability distribution
 * written as text, in the forms RE'15's tooling writes (frameworks.md,
 * "Step 3 part A"), kept as written. Generic: no engine's, any dialect may
 * type a key with it (an obstacle's estimate, a quantity's uncertainty).
 *
 * - `beta[α, β]`: Beta(α, β), shapes > 0;
 * - `uniform[min, max]`;
 * - `triangular[min, mode, max]`, `pert[min, mode, max]` (`PERT`);
 * - `quantile[q1, …, qn]` (`quantiles`), or a tuple `(q1, …, qn)` (ADS's
 *   form): values at quantile levels the reader of the value knows (a
 *   model's `@experts.quantiles`, `(.1, .5, .9)` by default);
 * - over the reals only (goal-controller#193): `exponential[mean]`, its
 *   mean (> 0), as Heaven and Letier's `Exp(60)` (RE'11, Matlab's
 *   `exprnd(mu)`: "mean varies from 60 seconds to 30 seconds"), not a rate;
 *   `normal[μ, σ]` (σ ≥ 0), RE'11's `Normal(0, 120)`; `normalci[a, b]`
 *   (a ≤ b), a normal whose 90 % confidence interval is [a, b], as RADAR's
 *   `normalCI(a, b)` (Busari and Letier, ICSE'17): mean (a + b)/2, σ (b −
 *   a)/3.29, RADAR's constant;
 * - where the config allows one (`point`), a single value: the degenerate
 *   distribution.
 *
 * Over probabilities (the default `range`), every parameter but Beta's
 * shapes is a probability: a decimal or a percentage (`2.4%`), in [0, 1].
 * Over the reals, any decimal, negative ones too. Quantiles never decrease;
 * min ≤ mode ≤ max.
 */

/** What a distribution's values range over: probabilities, in [0, 1], or the reals. */
export type DistributionRange = 'probability' | 'real';

/** A distribution read: its kind, its parameters as numbers, and how it was written. */
export type Distribution =
  | { kind: 'point'; value: number }
  | {
      kind: 'quantiles';
      values: readonly number[];
      /** `(a, b, c)`, `quantile[a, b, c]` or `quantiles[a, b, c]` */
      form: 'tuple' | 'quantile' | 'quantiles';
    }
  | { kind: 'beta'; alpha: number; beta: number }
  | { kind: 'uniform'; min: number; max: number }
  | { kind: 'triangular' | 'pert'; min: number; mode: number; max: number }
  | { kind: 'exponential'; mean: number }
  | { kind: 'normal'; mean: number; sd: number }
  | { kind: 'normalci'; lower: number; upper: number };

export type DistributionKind = Distribution['kind'];

export const DISTRIBUTION_KINDS: readonly DistributionKind[] = [
  'point',
  'quantiles',
  'beta',
  'uniform',
  'triangular',
  'pert',
  'exponential',
  'normal',
  'normalci',
];

/** How many parameters each named form takes (none: any number, at least one). */
const ARITY: Readonly<Record<string, number | undefined>> = {
  beta: 2,
  uniform: 2,
  triangular: 3,
  pert: 3,
  exponential: 1,
  normal: 2,
  normalci: 2,
  quantile: undefined,
  quantiles: undefined,
};

const NUMBER =
  /^\s*(-?)([0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:e(-?[0-9]+))?\s*(%?)\s*$/i;

/** A number as written: a decimal, a percentage (`80%`), with an exponent (`1e-3`); null when it is none. */
export const numberOf = (text: string): number | null => {
  const read = NUMBER.exec(text);
  if (!read) return null;
  const value =
    (read[1] ? -1 : 1) *
    Number(read[2]) *
    10 ** Number(read[3] ?? 0) *
    (read[4] ? 0.01 : 1);
  return Number.isFinite(value) ? value : null;
};

/** A distribution's text read, or why it isn't one. */
export const readDistribution = (
  text: string,
  { point = false, range = 'probability' }: DistributionOptions = {},
): { distribution: Distribution } | { error: string } => {
  const written = text.trim();
  const fail = (error: string) => ({ error });
  const probability = (n: number) => range === 'real' || (n >= 0 && n <= 1);
  const outside = range === 'probability' ? ' in [0, 1]' : '';
  const single = numberOf(written);
  if (single !== null) {
    if (!point) return fail(`A distribution, not the single value ${written}`);
    return probability(single)
      ? { distribution: { kind: 'point', value: single } }
      : fail(`A probability in [0, 1], not ${written}`);
  }
  const named = /^([A-Za-z]+)\s*\[(.*)\]$/s.exec(written);
  const tuple = /^\((.*)\)$/s.exec(written);
  if (!named && !tuple)
    return fail(
      `A distribution (beta[α, β], uniform[min, max], triangular[min, mode, max], pert[min, mode, max], ${range === 'real' ? 'exponential[mean], normal[μ, σ], normalci[a, b], ' : ''}quantile[…] or (q1, …, qn)${point ? ', or a value' : ''}), not ${written}`,
    );
  const name = named ? named[1]!.toLowerCase() : 'quantiles';
  if (named && !(name in ARITY))
    return fail(
      `No distribution ${named[1]}: beta, uniform, triangular, pert${range === 'real' ? ', exponential, normal, normalci' : ''} or quantile`,
    );
  if (
    (name === 'exponential' || name === 'normal' || name === 'normalci') &&
    range !== 'real'
  )
    return fail(`${name}[…] ranges over the reals, not over probabilities`);
  const parts = (named ? named[2]! : tuple![1]!).split(',');
  const numbers: number[] = [];
  for (const part of parts) {
    const n = numberOf(part);
    if (n === null) return fail(`${part.trim() || 'Nothing'} is not a number`);
    numbers.push(n);
  }
  const arity = ARITY[name];
  if (arity !== undefined && numbers.length !== arity)
    return fail(`${name}[…] takes ${arity} parameters, not ${numbers.length}`);
  if (name === 'beta') {
    const [alpha, beta] = numbers as [number, number];
    return alpha > 0 && beta > 0
      ? { distribution: { kind: 'beta', alpha, beta } }
      : fail(`beta[α, β]: both shapes above 0, not ${alpha} and ${beta}`);
  }
  if (name === 'exponential') {
    const [mean] = numbers as [number];
    return mean > 0
      ? { distribution: { kind: 'exponential', mean } }
      : fail(`exponential[mean]: a mean above 0, not ${mean}`);
  }
  if (name === 'normal') {
    const [mean, sd] = numbers as [number, number];
    return sd >= 0
      ? { distribution: { kind: 'normal', mean, sd } }
      : fail(`normal[μ, σ]: σ at least 0, not ${sd}`);
  }
  if (name === 'normalci') {
    const [lower, upper] = numbers as [number, number];
    return lower <= upper
      ? { distribution: { kind: 'normalci', lower, upper } }
      : fail(`normalci[a, b]: ${lower} is above ${upper}`);
  }
  const off = numbers.find((n) => !probability(n));
  if (off !== undefined) return fail(`${off} is not a probability${outside}`);
  if (name === 'uniform') {
    const [min, max] = numbers as [number, number];
    return min <= max
      ? { distribution: { kind: 'uniform', min, max } }
      : fail(`uniform[min, max]: ${min} is above ${max}`);
  }
  if (name === 'triangular' || name === 'pert') {
    const [min, mode, max] = numbers as [number, number, number];
    return min <= mode && mode <= max
      ? { distribution: { kind: name, min, mode, max } }
      : fail(
          `${name}[min, mode, max]: min ≤ mode ≤ max, not ${numbers.join(', ')}`,
        );
  }
  const falling = numbers.findIndex((n, i) => i > 0 && n < numbers[i - 1]!);
  if (falling > 0)
    return fail(
      `Quantiles don't decrease: ${numbers[falling]} after ${numbers[falling - 1]}`,
    );
  return {
    distribution: {
      kind: 'quantiles',
      values: numbers,
      form: tuple ? 'tuple' : (name as 'quantile' | 'quantiles'),
    },
  };
};

/** What a `distribution` value allows: a single value (`point`), and what it ranges over. */
export type DistributionOptions = {
  point?: boolean;
  range?: DistributionRange;
};

/** A distribution's text as one, or null when it isn't (`readDistribution` says why). */
export const distributionOf = (
  text: string,
  options?: DistributionOptions,
): Distribution | null => {
  const read = readDistribution(text, options);
  return 'distribution' in read ? read.distribution : null;
};
