import {
  generateValidatedPrismModel,
  generateEdgeV2PrismModel,
  initLogger,
  initEdgeV2Logger,
  sleecTemplateEngine,
  type LoggerReport,
} from '@goal-controller/lib';
import { GoalModel } from './goalModel';
import type { EdgeV2TaskLayout, TransformEngine } from '../lib/types';

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
  /** the output of the latest successful run for the same file and engine, for `clean: false` */
  previousOutput?: string;
};

/** Runs the lib generator for the chosen engine. Throws on parse or generation failure. */
export const transform = (
  options: TransformOptions,
): { output: string; report: LoggerReport | null } => {
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
    previousOutput,
  } = options;

  const logger =
    engine === 'edgev2'
      ? initEdgeV2Logger(fileName || 'model', false, true)
      : initLogger(fileName || 'model', false, true);

  try {
    let output: string;
    if (engine === 'edge') {
      const parseResult = GoalModel.parseForEdge(modelJson);
      if (!parseResult.success) throw new Error(parseResult.error);
      output = generateValidatedPrismModel({
        gm: parseResult.tree,
        fileName: fileName || 'model',
        clean,
        variables,
        generateDecisionVars,
        achievabilitySpace,
        previousOutput,
        writeReport: false,
      });
    } else if (engine === 'edgev2') {
      const parseResult = GoalModel.parseForEdgeV2(modelJson);
      if (!parseResult.success) throw new Error(parseResult.error);
      output = generateEdgeV2PrismModel({
        gm: parseResult.tree,
        fileName: fileName || 'model',
        clean,
        variables,
        generateDecisionVars,
        achievabilitySpace,
        taskLayout,
        discretisation,
        previousOutput,
        writeReport: false,
      });
    } else {
      const parseResult = GoalModel.parseForSleec(modelJson);
      if (!parseResult.success) throw new Error(parseResult.error);
      output = sleecTemplateEngine(parseResult.tree, { generateFluents });
    }

    const report = logger.getReport();
    return { output, report };
  } finally {
    logger.close();
  }
};
