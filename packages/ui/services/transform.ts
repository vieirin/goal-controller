import {
  engineLabel,
  initLogger,
  refuseOnPropertyErrors,
  runOf,
  type EngineOutputFile,
  type LoggerReport,
} from '@goal-controller/lib';
import { GoalModel } from './goalModel';
import { parseModel } from '../lib/workbench/dialects';
import { ENGINE_LIST } from '../lib/workbench/engineDialects';
import type {
  EdgeV2TaskLayout,
  GodaVariant,
  TransformEngine,
} from '../lib/types';
import { takesOption } from '../lib/workbench/engineDialects';

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
  /** GODA: also write reliability.formula and cost.formula, SA-BSN's runtime formulas (#94) */
  runtimeFormulas?: boolean;
  /** iStar-DT: the observations' type, `getObsType(continuous)` (default) or `discrete` */
  continuous?: boolean;
  /** generate from the model without its single-child goals (see goal-tree's `Model.reduce`) */
  reduce?: boolean;
  /** the primary file of the latest successful run for the same file and engine, for `clean: false` */
  previousOutput?: string;
};

/** The model as its dialect reads it, or null when it doesn't parse (the engine's parse says why). */
const readModel = (modelJson: string) => {
  try {
    return parseModel(modelJson);
  } catch {
    return null;
  }
};

/**
 * Runs the lib generator for the chosen engine: its files (one primary).
 * Throws on parse or generation failure, and on an error the dialect reports
 * on a property the engine reads (goal-controller#274).
 */
export const transform = (
  options: TransformOptions,
): { files: EngineOutputFile[]; report: LoggerReport | null } => {
  const {
    modelJson,
    engine,
    fileName,
    variables,
    reduce = false,
    previousOutput,
    ...asked
  } = options;
  const definition = ENGINE_LIST.find(({ id }) => id === engine);
  if (!definition) throw new Error(`No engine ${engine}`);
  const run = runOf(definition);
  const modelName = fileName || 'model';
  const logger = run.log?.(modelName) ?? initLogger(modelName, false, true);

  try {
    // what the dialect reports wrong on a property the engine reads stops it (#274)
    const istar = readModel(modelJson);
    if (istar) refuseOnPropertyErrors(definition, istar);
    if (!run.generate)
      throw new Error(`${engineLabel(definition)} generates no file`);
    // the model without its single-child goals, for an engine that offers it
    const parseResult = GoalModel.parseFor(definition, modelJson, {
      reduce: reduce && takesOption(engine, 'reduce'),
    });
    if (!parseResult.success) throw new Error(parseResult.error);
    const { files } = run.generate(parseResult.reading as never, {
      modelName,
      model: parseResult.model,
      options: asked,
      variables,
      previousOutput,
    });

    const report = logger.getReport();
    return { files, report };
  } finally {
    logger.close();
  }
};
