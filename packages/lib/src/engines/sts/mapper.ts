/**
 * STS-ml's engine mapper: how goal-tree reads an STS-ml model (its trees,
 * the inspector's unread keys, and its `GoalModel`, goal-controller#125).
 * The checks and the analyses read the model as a graph, the view of that
 * `GoalModel`, so the mapper keeps every property as written: a link's
 * security needs and authorisation, an actor's description.
 */
import { linkPropertyKeys, propertyKeys } from '@goal-controller/dialect';
import {
  createEngineMapper,
  GoalTree,
  type IStarModel,
} from '@goal-controller/goal-tree';
import type { IstarModel } from '@istar-ts/core';
import { analysisViewOf, type AnalysisModel } from '../analysis';
import { sts } from './definition';

type StsProps = { text: string };

export const stsEngineMapper = createEngineMapper<StsProps, StsProps, never>()({
  dialect: sts,
  allowedGoalKeys: propertyKeys(sts, 'goal'),
  allowedTaskKeys: propertyKeys(sts, 'task'),
  skipResource: true,
  // a goal its actor neither decomposes nor delegates is achieved by it
  allowLeafGoals: true,
  mapGoalProps: ({ text }) => ({ text }),
  mapTaskProps: ({ text }) => ({ text }),
  allowedLinkKeys: linkPropertyKeys(sts),
  mapLinkProps: ({ raw }) => raw,
});

/** An STS-ml model as its checks and analyses read it: the view of its `GoalModel`, its extension's kinds too. */
export const stsAnalysisModel = (
  model: IStarModel | IstarModel<string, string>,
): AnalysisModel =>
  analysisViewOf(GoalTree.goalModel(model as IStarModel, stsEngineMapper));
