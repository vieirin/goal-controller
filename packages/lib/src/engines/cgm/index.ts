/**
 * Contextual goal models (goal-controller#153, plan and decisions in #151):
 * the dialect (iStar 2.0 with contexts at its variation points, and context
 * analysis's contexts, statements and facts as the `cgm` extension's
 * kinds), its checks, its situations and logical relations (project
 * resources), and RE-Context's DLV encoding of a model (./dlv).
 */
import { projectResourceParsers } from '../projectResources';
import { cgm } from './definition';
import { parseRelations, parseSituations } from './resources';

export const cgmProjectResourceParsers = projectResourceParsers(cgm)({
  situations: parseSituations,
  relations: parseRelations,
});

export { cgm } from './definition';
export { cgmAnalysisModel, cgmEngineMapper } from './mapper';
export { cgmCheckRegistry, type CgmCheckName } from './checks';
export { cgmExtension, cgmMetamodelBlock } from './extension';
export * from './dlv';
export * from './formulas';
export * from './model';
export * from './problems';
export * from './situation';
export * from './smt';
export * from './resources';
export * from './vocabulary';
