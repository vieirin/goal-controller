/**
 * How kaosexpert reads a KAOS model for its analyses (goal-controller#190):
 * kaosprop's mapper (its entries and link keys: kaosexpert's dialect adds
 * none to links), and its elements' properties as written, so that an
 * obstacle's estimates per expert (`Probability[e1]`, keys a dialect's
 * entries don't list) reach the analyses, which read them with
 * kaosexpert's dialect (`viewValues`).
 */
import { GoalTree, type ModelFor } from '@goal-controller/goal-tree';
import { analysisViewOf, type AnalysisModel } from '../analysis';
import { kaospropEngineMapper } from '../kaosprop/mapper';
import type { kaosprop } from '../kaosprop/definition';
import type { kaosexpert } from './definition';

export const kaosexpertEngineMapper = kaospropEngineMapper;

/** A KAOS model as kaosexpert's analyses read it. */
export const kaosexpertAnalysisModel = <EK extends string, LK extends string>(
  model: ModelFor<typeof kaosexpert, EK, LK>,
): AnalysisModel =>
  analysisViewOf(
    // a KAOS model of kaosexpert's is one of kaosprop's: the same framework and kinds
    GoalTree.goalModel(
      model as ModelFor<typeof kaosprop, EK, LK>,
      kaospropEngineMapper,
    ),
  );
