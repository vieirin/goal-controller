import { GoalTree } from '../GoalTree/types';
import { goalMgmtVariables, outcomes } from './changeMgmt';
import { GrouppedGoals, leavesGrouppedGoals } from './common';
import { dependencyFormulaes, goalFormulaes } from './formulas';
import { goalControllerVariables, goalTransitions } from './goalController';
import { rewards } from './rewards';

const goalControllerTemplate = ({
  gm,
  grouppedGoals,
}: {
  gm: GoalTree;
  grouppedGoals: GrouppedGoals;
}) => {
  const goalsLength = Object.keys(grouppedGoals).length;
  return `module GoalController
${goalControllerVariables({ grouppedGoals })}
  
  n : [0..${goalsLength}] init 0; // goal counter

${goalTransitions({ gm, grouppedGoals })}
  // Controller done
  [controller_done] t & (n=${goalsLength}) -> 1:(n'=0);
endmodule`;
};

const changeMgmtTemplate = ({
  grouppedGoals,
}: {
  grouppedGoals: GrouppedGoals;
}) => {
  const lastStep = Object.keys(grouppedGoals).length - 1;

  return `module ChangeMgmt
  // variables required for each goal g1, g2, ... with its variants 1, 2, 3, ...ble::
${goalMgmtVariables({ grouppedGoals })}

  step : [0..${lastStep + 3}] init 0; 
  fail : bool init false;

${outcomes({ grouppedGoals })}

  // Plan failure: inform Turn module and reset counter
  [changeMgmt_done] !t & fail -> 1:(fail'=false) & (step'=0); 

  // done
  [success] !t & !fail & step=${lastStep + 1} -> (step'=step+1);
  [end] !t & step=${lastStep + 2} -> (step'=${lastStep + 2});

  // return to step 0
  //[controller_done] true -> 1:(step'=0);
endmodule`;
};

const moduleTemplates = ({ gm }: { gm: GoalTree }) => {
  const grouppedGoals = leavesGrouppedGoals({ gm });
  return `${goalControllerTemplate({ gm, grouppedGoals })}

${dependencyFormulaes({ gm })}

${changeMgmtTemplate({ grouppedGoals })}
`;
};

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

${moduleTemplates({ gm })}

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
