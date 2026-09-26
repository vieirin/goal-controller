import { validate, formatValidationReport } from '../validator';
import { DEFAULT_DISCRETISATION } from './common';
import { decisionVariablesTemplate } from './decisionVariables';
import type { EdgeGoalTree } from '../types';
import { changeManagerModule } from './modules/changeManager/changeManager';
import { goalModules } from './modules/goalModule/goalModules';
import { systemModule } from './modules/system/system';

const edgeDTMCTemplate = ({
  gm,
  fileName,
  clean = false,
  variables = {},
  generateDecisionVars = true,
  discretisation = DEFAULT_DISCRETISATION,
}: {
  gm: EdgeGoalTree;
  fileName: string;
  clean?: boolean;
  variables?: Record<string, boolean | number>;
  generateDecisionVars?: boolean;
  /** @deprecated Ignored by edgeV2 (kept for call-site compatibility); use discretisation */
  achievabilitySpace?: number;
  /** N in X_achievable*N > decision_X (default 10) */
  discretisation?: number;
}): string => {
  const dtmcModel = `dtmc

${decisionVariablesTemplate({ gm, enabled: generateDecisionVars, discretisation })}

${goalModules({ gm })}

${changeManagerModule({ gm, variables })}

${systemModule({ gm, fileName, clean, variables })}
`;
  return dtmcModel;
};

export const generateValidatedPrismModel = ({
  gm,
  fileName,
  clean = false,
  variables = {},
  generateDecisionVars = true,
  discretisation = DEFAULT_DISCRETISATION,
}: {
  gm: EdgeGoalTree;
  fileName: string;
  clean?: boolean;
  variables?: Record<string, boolean | number>;
  generateDecisionVars?: boolean;
  /** @deprecated Ignored by edgeV2 (kept for call-site compatibility); use discretisation */
  achievabilitySpace?: number;
  /** N in X_achievable*N > decision_X (default 10) */
  discretisation?: number;
}): string => {
  const prismModel = edgeDTMCTemplate({ gm, fileName, clean, variables, generateDecisionVars, discretisation });

  const report = validate(gm, prismModel, fileName);
  if (report.summary.totalMissing > 0) {
    throw new Error(
      `PRISM model is not valid\n${formatValidationReport(report)}`,
    );
  }
  return prismModel;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const __test_only_exports__ = {
  edgeDTMCTemplate,
};
