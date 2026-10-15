#!/usr/bin/env node

// Import for CLI usage and re-export
import { GoalTree, Model } from '@goal-controller/goal-tree';
import path from 'path';
import { writeOutputFiles } from './cli/outputFiles';
import { readPreviousOutput } from './cli/previousOutput';
import {
  edgeEngineMapper,
  edgeOutput,
  generateValidatedPrismModel,
} from './engines/edge';
import { initLogger } from './engines/edge/logger/logger';
import { validate } from './engines/edge/validator';
import {
  edgeEngineMapper as edgeV2EngineMapper,
  edgeV2Output,
  generateValidatedPrismModel as generateEdgeV2PrismModel,
} from './engines/edgeV2';
import { initLogger as initEdgeV2Logger } from './engines/edgeV2/logger/logger';
import { sleecOutput, sleecTemplateEngine } from './engines/sleec';

export type {
  EngineMapper,
  GoalNode,
  GoalTreeType,
  IStarModel,
  RawProps,
  Relation,
  Type,
} from '@goal-controller/goal-tree';

// Re-export GoalTree and Model for runtime usage (Model.load, GoalTree.fromModel)
export { GoalTree, Model };

// Decision variables config
export { DEFAULT_ACHIEVABILITY_SPACE } from './engines/edge/template/decisionVariables';

// Edge engine types and mapper
export {
  edgeEngineMapper,
  type EdgeGoalNode,
  type EdgeGoalTree,
  type EdgeTask,
} from './engines/edge';

// EdgeV2 engine mapper and template
export { edgeV2EngineMapper, generateEdgeV2PrismModel, initEdgeV2Logger };
// Custom properties each engine reads from the goal model (for editors)
export {
  EDGE_GOAL_KEYS,
  EDGE_RESOURCE_KEYS,
  EDGE_TASK_KEYS,
} from './engines/edge/mapper';
export {
  EDGE_GOAL_KEYS as EDGE_V2_GOAL_KEYS,
  EDGE_RESOURCE_KEYS as EDGE_V2_RESOURCE_KEYS,
  EDGE_TASK_KEYS as EDGE_V2_TASK_KEYS,
} from './engines/edgeV2/mapper';
export {
  SLEEC_GOAL_KEYS,
  SLEEC_TASK_KEYS,
  SLEEC_QUALITY_KEYS,
} from './engines/sleec/mapper';

export {
  DEFAULT_TASK_LAYOUT as EDGE_V2_DEFAULT_TASK_LAYOUT,
  type TaskLayout as EdgeV2TaskLayout,
} from './engines/edgeV2/template/common';
export type {
  EdgeGoalNode as EdgeV2GoalNode,
  EdgeGoalTree as EdgeV2GoalTree,
  EdgeTask as EdgeV2Task,
} from './engines/edgeV2';
export type {
  Decision,
  EdgeGoalProps,
  EdgeTaskProps,
  ExecCondition,
  GoalExecutionDetail,
} from './engines/edge';

// SLEEC engine types and mapper
export {
  sleecEngineMapper,
  type SleecGoalNode,
  type SleecGoalTree,
  type SleecTask,
} from './engines/sleec';
export type { SleecGoalProps, SleecTaskProps } from './engines/sleec';

// Core transformation engines (remain in lib)
export { generateValidatedPrismModel, sleecTemplateEngine };
// The same engines' outputs as files (goal-controller#33): one primary file each
export { edgeOutput, edgeV2Output, sleecOutput };
export {
  engineOutputProblems,
  outputBaseName,
  outputFileNameProblem,
  outputPathProblems,
  primaryFile,
  singleFileOutput,
  type EngineOutput,
  type EngineOutputFile,
} from './engines/output';
// Analysis engines (goal-controller#107): values on the model, not a file
export * from './engines/analysis';

// Validation
export { validate };
export type { Check, CheckContext } from './engines/checks';
export {
  edgeGoalChecks,
  edgeTaskChecks,
  edgeResourceChecks,
  edgeCheckRegistry,
  firstResourceIssue,
  type EdgeCheckName,
} from './engines/edgeFamily/checks';

