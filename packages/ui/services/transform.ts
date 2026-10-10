import {
  edgeOutput,
  edgeV2Output,
  GODA_DEFAULT_VARIANT,
  godaOutput,
  initLogger,
  initEdgeV2Logger,
  mutroseOutput,
  sleecOutput,
  type EngineOutputFile,
  type LoggerReport,
} from '@goal-controller/lib';
import { GoalModel } from './goalModel';
import type {
  EdgeV2TaskLayout,
  GodaVariant,
  TransformEngine,
} from '../lib/types';

export type TransformOptions = {
  modelJson: string;
  engine: TransformEngine;
  clean?: boolean;
  generateDecisionVars?: boolean;
  achievabilitySpace?: number;
  generateFluents?: boolean;
  fileName?: string;
  variables?: Record<string, boolean | number>;
  taskLayout?: EdgeV2TaskLayout;
  discretisation?: number;
  /** GODA: the generator version it writes as (default GODA_DEFAULT_VARIANT, #34 D24) */
  variant?: GodaVariant;
  /** generate from the model without its single-child goals (see goal-tree's `Model.reduce`) */
  reduce?: boolean;
  /** the primary file of the latest successful run for the same file and engine, for `clean: false` */
  previousOutput?: string;
};

/**
 * Runs the lib generator for the chosen engine: its files (one primary).
 * Throws on parse or generation failure.
 */
export const transform = (
  options: TransformOptions,
): { files: EngineOutputFile[]; report: LoggerReport | null } => {
  const {
    modelJson,
    engine,
    clean = false,
    generateDecisionVars = true,
    achievabilitySpace = 4,
    generateFluents = true,
    fileName,
    variables,
    taskLayout = 'taskModules',
    discretisation = 10,
    reduce = false,
    previousOutput,
    variant = GODA_DEFAULT_VARIANT,
  } = options;

  const logger =
    engine === 'edgev2'
      ? initEdgeV2Logger(fileName || 'model', false, true)
      : initLogger(fileName || 'model', false, true);

  try {
    const modelName = fileName || 'model';
    let files: EngineOutputFile[];
    if (engine === 'edge') {
      const parseResult = GoalModel.parseForEdge(modelJson, { reduce });
      if (!parseResult.success) throw new Error(parseResult.error);
      ({ files } = edgeOutput({
        gm: parseResult.tree,
        fileName: modelName,
        clean,
        variables,
        generateDecisionVars,
        achievabilitySpace,
        previousOutput,
        writeReport: false,
      }));
    } else if (engine === 'edgev2') {
      const parseResult = GoalModel.parseForEdgeV2(modelJson, { reduce });
      if (!parseResult.success) throw new Error(parseResult.error);
      ({ files } = edgeV2Output({
        gm: parseResult.tree,
        fileName: modelName,
        clean,
        variables,
        generateDecisionVars,
        achievabilitySpace,
        taskLayout,
        discretisation,
        previousOutput,
        writeReport: false,
      }));
    } else if (engine === 'sleec') {
      const parseResult = GoalModel.parseForSleec(modelJson, { reduce });
      if (!parseResult.success) throw new Error(parseResult.error);
      ({ files } = sleecOutput(parseResult.tree, {
        modelName,
        generateFluents,
      }));
    } else if (engine === 'goda') {
      // GODA reads the model as written, and names its MDP after the actor
      const parseResult = GoalModel.parseForGoda(modelJson);
      if (!parseResult.success) throw new Error(parseResult.error);
      ({ files } = godaOutput(parseResult.model, { modelName, variant }));
    } else {
      // MutRoSe reads the model as written: no single-child goals removed
      const parseResult = GoalModel.parseForMutrose(modelJson);
      if (!parseResult.success) throw new Error(parseResult.error);
      ({ files } = mutroseOutput(parseResult.tree, { modelName }));
    }

    const report = logger.getReport();
    return { files, report };
  } finally {
    logger.close();
  }
};
