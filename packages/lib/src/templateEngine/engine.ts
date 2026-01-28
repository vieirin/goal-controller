import type { GoalTreeType } from '@goal-controller/goal-tree';
import { validate } from '../prismValidator';
import { decisionVariablesTemplate } from './decisionVariables';
import { changeManagerModule } from './modules/changeManager/changeManager';
import { goalModules } from './modules/goalModule/goalModules';
import { systemModule } from './modules/system/system';

const edgeDTMCTemplate = ({
  gm,
  fileName,
  clean = false,
  variables,
}: {
  gm: GoalTreeType;
  fileName: string;
  clean?: boolean;
  variables?: Record<string, boolean | number>;
}): string => {
  const dtmcModel = `dtmc

${decisionVariablesTemplate({ gm })}

${goalModules({ gm })}

${changeManagerModule({ gm, fileName, variables })}

${systemModule({ gm, fileName, clean, variables })}
`;
  return dtmcModel;
};

export const generateValidatedPrismModel = ({
  gm,
  fileName,
  clean = false,
  variables,
}: {
  gm: GoalTreeType;
  fileName: string;
  clean?: boolean;
  variables?: Record<string, boolean | number>;
}): string => {
  const prismModel = edgeDTMCTemplate({ gm, fileName, clean, variables });

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
