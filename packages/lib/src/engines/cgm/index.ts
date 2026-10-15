/**
 * Contextual goal models (goal-controller#153, plan and decisions in #151):
 * the dialect (iStar 2.0 with contexts at its variation points, and context
 * analysis's contexts, statements and facts as the `cgm` extension's
 * kinds), its checks, its situations and logical relations (project
 * resources), and RE-Context's DLV encoding of a model (./dlv).
 */
import { defineAnalyses } from '../analysis';
import { projectResourceParsers } from '../projectResources';
import {
  runCoreVariants,
  runMinimumCost,
  runUnadoptable,
  runVariantsInSituation,
} from './analyses';
import { cgm } from './definition';
import { parseRelations, parseSituations } from './resources';

/** REJ 2010's reasoning, §4–§5 (#153 item 5): each case a variant, or a set of them. */
export const cgmAnalyses = defineAnalyses(cgm, {
  cgmVariants: {
    label: 'Variants in a situation (REJ 2010 §4)',
    input: 'situations',
    run: runVariantsInSituation,
  },
  cgmUnadoptable: {
    label: 'Unadoptable variants (§5.1)',
    input: 'relations',
    run: runUnadoptable,
  },
  cgmCore: {
    label: 'Core variants (§5.2)',
    input: 'relations',
    run: runCoreVariants,
  },
  cgmMinimumCost: {
    label: 'Minimum-cost tasks (§5.3)',
    input: 'relations',
    run: runMinimumCost,
  },
});

export const cgmProjectResourceParsers = projectResourceParsers(cgm)({
  situations: parseSituations,
  relations: parseRelations,
});

export { cgm } from './definition';
export { cgmAnalysisModel, cgmEngineMapper } from './mapper';
export { cgmCheckRegistry, type CgmCheckName } from './checks';
export { cgmExtension, cgmMetamodelBlock } from './extension';
export * from './analyses';
export * from './dlv';
export * from './formulas';
export * from './model';
export * from './problems';
export * from './situation';
export * from './smt';
export * from './resources';
export * from './vocabulary';
