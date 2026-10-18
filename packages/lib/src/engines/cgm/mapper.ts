/**
 * The contextual goal models' engine mapper: how goal-tree reads a model
 * (its trees, the inspector's unread keys, and its `GoalModel`,
 * goal-controller#125). Entries by kind (goal-controller#215): iStar's
 * plus the extension's Context, Fact and Statement. The analyses read the
 * model as a graph, the view of that `GoalModel`, so a link's entry keeps
 * its properties as written (its `context`, `opposite`, `amount`); the
 * analyses read the view's elements and links as the dialect does
 * (./values, goal-controller#187).
 */
import {
  createEngineMapper,
  GoalTree,
  useIstarDefaultNaming,
  type IStarModel,
  type ModelOf,
} from '@goal-controller/goal-tree';
import type { IstarModel } from '@istar-ts/core';
import { analysisViewOf, type AnalysisModel } from '../analysis';
import { cgm } from './definition';

type CgmProps = { text: string };

/** raw texts as written: what analysisViewOf keeps on a link or actor */
const asWritten = ({
  raw,
}: {
  raw: Readonly<Partial<Record<string, string | undefined>>>;
}) => raw;

export const cgmEngineMapper = createEngineMapper({
  dialect: cgm,
  naming: useIstarDefaultNaming({ leafGoals: 'allow' }),
  elements: (entry) => [
    entry({
      kinds: ['istar.Goal', 'istar.Quality'],
      mapProps: ({ text }) => ({ text }) satisfies CgmProps,
    }),
    entry({
      kind: 'istar.Task',
      mapProps: ({ text }) => ({ text }) satisfies CgmProps,
    }),
    entry({
      kind: 'cgm.Context',
      as: 'context',
      mapProps: ({ text }) => ({ text }),
    }),
    entry({ kind: 'cgm.Fact', as: 'fact', mapProps: ({ text }) => ({ text }) }),
    entry({
      kind: 'cgm.Statement',
      as: 'statement',
      mapProps: ({ text }) => ({ text }),
    }),
  ],
  ignore: ['istar.Resource'],
  links: (entry) => [
    entry({
      kinds: [
        'istar.AndRefinementLink',
        'istar.OrRefinementLink',
        'istar.DependencyLink',
        'istar.ContributionLink',
        'cgm.IncludesLink',
        'cgm.IntersectsLink',
      ],
      mapProps: asWritten,
    }),
  ],
});

export type CgmGoalModel = ModelOf<typeof cgmEngineMapper>;

/** A contextual goal model as its analyses read it: the view of its `GoalModel`, its extension's kinds too. */
export const cgmAnalysisModel = (
  model: IStarModel | IstarModel<string, string>,
): AnalysisModel =>
  analysisViewOf(GoalTree.goalModel(model as IStarModel, cgmEngineMapper));
