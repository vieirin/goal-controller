/**
 * Tropos4AS's engine mapper: how goal-tree reads a Tropos4AS model (its
 * trees, the inspector's unread keys, and its `GoalModel`, goal-controller
 * #125). The lifecycle reads the model as a graph (`readTropos4asModel`)
 * over that `GoalModel`'s view, so the mapper keeps the properties as
 * written.
 */
import {
  createEngineMapper,
  GoalTree,
  type IStarModel,
} from '@goal-controller/goal-tree';
import type { IstarModel } from '@istar-ts/core';
import { analysisViewOf, type AnalysisModel } from '../analysis';
import { tropos4as } from './definition';

type Tropos4asProps = { text: string };

export const tropos4asEngineMapper = createEngineMapper<
  Tropos4asProps,
  Tropos4asProps,
  never
>()({
  dialect: tropos4as,
  skipResource: true,
  // a goal without children is pursued as executed: the scenario gives its outcome
  allowLeafGoals: true,
  mapGoalProps: ({ text }) => ({ text }),
  mapTaskProps: ({ text }) => ({ text }),
});

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
