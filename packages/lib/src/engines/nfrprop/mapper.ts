/**
 * nfrprop's mapper (goal-controller#171): how goal-tree reads an NFR model
 * for its analysis. It generates nothing, so the IR keeps every element's
 * properties as written (the analysis reads the initial labels there) and
 * a link's label (its contribution); softgoals and operationalizations may
 * be leaves.
 */
import { parsePistar } from '@istar-ts/core';
import { NFR } from '@istar-ts/dsm3-nfr/metamodel';
import { propertyKeys } from '@goal-controller/dialect';
import {
  createEngineMapper,
  GoalTree,
  type IStarModel,
} from '@goal-controller/goal-tree';
import { analysisViewOf, type AnalysisModel } from '../analysis';
import { nfrprop } from './definition';

export const nfrpropEngineMapper = createEngineMapper<
  { text: string },
  never
>()({
  dialect: nfrprop,
  allowedGoalKeys: propertyKeys(nfrprop, 'nfr.NFR'),
  allowedTaskKeys: [],
  allowLeafGoals: true,
  skipResource: true,
  mapGoalProps: ({ text }) => ({ text }),
  mapTaskProps: ({ id }) => {
    throw new Error(`[INVALID_MODEL]: ${id}: an NFR model has no tasks`);
  },
});

/** An NFR model as nfrprop's analysis reads it: the view of its `GoalModel`. */
export const nfrpropAnalysisModel = (model: IStarModel): AnalysisModel =>
  analysisViewOf(GoalTree.goalModel(model, nfrpropEngineMapper));

/** An NFR model's piStar text (DSM3's), read with the NFR root. */
export const readNfrModel = (text: string): IStarModel =>
  parsePistar(text, { metamodel: NFR }) as unknown as IStarModel;
