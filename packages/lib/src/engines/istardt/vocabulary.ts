/**
 * iStar-DT's words, as the translator `dtx2dtg` (cmg-york/istardt at
 * `649c9be`) writes them: the kinds a model has, how an element is named in
 * DT-Golog, and how a number is printed.
 */

/** The kinds the `istardt` extension adds (goal-controller#117 D1, D7). */
export const ISTARDT_KINDS = {
  effect: 'istardt.Effect',
  /** a task's effects, as one node (its hub) */
  effectGroup: 'istardt.EffectGroup',
  condition: 'istardt.Condition',
  predicate: 'istardt.Predicate',
  variable: 'istardt.Variable',
} as const;

/** The link kinds the `istardt` extension adds. */
export const ISTARDT_LINKS = {
  /** a task to its effect group (`eff`) */
  effect: 'istardt.EffectLink',
  /** an effect group to one of its effects, with its probability (in link order) */
  effectGroup: 'istardt.EffectGroupLink',
  /** a condition, goal or task to the goal, task or effect it precedes */
  precedence: 'istardt.PrecedenceLink',
  /** a condition, goal or task to the goal, task or effect it must not precede */
  negativePrecedence: 'istardt.NegativePrecedenceLink',
  /**
   * an effect or a quality to a quality, with a weight (an extension of
   * contribution): a term of the quality's weighted sum (mx2dtx's
   * `contributionLink`)
   */
  utility: 'istardt.UtilityLink',
  /** an effect to a predicate it makes true (in link order) */
  turnsTrue: 'istardt.TurnsTrueLink',
  /** an effect to a predicate it makes false */
  turnsFalse: 'istardt.TurnsFalseLink',
  /**
   * an element a quality's or a condition's formula names, to it (the
   * paper's arrows); drawn from the formula, which stays the source
   */
  reads: 'istardt.ReadsLink',
  /** the same, read through `previous(x)` (the paper's PRE) */
  readsPrevious: 'istardt.ReadsPreviousLink',
} as const;

/** What an element is to the writer, by its piStar kind. */
export type IstardtKind =
  | 'goal'
  | 'task'
  | 'quality'
  | 'effect'
  | 'condition'
  | 'predicate'
  | 'variable';

export const KIND_OF_PISTAR: Readonly<Record<string, IstardtKind>> = {
  'istar.Goal': 'goal',
  'istar.Task': 'task',
  'istar.Quality': 'quality',
  [ISTARDT_KINDS.effect]: 'effect',
  [ISTARDT_KINDS.condition]: 'condition',
  [ISTARDT_KINDS.predicate]: 'predicate',
  [ISTARDT_KINDS.variable]: 'variable',
};

export const PISTAR_OF_KIND: Readonly<Record<IstardtKind, string>> = {
  goal: 'istar.Goal',
  task: 'istar.Task',
  quality: 'istar.Quality',
  effect: ISTARDT_KINDS.effect,
  condition: ISTARDT_KINDS.condition,
  predicate: ISTARDT_KINDS.predicate,
  variable: ISTARDT_KINDS.variable,
};

/**
 * The id prefix each kind's elements are numbered with (#117 D1): `G` and
 * `T` are the goal language's, the others are text on kinds its lines don't
 * list.
 */
export const ID_PREFIX: Readonly<Record<IstardtKind, string>> = {
  goal: 'G',
  task: 'T',
  quality: 'Q',
  effect: 'E',
  condition: 'C',
  predicate: 'P',
  variable: 'V',
};

/**
 * `Formatter.toCamelCase`: the words of a name (runs of letters and
 * digits), the first one's first letter lowered, the others' raised.
 */
export const camelCase = (input: string): string => {
  const parts = input.split(/[^a-zA-Z0-9]+/);
  let out = '';
  parts.forEach((part, i) => {
    if (!part) return;
    out +=
      i === 0
        ? part[0]!.toLowerCase() + part.slice(1)
        : part[0]!.toUpperCase() + part.slice(1);
  });
  return out && out[0]!.toLowerCase() + out.slice(1);
};

/** The shortest decimal digits that read back as the same 32-bit float. */
const floatDigits = (value: number): { digits: string; exponent: number } => {
  const f = Math.fround(value);
  for (let precision = 1; precision <= 9; precision++) {
    const text = Math.abs(f).toExponential(precision - 1);
    if (Math.fround(Number(text) * Math.sign(f)) === f) {
      const [mantissa, exponent] = text.split('e');
      return {
        digits: mantissa!.replace('.', ''),
        exponent: Number(exponent),
      };
    }
  }
  const [mantissa, exponent] = Math.abs(f).toExponential(8).split('e');
  return { digits: mantissa!.replace('.', ''), exponent: Number(exponent) };
};

/**
 * Java's `Float.toString` (the translator's numbers are floats): at least
 * one digit after the point (`23.0`), plain between 10⁻³ and 10⁷,
 * `1.0E7` beyond.
 */
export const javaFloat = (value: number): string => {
  const f = Math.fround(value);
  if (Number.isNaN(f)) return 'NaN';
  if (!Number.isFinite(f)) return f > 0 ? 'Infinity' : '-Infinity';
  if (f === 0) return Object.is(f, -0) ? '-0.0' : '0.0';
  const sign = f < 0 ? '-' : '';
  const { digits, exponent } = floatDigits(f);
  const magnitude = Math.abs(f);
  if (magnitude >= 1e-3 && magnitude < 1e7) {
    if (exponent >= 0) {
      const whole = digits.slice(0, exponent + 1).padEnd(exponent + 1, '0');
      const fraction = digits.slice(exponent + 1) || '0';
      return `${sign}${whole}.${fraction}`;
    }
    return `${sign}0.${'0'.repeat(-exponent - 1)}${digits}`;
  }
  return `${sign}${digits[0]}.${digits.slice(1) || '0'}E${exponent}`;
};
