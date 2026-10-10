import { singleFileOutput, type EngineOutput } from '../../output';
import { validate } from '../validator';
import {
  decisionVariablesTemplate,
  DEFAULT_ACHIEVABILITY_SPACE,
} from './decisionVariables';
import type { EdgeGoalTree } from '../types';
import { changeManagerModule } from './modules/changeManager/changeManager';
import { goalModules } from './modules/goalModule/goalModules';
import { systemModule } from './modules/system/system';

const edgeDTMCTemplate = ({
  gm,
  previousOutput,
  clean = false,
  variables = {},
  generateDecisionVars = true,
  achievabilitySpace = DEFAULT_ACHIEVABILITY_SPACE,
}: {
  gm: EdgeGoalTree;
  previousOutput?: string;
  clean?: boolean;
  variables?: Record<string, boolean | number>;
  generateDecisionVars?: boolean;
  achievabilitySpace?: number;
}): string => {
  const dtmcModel = `dtmc

${decisionVariablesTemplate({ gm, enabled: generateDecisionVars, achievabilitySpace })}

${goalModules({ gm })}

${changeManagerModule({ gm, variables })}

${systemModule({ gm, previousOutput, clean, variables })}
`;
  return dtmcModel;
};

export const generateValidatedPrismModel = ({
  gm,
  fileName,
  previousOutput,
  clean = false,
  variables = {},
  generateDecisionVars = true,
  achievabilitySpace = DEFAULT_ACHIEVABILITY_SPACE,
  writeReport = true,
}: {
  gm: EdgeGoalTree;
  fileName: string;
  previousOutput?: string;
  clean?: boolean;
  variables?: Record<string, boolean | number>;
  generateDecisionVars?: boolean;
  achievabilitySpace?: number;
  writeReport?: boolean;
}): string => {
  const prismModel = edgeDTMCTemplate({
    gm,
    previousOutput,
    clean,
    variables,
    generateDecisionVars,
    achievabilitySpace,
  });

  const report = validate(gm, prismModel, writeReport ? fileName : undefined);
  if (report.summary.totalMissing > 0) {
    throw new Error('PRISM model is not valid');
  }
  return prismModel;
};

/**
 * The PRISM model as an engine output: one primary file, `<model>.prism`.
 * `fileName` is the model's (its .txt or .json dropped).
 */
export const edgeOutput = (
  options: Parameters<typeof generateValidatedPrismModel>[0],
): EngineOutput =>
  singleFileOutput({
    id: 'model',
    modelName: options.fileName,
    extension: 'prism',
    language: 'prism',
    text: generateValidatedPrismModel(options),
  });

// eslint-disable-next-line @typescript-eslint/naming-convention
export const __test_only_exports__ = {
  edgeDTMCTemplate,
};
