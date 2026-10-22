/**
 * How kaossim reads a KAOS model for its analyses (goal-controller#193):
 * kaosprop's mapper for the tree, and the model's elements and links with
 * their properties as written (kaosres's view), so that the keyed keys
 * (`QualityVariable[ResponseTime]`, `Equation[ResponseTime]`) and an
 * assignment's `SysRef` and estimates, which no mapper's entries list,
 * reach the analyses, which read them with kaossim's dialect (./model.ts).
 */
import type { AnyModel } from '@goal-controller/goal-tree';
import type { AnalysisModel } from '../analysis';
import { kaospropEngineMapper } from '../kaosprop/mapper';
import { kaosresView } from '../kaosres/transform';

export const kaossimEngineMapper = kaospropEngineMapper;

/** A KAOS model as kaossim's analyses read it. */
export const kaossimAnalysisModel = (model: AnyModel): AnalysisModel =>
  kaosresView(model);