// The engines' definitions (@goal-controller/dialect), and the dialects'
export { edge } from './engines/edge';
export { edgeV2 } from './engines/edgeV2';
// MutRoSe: its definition, checks, mapper and runtime annotation
export {
  mutrose,
  mutroseCheckRegistry,
  mutroseEngineMapper,
  mutroseOutput,
  mutroseProblem,
  mutroseRuntimeAnnotation,
  MUTROSE_GOAL_KEYS,
  MUTROSE_TASK_KEYS,
  type MutroseCheckName,
  type MutroseGoalNode,
  type MutroseGoalProps,
  type MutroseGoalTree,
  type MutroseTask,
  type MutroseTaskProps,
} from './engines/mutrose';
// GODA-MDP: its definition, checks, mapper and outputs (the MDP, its
// properties and its parametric formulas), and the formulas as numbers
export {
  goda,
  godaCheckRegistry,
  godaEngineMapper,
  godaGoalModel,
  godaOutput,
  type GodaGoalModel,
  GodaUnsupported,
  GODA_DEFAULT_VARIANT,
  GODA_GOAL_KEYS,
  GODA_IMPLEMENTED_VARIANTS,
  GODA_TASK_KEYS,
  GODA_VARIANTS,
  close,
  compareFormulas,
  compileFormula,
  evalFormulaValues,
  evaluate,
  formulaText,
  random,
  SEED,
  TOLERANCE,
  type CompiledFormula,
  type FormulaComparison,
  type GodaCheckName,
  type GodaGoalNode,
  type GodaGoalProps,
  type GodaGoalTree,
  type GodaOutputOptions,
  type GodaTask,
  type GodaTaskProps,
  type GodaVariant,
} from './engines/goda';
// GRL (goal-controller#106): its definition, kinds, checks, strategies and
// analyses (jUCMNav's evaluations), and the .jucm importer
export {
  grl,
  grlAnalyses,
  grlAnalysisModel,
  grlCheckRegistry,
  grlEngineMapper,
  grlExtension,
  grlMetamodelBlock,
  grlProjectResourceParsers,
  evaluateStrategy,
  grlGraph,
  readStrategies,
  type GrlAlgorithm,
  type GrlCheckName,
  type GrlEvaluation,
  type GrlPreferences,
  type GrlStrategy,
} from './engines/grl';
export {
  importJucm,
  type DialectRecord,
  type ImportDiagnostic,
  type ImportResult,
} from './importers/jucm';
export { DEFAULT_ELEMENT_FILL } from './engines/edgeFamily';
// Project resources (goal-controller#25): each engine's parsers, data in, data out
export {
  projectResourceParsers,
  readJson,
  type ParsedResource,
  type ProjectResourceParser,
  type ProjectResourceParsers,
  type ResourceDiagnostic,
  type ResourceFile,
} from './engines/projectResources';
export {
  mutroseProjectResources,
  parseConfiguration,
  parseHddl,
  parseWorld,
  type HddlDomain,
  type MutroseConfiguration,
  type MutroseResourceData,
  type WorldKnowledge,
} from './engines/mutrose';
// the definition pool (goal-controller#59): one language across a project's files
export * from './engines/definitionPool';
// the pool's protocol (#82): what an engine declares, and poolOf
export * as pool from './pool';
// the readers of the formats project resources are written in, with ranges
export * from './formats';
export {
  modelDocument,
  modelField,
  mutrosePool,
  OTHER_MODEL,
} from './engines/mutrose/pool';
export {
  edgeProjectResources,
  parseProperties,
  parseVariables,
  type EdgePropertySuites,
  type EdgeResourceData,
  type EdgeVariables,
} from './engines/edgeFamily';
export { istar4RationalAgents } from './dialects/pistarExt';
// One object per engine (goal-controller#124): what the workbench registers
export * from './engines/engine';
export { edgeEngine } from './engines/edge/engine';
export { edgeV2Engine } from './engines/edgeV2/engine';
export { sleecEngine } from './engines/sleec/engine';
export { mutroseEngine } from './engines/mutrose/engine';
export { godaEngine } from './engines/goda/engine';
export { grlEngine } from './engines/grl/engine';

// Logger
export type { LoggerReport } from './engines/edge/logger/logger';
export { initLogger };

// CLI entry point - if this file is executed directly, run the CLI script

if (require.main === module) {
  /* eslint-disable no-console */
  // Parse command line arguments
  const args = process.argv.slice(2);
  const inputFile = args.find(
    (arg: string) => !arg.startsWith('--') && !arg.startsWith('-'),
  );

  if (!inputFile) {
    console.error('missing file param');
    console.error('Usage: goal-controller <file>');
    process.exit(1);
  }

  const model = Model.load(inputFile);
  const tree = GoalTree.fromModel(model, edgeEngineMapper);

  const logger = initLogger(inputFile);
  const fileName = path.basename(inputFile);
  const baseName = path.parse(inputFile).name;
  const previousOutput = readPreviousOutput(baseName);

  try {
    // every file the engine makes, into output/ (Edge's: <model>.prism)
    const written = writeOutputFiles(
      'output',
      edgeOutput({ gm: tree.nodes, fileName, previousOutput }),
    );
    console.log(`The file was saved to ${written.join(', ')}!`);
  } catch (err) {
    console.error(err);
    // a run whose files weren't written is a failed run
    process.exitCode = 1;
  } finally {
    logger.close();
  }
}

// each engine's generation options, typed as properties are (#118); MutRoSe and GRL have none
export { edgeOptions } from './engines/edge/options';
export { edgeV2Options } from './engines/edgeV2/options';
export { godaOptions } from './engines/goda/options';
export { sleecOptions } from './engines/sleec/options';
