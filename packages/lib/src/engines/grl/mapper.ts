/**
 * GRL's engine mapper: how goal-tree reads a GRL model for the workbench.
 * GRL generates nothing (its analyses evaluate the model, ./evaluation), so
 * the mapper keeps an element's, an actor's and a link's GRL properties as
 * written; a goal may be a leaf (a strategy evaluates it).
 */
import { actorPropertyKeys, linkPropertyKeys } from '@goal-controller/dialect';
import {
  createEngineMapper,
  GoalTree,
  type IStarModel,
} from '@goal-controller/goal-tree';
import { analysisViewOf, type AnalysisModel } from '../analysis';
import { grl } from './definition';

/** the custom properties a GRL element keeps (#105: read, not yet declarable) */
const GRL_ELEMENT_KEYS = [
  'importance',
  'importanceQuantitative',
  'decompositionType',
] as const;

type GrlProps = { text: string };

export const grlEngineMapper = createEngineMapper<GrlProps, GrlProps, never>()({
  dialect: grl,
  allowedGoalKeys: GRL_ELEMENT_KEYS,
  allowedTaskKeys: GRL_ELEMENT_KEYS,
  // a resource is an element the evaluation reads, not one goal-tree maps
  skipResource: true,
  allowedQualityKeys: GRL_ELEMENT_KEYS,
  allowLeafGoals: true,
  mapGoalProps: ({ text }) => ({ text }),
  mapTaskProps: ({ text }) => ({ text }),
  // an actor's importance, a contribution's type and weight (goal-controller#125)
  allowedActorKeys: actorPropertyKeys(grl),
  mapActorProps: ({ raw }) => raw,
  allowedLinkKeys: linkPropertyKeys(grl),
  mapLinkProps: ({ raw }) => raw,
});

/** A GRL model as its analyses read it: the view of its `GoalModel`. */
export const grlAnalysisModel = (model: IStarModel): AnalysisModel =>
  analysisViewOf(GoalTree.goalModel(model, grlEngineMapper));
