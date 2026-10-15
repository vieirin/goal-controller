/**
 * iStar-DT's engine mapper: how goal-tree reads an iStar-DT model (its
 * tree, the inspector's unread keys, and its `GoalModel`, goal-controller
 * #125). The writer reads the model as a graph (`readIstardtModel`) over
 * that `GoalModel`'s view, so the mapper keeps the actor's sets and the
 * links' probabilities and weights as written.
 */
import {
  actorPropertyKeys,
  linkPropertyKeys,
  propertyKeys,
} from '@goal-controller/dialect';
import {
  createEngineMapper,
  GoalTree,
  type IStarModel,
} from '@goal-controller/goal-tree';
import type { IstarModel } from '@istar-ts/core';
import { analysisViewOf, type AnalysisModel } from '../analysis';
import { istardt } from './definition';

type IstardtProps = { text: string };

export const istardtEngineMapper = createEngineMapper<
  IstardtProps,
  IstardtProps,
  never
>()({
  dialect: istardt,
  allowedGoalKeys: propertyKeys(istardt, 'goal'),
  allowedTaskKeys: propertyKeys(istardt, 'task'),
  skipResource: true,
  allowedQualityKeys: propertyKeys(istardt, 'quality'),
  mapGoalProps: ({ text }) => ({ text }),
  mapTaskProps: ({ text }) => ({ text }),
  allowedActorKeys: actorPropertyKeys(istardt),
  mapActorProps: ({ raw }) => raw,
  allowedLinkKeys: linkPropertyKeys(istardt),
  mapLinkProps: ({ raw }) => raw,
});

/**
 * An iStar-DT model as the writer and the checks read it: the view of its
 * `GoalModel`. It has the extension's kinds (parsed with its metamodel
 * block), which goal-tree reads as it reads GRL's; its types name iStar's.
 */
export const istardtAnalysisModel = (
  model: IStarModel | IstarModel<string, string>,
): AnalysisModel =>
  analysisViewOf(GoalTree.goalModel(model as IStarModel, istardtEngineMapper));
