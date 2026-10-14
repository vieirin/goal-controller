/**
 * What jUCMNav's algorithms share (`PropagationGRLStrategyAlgorithm`,
 * `EvaluationStrategyManager`): a strategy's initial evaluations (an
 * indicator's from its KPI value set), the order elements are evaluated in,
 * and the qualitative label of a value. Integer arithmetic is Java's: a
 * division truncates toward zero, a double cast to int saturates.
 */
import type { GrlStrategyEvaluation, GrlPreferences } from '../strategies';
import type { GrlQualitativeLabel } from '../vocabulary';
import type { GrlGraph, GrlNode } from './graph';

/** IGRLStrategyAlgorithm's values */
export const SATISFIED = 100;
export const WEAKLY_SATISFIED = 50;
export const NONE = 0;
export const WEAKLY_DENIED = -50;
export const DENIED = -100;
export const CONFLICT = -101;
export const UNDECIDED = -102;

/** Java's `a / b` on ints: truncates toward zero. */
export const javaDivide = (a: number, b: number): number => Math.trunc(a / b);

/** Java's `(int) d`: NaN is 0, out of range saturates, the rest truncates. */
export const javaInt = (d: number): number => {
  if (Number.isNaN(d)) return 0;
  if (d >= 2147483647) return 2147483647;
  if (d <= -2147483648) return -2147483648;
  return Math.trunc(d);
};

/** Java's `Math.round(double)` as an int: half up. */
export const javaRound = (d: number): number => javaInt(Math.floor(d + 0.5));

/** An element's evaluation while a strategy is evaluated (jUCMNav's `Evaluation`). */
export type Evaluation = {
  value: number;
  label: GrlQualitativeLabel;
  /** the strategy sets it (`getIntElement() != null`) */
  userDefined: boolean;
};

/**
 * `getQualitativeEvaluationForQuantitativeValue`: a value's label, the
 * value read in −100..100 when the model's range is 0..100; none for a value
 * no label has (above 100, say).
 */
export const labelOf = (
  value: number,
  range: GrlPreferences['range'],
): GrlQualitativeLabel | null => {
  const full =
    range === 'positive' && value !== CONFLICT && value !== UNDECIDED
      ? value * 2 - 100
      : value;
  if (full === SATISFIED) return 'Satisfied';
  if (full > NONE && full < SATISFIED) return 'WeaklySatisfied';
  if (full > DENIED && full < NONE) return 'WeaklyDenied';
  if (full === DENIED) return 'Denied';
  if (full === NONE) return 'None';
  if (full === CONFLICT) return 'Conflict';
  if (full === UNDECIDED) return 'Unknown';
  return null;
};

/** `getEquivalentValueIn0To100RangeIfApplicable`: a −100..100 value in 0..100. */
export const toPositiveRange = (value: number): number =>
  value === CONFLICT || value === UNDECIDED
    ? value
    : javaRound((value + 100) / 2);

const kpiNumber = (
  kpi: Readonly<Record<string, string | number>>,
  key: string,
): number => {
  const value = Number(kpi[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
};

/**
 * `calculateIndicatorEvalLevel`: an indicator's value from its KPI value set
 * (target, threshold, worst, and the measured `evaluationValue`), read when
 * the set says anything (`setStrategy`).
 */
export const kpiEvaluation = (
  kpi: Readonly<Record<string, string | number>>,
  range: GrlPreferences['range'],
): number | null => {
  const target = kpiNumber(kpi, 'targetValue');
  const threshold = kpiNumber(kpi, 'thresholdValue');
  const worst = kpiNumber(kpi, 'worstValue');
  const value = kpiNumber(kpi, 'evaluationValue');
  const unit = String(kpi.unit ?? '');
  if (!target && !threshold && !worst && !value && !unit) return null;
  let level: number;
  if (target < worst) {
    if (value <= target) level = 100;
    else if (value >= worst) level = -100;
    else if (value < threshold)
      level =
        (Math.abs(value - threshold) / Math.abs(target - threshold)) * 100;
    else
      level =
        (Math.abs(value - threshold) / Math.abs(threshold - worst)) * -100;
  } else if (value >= target) level = 100;
  else if (value <= worst) level = -100;
  else if (value >= threshold)
    level = (Math.abs(value - threshold) / Math.abs(target - threshold)) * 100;
  else
    level = (Math.abs(value - threshold) / Math.abs(threshold - worst)) * -100;
  if (range === 'positive') level = level / 2 + 50;
  return javaInt(level);
};

/**
 * Every element's evaluation under a strategy: `algorithm` evaluates an
 * element once its links' sources are (jUCMNav's order: the leaves first,
 * then the elements the strategy sets, each element as soon as it is
 * covered); an element in a cycle is never reached and keeps its initial
 * evaluation. Each value's label is synced (`syncIntentionalElementQualitativeEvaluation`).
 */
export const propagate = (
  graph: GrlGraph,
  initial: ReadonlyMap<string, GrlStrategyEvaluation>,
  preferences: GrlPreferences,
  algorithm: (
    element: GrlNode,
    evaluations: ReadonlyMap<string, Evaluation>,
  ) => number,
): Map<string, Evaluation> => {
  const evaluations = new Map<string, Evaluation>();
  for (const element of graph.elements) {
    const set = initial.get(element.id);
    const fromKpi = set?.kpi ? kpiEvaluation(set.kpi, preferences.range) : null;
    evaluations.set(
      element.id,
      set
        ? {
            value: fromKpi ?? set.value,
            label: set.label,
            userDefined: true,
          }
        : { value: 0, label: 'None', userDefined: false },
    );
  }
  const ready: GrlNode[] = [];
  const userDefined: GrlNode[] = [];
  const waiting = new Map<
    string,
    { node: GrlNode; total: number; covered: number }
  >();
  for (const element of graph.elements) {
    const incoming = graph.incoming.get(element.id) ?? [];
    if (!incoming.length) ready.push(element);
    else if (evaluations.get(element.id)!.userDefined)
      userDefined.push(element);
    else
      waiting.set(element.id, {
        node: element,
        total: incoming.length,
        covered: 0,
      });
  }
  ready.push(...userDefined);
  while (ready.length) {
    const element = ready.shift()!;
    for (const edge of graph.outgoing.get(element.id) ?? []) {
      const calculation = waiting.get(edge.dest);
      if (!calculation) continue;
      calculation.covered++;
      if (calculation.covered === calculation.total) {
        waiting.delete(edge.dest);
        ready.unshift(calculation.node);
      }
    }
    const evaluation = evaluations.get(element.id)!;
    evaluation.value = algorithm(element, evaluations);
    // a value no label has sets none, which EMF's setter makes the default
    evaluation.label = labelOf(evaluation.value, preferences.range) ?? 'None';
  }
  return evaluations;
};
