/**
 * GRL's analyses (goal-controller#106, on #107's analysis engines):
 * jUCMNav's quantitative and qualitative evaluations of every strategy in
 * the `strategies` resource, a value and a label per element and actor. The
 * other six of jUCMNav's algorithms (mixed, formula-based, conditional,
 * constraint solver, feature model, timed) are not ported.
 */
import type { AnalysisModel, AnalysisResult } from '../../analysis';
import {
  DEFAULT_PREFERENCES,
  readStrategies,
  type GrlPreferences,
  type GrlStrategy,
} from '../strategies';
import type { GrlQualitativeLabel } from '../vocabulary';
import { grlGraph, type GrlGraph } from './graph';
import { labelOf, propagate } from './propagation';
import {
  qualitativeActorEvaluation,
  qualitativeEvaluation,
} from './qualitative';
import {
  quantitativeActorEvaluation,
  quantitativeEvaluation,
} from './quantitative';

export type GrlAlgorithm = 'quantitative' | 'qualitative';

/** A strategy's values: each element's and actor's number and label. */
export type GrlEvaluation = {
  elements: Map<string, { value: number; label: GrlQualitativeLabel | null }>;
  actors: Map<string, { value: number; label: GrlQualitativeLabel | null }>;
};

/** A strategy evaluated: the initial values it sets, propagated as jUCMNav does. */
export const evaluateStrategy = (
  graph: GrlGraph,
  strategy: Pick<GrlStrategy, 'evaluations'>,
  algorithm: GrlAlgorithm,
  preferences: GrlPreferences = DEFAULT_PREFERENCES,
): GrlEvaluation => {
  const evaluations = propagate(
    graph,
    strategy.evaluations,
    preferences,
    algorithm === 'quantitative'
      ? quantitativeEvaluation(graph, preferences)
      : qualitativeEvaluation(graph),
  );
  const elements = new Map(
    graph.elements.map((element) => {
      const { value } = evaluations.get(element.id)!;
      return [element.id, { value, label: labelOf(value, preferences.range) }];
    }),
  );
  const actors = new Map(
    graph.actors.map((actor) => {
      const value =
        algorithm === 'quantitative'
          ? quantitativeActorEvaluation(graph, actor.id, evaluations)
          : qualitativeActorEvaluation(
              graph,
              actor.id,
              evaluations,
              preferences.range,
            );
      return [actor.id, { value, label: labelOf(value, preferences.range) }];
    }),
  );
  return { elements, actors };
};

/** The words a label is shown with. */
const LABEL_TEXT: Readonly<Record<GrlQualitativeLabel, string>> = {
  Denied: 'Denied',
  WeaklyDenied: 'Weakly denied',
  WeaklySatisfied: 'Weakly satisfied',
  Satisfied: 'Satisfied',
  Conflict: 'Conflict',
  Unknown: 'Unknown',
  None: 'None',
};

/** Every strategy of the resource evaluated: one case each (none: a case with no strategy). */
const analyse =
  (algorithm: GrlAlgorithm) =>
  (
    model: AnalysisModel,
    resource: Readonly<Record<string, string>> = {},
  ): AnalysisResult => {
    const graph = grlGraph(model);
    const { strategies } = readStrategies(
      Object.entries(resource).map(([path, text]) => ({ path, text })),
    );
    const known = new Set(graph.elements.map((e) => e.id));
    const cases = (
      strategies.length
        ? strategies
        : [
            {
              id: '',
              name: 'No strategy',
              group: '',
              path: '',
              preferences: DEFAULT_PREFERENCES,
              evaluations: new Map(),
            } satisfies GrlStrategy,
          ]
    ).map((strategy) => {
      const { elements, actors } = evaluateStrategy(
        graph,
        strategy,
        algorithm,
        strategy.preferences,
      );
      // an evaluation of an element the model doesn't have: said in the case, nothing to draw it on
      const unknown = [...strategy.evaluations.keys()].filter(
        (id) => !known.has(id),
      );
      const show = ({
        value,
        label,
      }: {
        value: number;
        label: GrlQualitativeLabel | null;
      }) =>
        algorithm === 'quantitative'
          ? {
              value,
              ...(label && { label: `${value} (${LABEL_TEXT[label]})` }),
            }
          : {
              value: label ?? value,
              ...(label && { label: LABEL_TEXT[label] }),
            };
      return {
        id: strategy.id,
        label: `${strategy.name}${
          unknown.length
            ? ` (evaluates ${unknown.join(', ')}, which the model doesn't have)`
            : ''
        }`,
        values: Object.fromEntries([
          ...[...elements].map(([id, value]) => [id, show(value)]),
          ...[...actors].map(([id, value]) => [id, show(value)]),
        ]),
      };
    });
    return { cases };
  };

export const runQuantitative = analyse('quantitative');
export const runQualitative = analyse('qualitative');

export { grlGraph, type GrlGraph } from './graph';
export { kpiEvaluation, labelOf } from './propagation';
