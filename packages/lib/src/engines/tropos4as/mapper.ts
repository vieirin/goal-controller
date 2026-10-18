/**
 * Tropos4AS's engine mapper: how goal-tree reads a Tropos4AS model (its
 * trees, the inspector's unread keys, and its `GoalModel`, goal-controller
 * #125). Entries by kind (goal-controller#215): iStar's plus Artifact,
 * Error, Failure and Symptom. The lifecycle reads the model as a graph
 * (`readTropos4asModel`) over that `GoalModel`'s view; a link's entry keeps
 * nothing (the dialect gives those kinds no properties).
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
import { tropos4as } from './definition';

type Tropos4asProps = { text: string };

export const tropos4asEngineMapper = createEngineMapper({
  dialect: tropos4as,
  // a goal without children is pursued as executed: the scenario gives its outcome
  naming: useIstarDefaultNaming({ leafGoals: 'allow' }),
  elements: (entry) => [
    entry({
      kinds: ['istar.Goal', 'istar.Quality'],
      mapProps: ({ text }) => ({ text }) satisfies Tropos4asProps,
    }),
    entry({
      kind: 'istar.Task',
      mapProps: ({ text }) => ({ text }) satisfies Tropos4asProps,
    }),
    entry({
      kind: 'tropos4as.Artifact',
      as: 'artifact',
      mapProps: ({ text }) => ({ text }),
    }),
    entry({
      kind: 'tropos4as.Error',
      as: 'error',
      mapProps: ({ text }) => ({ text }),
    }),
    entry({
      kind: 'tropos4as.Failure',
      as: 'failure',
      mapProps: ({ text }) => ({ text }),
    }),
    entry({
      kind: 'tropos4as.Symptom',
      as: 'symptom',
      mapProps: ({ text }) => ({ text }),
    }),
  ],
  ignore: ['istar.Resource'],
  links: (entry) => [
    entry({
      kinds: [
        'istar.AndRefinementLink',
        'istar.OrRefinementLink',
        'istar.ContributionLink',
        'istar.DependencyLink',
        'tropos4as.InhibitsLink',
        'tropos4as.SequenceLink',
        'tropos4as.FailureLink',
        'tropos4as.ErrorLink',
        'tropos4as.ReadsLink',
        'tropos4as.SymptomLink',
      ],
      mapProps: () => ({}),
    }),
  ],
});

export type Tropos4asGoalModel = ModelOf<typeof tropos4asEngineMapper>;

/**
 * A Tropos4AS model as the lifecycle and the checks read it: the view of
 * its `GoalModel`, with the extension's kinds (parsed with its metamodel
 * block).
 */
export const tropos4asAnalysisModel = (
  model: IStarModel | IstarModel<string, string>,
): AnalysisModel =>
  analysisViewOf(
    GoalTree.goalModel(model as IStarModel, tropos4asEngineMapper),
  );
