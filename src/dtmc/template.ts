import { GoalTreeWithParent } from '../ObjectiveTree/types';
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
  return `dtmc
${decisionVariablesTemplate({ gm })}

${goalModules({ gm })}

${changeManagerModule({ gm })}

${systemModule({ gm, fileName })}
`;
};
