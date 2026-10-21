/**
 * How kaosres reads a KAOS model for its analyses (goal-controller#191):
 * kaosprop's mapper for the tree, and the model's elements and links with
 * their properties as written (`kaosresView`), so that a resolution's
 * `Cost`, `Form` and payload, keys kaosprop's mapper doesn't keep, reach
 * the selection, which reads them with kaosres's dialect; kaosprop's
 * analyses read the same view as they read their own.
 */
import type { AnyModel } from '@goal-controller/goal-tree';
import type { AnalysisModel } from '../analysis';
import { kaospropEngineMapper } from '../kaosprop/mapper';
import { kaosresView } from './transform';

export const kaosresEngineMapper = kaospropEngineMapper;

/** A KAOS model as kaosres's analyses read it. */
export const kaosresAnalysisModel = (model: AnyModel): AnalysisModel =>
  kaosresView(model);
