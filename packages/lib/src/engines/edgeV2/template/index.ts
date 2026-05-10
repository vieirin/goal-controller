import type { EdgeGoalTree } from '../types';
import { validate } from '../validator';
import { DEFAULT_EDGE_V2_DECISION_UPPER } from './decisionConstants';
import { changeManagerModule } from './modules/changeManager/changeManager';
import { goalModules } from './modules/goalModule/goalModules';
import { systemModule } from './modules/system/system';

const edgeDTMCTemplate = ({
  gm,
  fileName,
  clean = false,
  variables = {},
  achievabilitySpace,
}: {
  gm: EdgeGoalTree;
  fileName: string;
  clean?: boolean;
  variables?: Record<string, boolean | number>;
  /** Inclusive upper bound for each goal's `decision_<id>` variable; aligns with PRISM transform API name. */
  achievabilitySpace?: number;
}): string => {
  const decisionUpperBound =
    achievabilitySpace ?? DEFAULT_EDGE_V2_DECISION_UPPER;
  const dtmcModel = `dtmc

${goalModules({ gm, variablesOptions: { decisionUpperBound } })}

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
  achievabilitySpace,
}: {
  gm: EdgeGoalTree;
  fileName: string;
  clean?: boolean;
  variables?: Record<string, boolean | number>;
  achievabilitySpace?: number;
}): string => {
  const prismModel = edgeDTMCTemplate({
    gm,
    fileName,
    clean,
    variables,
    achievabilitySpace,
  });

  const report = validate(gm, prismModel, fileName);
  if (report.summary.totalMissing > 0) {
    throw new Error('PRISM model is not valid');
  }
  return prismModel;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const __test_only_exports__ = {
  edgeDTMCTemplate,
};
