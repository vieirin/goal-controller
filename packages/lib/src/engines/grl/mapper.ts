/**
 * GRL's engine mapper: how goal-tree reads a GRL model for the workbench.
 * Entries by kind (goal-controller#215): iStar's plus Belief and Indicator.
 * GRL generates nothing (its analyses evaluate the model, ./evaluation), so
 * an element's, an actor's and a link's entries keep GRL properties as
 * written, and the evaluation graph reads them as the dialect does
 * (`viewValues`, goal-controller#187); a goal may be a leaf (a strategy
 * evaluates it).
 */
import {
  createEngineMapper,
  GoalTree,
  useIstarDefaultNaming,
  type ModelFor,
  type ModelOf,
} from '@goal-controller/goal-tree';
import { analysisViewOf, type AnalysisModel } from '../analysis';
import { grl } from './definition';

/**
 * the custom properties a GRL element keeps (#105: read, not yet declarable):
 * its dialect gives them no element kind, so the mapper is given none (it
 * maps an element's text); the workbench knows them
 */
export const GRL_ELEMENT_KEYS = [
  'importance',
  'importanceQuantitative',
  'decompositionType',
] as const;

type GrlProps = { text: string };

/** raw texts as written: what analysisViewOf keeps on a link or actor */
const asWritten = ({
  raw,
}: {
  raw: Readonly<Partial<Record<string, string | undefined>>>;
}) => raw;

export const grlEngineMapper = createEngineMapper({
  dialect: grl,
  naming: useIstarDefaultNaming({ leafGoals: 'allow' }),
  elements: (entry) => [
    entry({
      kinds: ['istar.Goal', 'istar.Quality'],
      mapProps: ({ text }) => ({ text }) satisfies GrlProps,
    }),
    entry({
      kind: 'istar.Task',
      mapProps: ({ text }) => ({ text }) satisfies GrlProps,
    }),
    entry({
      kind: 'grl.Belief',
      as: 'belief',
      mapProps: ({ text }) => ({ text }),
    }),
    entry({
      kind: 'grl.Indicator',
      as: 'indicator',
      mapProps: ({ text }) => ({ text }),
    }),
  ],
  ignore: ['istar.Resource'],
  mapActorProps: asWritten,
  links: (entry) => [
    entry({ kind: 'istar.ContributionLink', mapProps: asWritten }),
  ],
});

export type GrlGoalModel = ModelOf<typeof grlEngineMapper>;

/** A GRL model as its analyses read it: the view of its `KindModel`. */
export const grlAnalysisModel = <EK extends string, LK extends string>(
  model: ModelFor<typeof grl, EK, LK>,
): AnalysisModel => analysisViewOf(GoalTree.goalModel(model, grlEngineMapper));
