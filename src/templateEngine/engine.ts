import { type GoalTree } from '../GoalTree/types';
import { decisionVariablesTemplate } from './decisionVariables';
import { changeManagerModule } from './modules/changeManager/changeManager';
import { goalModules } from './modules/goalModule/goalModules';
import { systemModule } from './modules/system/system';

export const edgeDTMCTemplate = ({
  gm,
  fileName,
}: {
  gm: GoalTree;
  fileName: string;
}): string => {
  const dtmcModel = `dtmc

${decisionVariablesTemplate({ gm })}

${goalModules({ gm })}

${changeManagerModule({ gm, fileName })}

${systemModule({ gm, fileName })}
`;
  return dtmcModel;
};
