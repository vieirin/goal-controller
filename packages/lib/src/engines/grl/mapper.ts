/**
 * GRL's engine mapper: how goal-tree reads a GRL model for the workbench.
 * GRL generates nothing (its analyses evaluate the model, ./evaluation), so
 * the mapper keeps an element's, an actor's and a link's GRL properties as
 * written, and the evaluation graph reads them as the dialect does
 * (`viewValues`, goal-controller#187); a goal may be a leaf (a strategy
 * evaluates it).
 */
import {
  createEngineMapper,
  GoalTree,
  type IStarModel,
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

export const grlEngineMapper = createEngineMapper<GrlProps, GrlProps, never>()({
  dialect: grl,
  // a resource is an element the evaluation reads, not one goal-tree maps
  skipResource: true,
  allowLeafGoals: true,
  mapGoalProps: ({ text }) => ({ text }),
  mapTaskProps: ({ text }) => ({ text }),
  // an actor's importance, a contribution's type and weight (goal-controller#125)
  mapActorProps: ({ raw }) => raw,
  mapLinkProps: ({ raw }) => raw,
});

/** A GRL model as its analyses read it: the view of its `GoalModel`. */
export const grlAnalysisModel = (model: IStarModel): AnalysisModel =>
  analysisViewOf(GoalTree.goalModel(model, grlEngineMapper));
