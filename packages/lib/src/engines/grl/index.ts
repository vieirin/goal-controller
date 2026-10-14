/**
 * GRL (goal-controller#106): its definition (the dialect), its own kinds
 * (the `grl` extension), its checks, its strategies (a project resource) and
 * its analyses, jUCMNav's quantitative and qualitative evaluations. The
 * `.jucm` importer is `importers/jucm`.
 */
import { defineAnalyses } from '../analysis';
import { projectResourceParsers } from '../projectResources';
import { grl } from './definition';
import { runQualitative, runQuantitative } from './evaluation';
import { parseStrategies } from './strategies';

export const grlAnalyses = defineAnalyses(grl, {
  grlQuantitative: {
    label: 'GRL evaluation (quantitative)',
    input: 'strategies',
    run: runQuantitative,
  },
  grlQualitative: {
    label: 'GRL evaluation (qualitative)',
    input: 'strategies',
    run: runQualitative,
  },
});

export const grlProjectResourceParsers = projectResourceParsers(grl)({
  strategies: parseStrategies,
});

export { grl } from './definition';
export { grlCheckRegistry, type GrlCheckName } from './checks';
export { grlExtension, grlMetamodelBlock } from './extension';
export * from './vocabulary';
export {
  DEFAULT_PREFERENCES,
  readStrategies,
  writeStrategyFile,
  strategyFileName,
  type GrlPreferences,
  type GrlStrategy,
  type GrlStrategyFile,
} from './strategies';
export {
  evaluateStrategy,
  grlGraph,
  kpiEvaluation,
  labelOf,
  type GrlAlgorithm,
  type GrlEvaluation,
  type GrlGraph,
} from './evaluation';
