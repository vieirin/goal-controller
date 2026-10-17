/**
 * kaosprop's mapper (goal-controller#181): how goal-tree reads a KAOS model
 * for its analyses. It generates nothing, so the IR keeps every element's
 * properties as written (the analyses read the quantities there), and a
 * link's its kind has (an obstruction's, a leg's `Probability`), each as
 * written when the dialect reads it as set (goal-controller#187: a value
 * that is no probability is unset, and the dialect's checks report it);
 * goals and obstacles may be leaves.
 */
import { parsePistar } from '@istar-ts/core';
import { KAOS_OBSTACLES } from '@istar-ts/dsm3-kaos/metamodel';
import { linkPropertyKeys } from '@goal-controller/dialect';
import {
  createEngineMapper,
  GoalTree,
  type IStarModel,
} from '@goal-controller/goal-tree';
import { analysisViewOf, type AnalysisModel } from '../analysis';
import { kaosprop } from './definition';

export const kaospropLinkKeys = linkPropertyKeys(kaosprop);

export const kaospropEngineMapper = createEngineMapper<
  { text: string },
  never
>()({
  dialect: kaosprop,
  allowLeafGoals: true,
  skipResource: true,
  // the analyses read a link's properties as text: its kind's the dialect
  // reads as set (a probability, not blank), each as written
  mapLinkProps: ({ props, raw }): Readonly<Record<string, string>> =>
    Object.fromEntries(
      Object.entries(raw).flatMap(([key, written]) =>
        written !== undefined && props[key as keyof typeof props] != null
          ? [[key, written]]
          : [],
      ),
    ),
  mapGoalProps: ({ text }) => ({ text }),
  mapTaskProps: ({ id }) => {
    throw new Error(`[INVALID_MODEL]: ${id}: a KAOS model has no tasks`);
  },
});

/** A KAOS model as kaosprop's analyses read it: the view of its `GoalModel`. */
export const kaospropAnalysisModel = (model: IStarModel): AnalysisModel =>
  analysisViewOf(GoalTree.goalModel(model, kaospropEngineMapper));

/** A KAOS model's piStar text, read with KAOS and its obstacle analysis. */
export const readKaosObstacleModel = (text: string): IStarModel =>
  parsePistar(text, { metamodel: KAOS_OBSTACLES }) as unknown as IStarModel;
