/**
 * jUCMNav's quantitative GRL evaluation (`QuantitativeGRLStrategyAlgorithm`,
 * `StrategyAlgorithmImplementationHelper.defaultActorEvaluation`), as it
 * computes: an AND decomposition is its children's minimum, an OR or XOR
 * one their maximum; contributions add `quantitativeContribution × source /
 * 100` (Java's integer division), saturated at 100 and at the range's bottom,
 * then held `tolerance` short of either end unless a contribution reaches it;
 * a dependency caps the element at its dependees' minimum; an actor is its
 * elements' importance-weighted mean. Not ported: the ST_Legal stereotype
 * and aggregate contributions (metadata), contribution contexts.
 */
import type { GrlPreferences } from '../strategies';
import type { GrlGraph, GrlNode } from './graph';
import { javaDivide, javaRound, type Evaluation } from './propagation';

export type QuantitativeOptions = Pick<GrlPreferences, 'range' | 'tolerance'>;

/** the range's bottom: −100, or 0 in the 0..100 range */
const minRangeOf = (range: GrlPreferences['range']) =>
  range === 'positive' ? 0 : -100;

/** An element's value, its sources evaluated (`getEvaluation`). */
export const quantitativeEvaluation =
  (graph: GrlGraph, { range, tolerance }: QuantitativeOptions) =>
  (element: GrlNode, evaluations: ReadonlyMap<string, Evaluation>): number => {
    const own = evaluations.get(element.id)!;
    const incoming = graph.incoming.get(element.id) ?? [];
    // preGetEvaluation: a leaf, or an element the strategy sets
    if (!incoming.length || own.userDefined) return own.value;
    const minRange = minRangeOf(range);
    const valueOf = (id: string) => evaluations.get(id)?.value ?? 0;
    let decomposition = -10000;
    let dependency = 10000;
    const contributions: number[] = [];
    for (const edge of incoming) {
      if (edge.kind === 'decomposition') {
        const source = valueOf(edge.src);
        if (element.decompositionType === 'And') {
          // the first child's value, then the minimum
          decomposition =
            decomposition < minRange ? source : Math.min(decomposition, source);
        } else if (decomposition < minRange || decomposition < source)
          decomposition = source;
      } else if (edge.kind === 'dependency')
        dependency = Math.min(dependency, valueOf(edge.src));
      else {
        // computeContributionResult: an int product divided as ints, then rounded
        const result = javaRound(
          javaDivide(edge.quantitative * valueOf(edge.src), 100),
        );
        if (result !== 0) contributions.push(result);
      }
    }
    // ensureEvaluationWithinRange
    let result = 0;
    if (decomposition >= minRange) result = decomposition;
    if (contributions.length) {
      let hasSatisfy = result === 100;
      let hasDeny = result === minRange;
      let contribution = 0;
      for (const value of contributions) {
        if (value === 100) hasSatisfy = true;
        if (value === minRange) hasDeny = true;
        contribution += value;
      }
      result += contribution;
      if (result > 100) result = 100;
      else if (result < minRange) result = minRange;
      if (result >= 100 - tolerance && !hasSatisfy)
        result =
          contribution > 0
            ? Math.max(decomposition, 100 - tolerance)
            : Math.max(result, 100 - tolerance);
      else if (result <= minRange + tolerance && !hasDeny)
        // there might be no decomposition (its value still −10000)
        result =
          contribution < 0 && decomposition > 100 * minRange
            ? Math.min(decomposition, minRange + tolerance)
            : Math.min(result, minRange + tolerance);
    }
    if (dependency <= 100 && result > dependency) result = dependency;
    return result;
  };

/**
 * An actor's value: its elements' values weighted by their importance
 * (those of importance 0 left out), as Java's integer mean; 0 when none
 * has an importance.
 */
export const quantitativeActorEvaluation = (
  graph: GrlGraph,
  actorId: string,
  evaluations: ReadonlyMap<string, Evaluation>,
): number => {
  const actor = graph.actors.find((a) => a.id === actorId);
  if (!actor) return 0;
  const byId = new Map(graph.elements.map((e) => [e.id, e]));
  let sumEvaluation = 0;
  let sumImportance = 0;
  for (const id of actor.elements) {
    const importance = byId.get(id)?.importanceQuantitative ?? 0;
    if (importance === 0) continue;
    sumEvaluation += (evaluations.get(id)?.value ?? 0) * importance;
    sumImportance += importance;
  }
  return sumImportance > 0 ? javaDivide(sumEvaluation, sumImportance) : 0;
};
