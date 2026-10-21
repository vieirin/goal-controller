/**
 * kaossim (goal-controller#193): quantitative goal models, Letier and van
 * Lamsweerde's partial goal satisfaction (FSE'04) simulated as Heaven and
 * Letier do (RE'11), over kaosprop's KAOS model.
 *
 * - definition.ts: its dialect: quality variables, objective functions,
 *   refinement equations, estimates, options (D1, D2)
 * - model.ts: the model read: variables, objectives, definitions, decision
 *   points
 * - designs.ts: the designs, a project resource (D2)
 * - simulation.ts: a design's Monte Carlo (RE'11 §III)
 * - search.ts: the Pareto front, by every design or by NSGA-II (D5)
 * - analyses.ts, options.ts, mapper.ts, engine.ts: what the workbench runs
 */
import { defineAnalyses } from '../analysis';
import { projectResourceParsers } from '../projectResources';
import { runDesignSpace, runSimulation } from './analyses';
import { kaossim } from './definition';
import { parseDesigns } from './designs';

export const kaossimAnalyses = defineAnalyses(kaossim, {
  simulation: {
    label: 'Objective functions per design',
    inputs: ['design'],
    run: runSimulation,
  },
  designSpace: {
    label: 'Pareto-optimal designs',
    run: runDesignSpace,
  },
});

export const kaossimProjectResourceParsers = projectResourceParsers(kaossim)({
  design: parseDesigns,
});

export {
  EQUATION_FUNCTIONS,
  kaossim,
  MODALS,
  QUALITY_SORTS,
  type Modal,
  type QualitySort,
} from './definition';
export {
  DESIGNS_PATH,
  designsText,
  parseDesigns,
  readDesigns,
  type Design,
  type DesignEntry,
  type DesignsFile,
} from './designs';
export {
  quantitativeModel,
  type Assignment,
  type DecisionPoint,
  type ObjectiveDefinition,
  type ObjectiveFunction,
  type QualityVariable,
  type QuantitativeModel,
  type Refinement,
  type VariableDefinition,
} from './model';
export {
  activeModel,
  designOf,
  enumerateDesigns,
  picksOf,
  simulateDesign,
  type ActiveModel,
  type DesignChoice,
  type DesignRun,
  type DrawCache,
  type ObjectiveValue,
  type SimulationOptions,
} from './simulation';
export {
  dominates,
  exhaustiveSearch,
  nsga2Search,
  paretoFront,
  scoresOf,
  searchDesigns,
  type Scored,
  type SearchOptions,
  type SearchResult,
} from './search';
export {
  caseOf,
  objectiveText,
  runDesignSpace,
  runSimulation,
  SIMULATED_CASES,
} from './analyses';
export { DEFAULT_SIM_OPTIONS, kaossimOptions, simOptionsOf } from './options';
export { kaossimAnalysisModel, kaossimEngineMapper } from './mapper';
