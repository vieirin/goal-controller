/**
 * Tropos4AS (goal-controller#136): its definition (the dialect), its own
 * kinds (the `tropos4as` extension), its checks, its scenarios (a project
 * resource) and its analysis, the goal lifecycle of AAMAS 2009 run over a
 * scenario; and TAOM4E's `.tropos` importer (./taom4e).
 */
import { defineAnalyses } from '../analysis';
import { projectResourceParsers } from '../projectResources';
import { tropos4as } from './definition';
import { runLifecycleAnalysis } from './lifecycle';
import { parseScenarios } from './scenarios';

export const tropos4asAnalyses = defineAnalyses(tropos4as, {
  tropos4asLifecycle: {
    label: 'Goal lifecycle (AAMAS 2009)',
    input: 'scenarios',
    run: runLifecycleAnalysis,
  },
});

export const tropos4asProjectResourceParsers = projectResourceParsers(
  tropos4as,
)({
  scenarios: parseScenarios,
});

export { tropos4as } from './definition';
export { tropos4asAnalysisModel, tropos4asEngineMapper } from './mapper';
export { tropos4asCheckRegistry, type Tropos4asCheckName } from './checks';
export { tropos4asExtension, tropos4asMetamodelBlock } from './extension';
export { tropos4asProblems } from './problems';
export {
  goalTypeOf,
  readTropos4asModel,
  type Tropos4asElement,
  type Tropos4asModel,
  type Tropos4asProblem,
} from './model';
export {
  parseScenarios,
  readScenarios,
  type Outcome,
  type Scenario,
  type ScenarioStep,
} from './scenarios';
export * from './lifecycle';
export { readTaom4e, type Taom4eContext } from './taom4e';
export {
  carriedDifference,
  taom4eCarried,
  type CarriedModel,
} from './taom4e/carried';
export * from './vocabulary';
