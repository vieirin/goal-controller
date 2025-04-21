import { GoalTreeWithParent } from '../ObjectiveTree/types';
import { decisionVariablesTemplate } from './decisionVariables';
import { changeManagerModule } from './modules/changeManager/changeManager';
import { goalModules } from './modules/goalModule/goalModules';
import { systemModule } from './modules/system/system';

export const edgeDTMCTemplate = ({ gm }: { gm: GoalTreeWithParent }) => {
  return `dtmc

//we encode states in which the controller make a specific decision with 
//variables
//For instance, G0 can be pursued or skipped whenever goal=0, i.e., the GM
//investigates G0
//We therefore add decision variables that depend on some (i) internal variables in the system
//whose values the GM can access, (ii) estimates about variables in the system and environment
//that the GM has some kind of information on, and (iii) information about previsously
//pursued, chosen and achieved goals. The designers have to determine, which variables they want
//to be present in the decision making for pursuing or skipping G0.
//
//Let's assume, that we want to make this decision based on some variable called 'time' in the
//system. Let's further assume that 'time' goes from 0..9
//We use the following variables to represent these system states: 
${decisionVariablesTemplate({ gm })}

${goalModules({ gm })}

${changeManagerModule({ gm })}

${systemModule({ gm })}
`;
};
