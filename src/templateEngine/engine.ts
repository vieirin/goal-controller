import { GoalTreeWithParent } from '../GoalTree/types';
import { initLogger } from '../logger/logger';
import { decisionVariablesTemplate } from './decisionVariables';
import { changeManagerModule } from './modules/changeManager/changeManager';
import { goalModules } from './modules/goalModule/goalModules';
import { systemModule } from './modules/system/system';

export const edgeDTMCTemplate = ({
  gm,
  fileName,
}: {
  gm: GoalTreeWithParent;
  fileName: string;
}) => {
  initLogger(fileName);
  return `dtmc

${decisionVariablesTemplate({ gm })}

${goalModules({ gm })}

${changeManagerModule({ gm, fileName })}

${systemModule({ gm, fileName })}
`;
};
