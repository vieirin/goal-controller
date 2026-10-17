/**
 * The contextual goal models' engine mapper: how goal-tree reads a model
 * (its trees, the inspector's unread keys, and its `GoalModel`,
 * goal-controller#125). The analyses read the model as a graph, the view
 * of that `GoalModel`, so the mapper keeps a link's properties as written
 * (its `context`, `opposite`, `amount`); the analyses read the view's
 * elements and links as the dialect does (./values, goal-controller#187).
 */
import {
  createEngineMapper,
  GoalTree,
  type IStarModel,
} from '@goal-controller/goal-tree';
import type { IstarModel } from '@istar-ts/core';
import { analysisViewOf, type AnalysisModel } from '../analysis';
import { cgm } from './definition';

type CgmProps = { text: string };

export const cgmEngineMapper = createEngineMapper<CgmProps, CgmProps, never>()({
  dialect: cgm,
  skipResource: true,
  // a dependum, or a goal a model leaves unrefined, ends its variant
  allowLeafGoals: true,
  mapGoalProps: ({ text }) => ({ text }),
  mapTaskProps: ({ text }) => ({ text }),
  mapLinkProps: ({ raw }) => raw,
});

/** A contextual goal model as its analyses read it: the view of its `GoalModel`, its extension's kinds too. */
export const cgmAnalysisModel = (
  model: IStarModel | IstarModel<string, string>,
): AnalysisModel =>
  analysisViewOf(GoalTree.goalModel(model as IStarModel, cgmEngineMapper));
