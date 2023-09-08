import { GoalTree } from '../ObjectiveTree/types';
import { goalMgmtVariables, outcomes, lastStep } from './changeMgmt';
import { dependencyFormulaes, goalFormulaes } from './formulas';
import {
  goalControllerVariables,
  goalTransitions,
  goalVariablesLength,
} from './goalController';
import { rewards } from './rewards';

export const egdeMDPTemplate = ({ gm }: { gm: GoalTree }) => {
  return `mdp
const double p2 = 0.9;
const double p3_1 = 0.9;
const double p3_2 = 0.9;
const double p4_1 = 0.9;
const double p4_2 = 0.9;
const double p5 = 0.9;
const double p6_1 = 0.9;
const double p6_2 = 0.9;
  
  
module GoalController
${goalControllerVariables({ gm })}
  
  n : [0..${goalVariablesLength({ gm })}] init 0; // goal counter

${goalTransitions({ gm })}
  // Controller done
  [controller_done] t & (n=5) -> 1:(n'=0);
endmodule

${dependencyFormulaes({ gm })}


module ChangeMgmt
  // variables required for each goal g1, g2, ... with its variants 1, 2, 3, ...ble::
${goalMgmtVariables({ gm })}

  step : [0..${lastStep({ gm }) + 3}] init 0; 
  fail : bool init false;

${outcomes({ gm })}

  // Plan failure: inform Turn module and reset counter
  [changeMgmt_done] !t & fail -> 1:(fail'=false) & (step'=0); 

  // done
  [success] !t & !fail & step=${lastStep({ gm }) + 1} -> (step'=step+1);
  [end] !t & step=${lastStep({ gm }) + 2} -> (step'=${lastStep({ gm }) + 2});

  // return to step 0
  //[controller_done] true -> 1:(step'=0);
endmodule

module Turn
  t : bool init true; // true - controller has the turn, false - goal model updating has the turn

  [controller_done] true -> 1:(t'=false);
  [changeMgmt_done] true -> 1:(t'=true);
endmodule


${goalFormulaes({ gm }).join('\n')} 

${rewards({
  type: 'utility',
  gm,
})}

${rewards({
  type: 'cost',
  gm,
})}
`;
};
