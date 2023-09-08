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
  // old
  
  n : [0..${goalVariablesLength({ gm })}] init 0; // goal counter

  ${goalTransitions({ gm })}
  // block of commands for the selecting the way in which goal g2 is pursued
  // - If the goal was achieved _or_ is unachievable in any of the potential variants, then don't pursue it
  [G2_skip] t & (n=0) & (G2_achieved | !G2_achievable) -> 1:(G2_pursued'=0)&(n'=1); 
  // - We have a choice of pursuing/not pursuing the goal in any of the available variants
  [G2_pursue0] t & (n=0) & !G2_achieved & G2_achievable -> 1:(G2_pursued'=0)&(n'=1);
  [G2_pursue] t & (n=0) & !G2_achieved & G2_achievable -> 1:(G2_pursued'=1)&(n'=1);

  // block of commands for the selecting the way in which goal g3 is pursued
  // - If the goal was achieved _or_ is unachievable in any of the potential variants, then don't pursue it
  [G3_skip] t & (n=1) & (G3a_achieved | G3b_achieved | (!G3a_achievable & !G3b_achievable)) -> 1:(G3_pursued'=0)&(n'=2); 
  // - We have a choice of pursuing/not pursuing the goal in any of the available variants
  [G3_pursue0] t & (n=1) & !(G3a_achieved | G3b_achieved) & (G3a_achievable | G3b_achievable)-> 1:(G3_pursued'=0)&(n'=2);
  [G3a_pursue] t & (n=1) & !(G3a_achieved | G3b_achieved) & G3a_achievable -> 1:(G3_pursued'=1)&(n'=2);
  [G3b_pursue] t & (n=1) & !(G3a_achieved | G3b_achieved) & G3b_achievable -> 1:(G3_pursued'=2)&(n'=2);

  // block of commands for the selecting the way in which goal g4 is pursued
  // - If the goal was achieved _or_ is unachievable in any of the potential variants, then don't pursue it
  [G4_skip] t & (n=2) & (G4a_achieved | G4b_achieved | (!G4a_achievable & !G4b_achievable)) -> 1:(G4_pursued'=0)&(n'=3); 
  // - We have a choice of pursuing/not pursuing the goal in any of the available variants
  [G4_pursue0] t & (n=2) & !(G4a_achieved | G4b_achieved) & (G4a_achievable | G4b_achievable)-> 1:(G4_pursued'=0)&(n'=3);
  [G4a_pursue] t & (n=2) & !(G4a_achieved | G4b_achieved) & G4a_achievable -> 1:(G4_pursued'=1)&(n'=3);
  [G4b_pursue] t & (n=2) & !(G4a_achieved | G4b_achieved) & G4b_achievable -> 1:(G4_pursued'=2)&(n'=3);

  // block of commands for the selecting the way in which goal g5 is pursued
  // - If the goal was achieved _or_ is unachievable in any of the potential variants, then don't pursue it
  [G5_skip] t & (n=3) & (G5_achieved | !G5_achievable | !(G2_achieved | G2_pursued>0)) -> 1:(G5_pursued'=0)&(n'=4); 
  // - We have a choice of pursuing/not pursuing the goal in any of the available variants
  [G5_pursue0] t & (n=3) & !G5_achieved & G5_achievable & (G2_achieved | G2_pursued>0) -> 1:(G5_pursued'=0)&(n'=4);
  [G5_pursue] t & (n=3) & !G5_achieved & G5_achievable & (G2_achieved | G2_pursued>0) -> 1:(G5_pursued'=1)&(n'=4);

  // block of commands for the selecting the way in which goal g4 is pursued
  // - If the goal was achieved _or_ is unachievable in any of the potential variants, then don't pursue it
  [G6_skip] t & (n=4) & (G6a_achieved | G6b_achieved | ((!G6a_achievable | !G1_achieved_or_pursued) & !G6b_achievable)) -> 1:(G6_pursued'=0)&(n'=5); 
  // - We have a choice of pursuing/not pursuing the goal in any of the available variants
  [G6_pursue0] t & (n=4) & !(G6a_achieved | G6b_achieved) & ((G6a_achievable & G1_achieved_or_pursued) | G6b_achievable)-> 1:(G6_pursued'=0)&(n'=5);
  [G6a_pursue] t & (n=4) & !(G6a_achieved | G6b_achieved) & G6a_achievable & G1_achieved_or_pursued -> 1:(G6_pursued'=1)&(n'=5);
  [G6b_pursue] t & (n=4) & !(G6a_achieved | G6b_achieved) & G6b_achievable -> 1:(G6_pursued'=2)&(n'=5);

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
