mdp

  const double p2 = 0.9;
  const double p3_1 = 0.9;
  const double p3_2 = 0.9;
  const double p4_1 = 0.9;
  const double p4_2 = 0.9;
  const double p5 = 0.9;
  const double p6_1 = 0.9;
  const double p6_2 = 0.9;


module GoalController
  G2_pursued : [0..1] init 0; // goal g2 is: 0 - not pursued, 1 - pursued
  G3_pursued : [0..2] init 0; // goal g3 is: 0 - not pursued, 1 - pursued as variant 1, 2 - pursued as variant 2
  G4_pursued : [0..2] init 0; // goal g4 is: 0 - not pursued, 1 - pursued as variant 1, 2 - pursued as variant 2
  G5_pursued : [0..1] init 0; // goal g5 is: 0 - not pursued, 1 - pursued
  G6_pursued : [0..2] init 0; // goal g6 is: 0 - not pursued, 1 - pursued as variant 1, 2 - pursued as variant 2

  n : [0..5] init 0; // goal counter

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

formula G1_achieved_or_pursued = 
             (G2_achieved | G2_pursued>0) & 
             (G3a_achieved | G3b_achieved | G3_pursued>0) & 
             (G4a_achieved | G4b_achieved | G4_pursued>0) & 
             (G5_achieved | G5_pursued>0);

module ChangeMgmt
  // variables required for each goal g1, g2, ... with its variants 1, 2, 3, ...ble::
  G2_achievable: bool init true;
  G2_achieved: bool init false;

  G3a_achievable : bool init true; 
  G3b_achievable : bool init true; 
  G3a_achieved : bool init false; 
  G3b_achieved : bool init false; 

  G4a_achievable : bool init true; 
  G4b_achievable : bool init true; 
  G4a_achieved : bool init false; 
  G4b_achieved : bool init false;

  G5_achievable: bool init true;
  G5_achieved: bool init false;
  
  G6a_achievable : bool init true; 
  G6b_achievable : bool init true; 
  G6a_achieved : bool init false; 
  G6b_achieved : bool init false;

  step : [0..7] init 0; 
  fail : bool init false;

  // outcomes of pursuing goal 2
  [] !t & !fail & step=0 & G2_pursued=0 -> 1:(step'=1);
  [] !t & !fail & step=0 & G2_pursued>0 -> p2:(G2_achieved'=true)&(step'=1) + (1-p2):(G2_achievable'=false)&(fail'=true)&(step'=1);

  // outcomes of pursuing goal 3
  [] !t & !fail & step=1 & G3_pursued=0 -> 1:(step'=2);
  [] !t & !fail & step=1 & G3_pursued=1 -> p3_1:(G3a_achieved'=true)&(step'=2) + (1-p3_1):(G3a_achievable'=false)&(fail'=true)&(step'=2);
  [] !t & !fail & step=1 & G3_pursued=2 -> p3_2:(G3b_achieved'=true)&(step'=2) + (1-p3_2):(G3b_achievable'=false)&(fail'=true)&(step'=2);

  // outcomes of pursuing goal 4
  [] !t & !fail & step=2 & G4_pursued=0 -> 1:(step'=3);
  [] !t & !fail & step=2 & G4_pursued=1 -> p4_1:(G4a_achieved'=true)&(step'=3) + (1-p4_1):(G4a_achievable'=false)&(fail'=true)&(step'=3);
  [] !t & !fail & step=2 & G4_pursued=2 -> p4_2:(G4b_achieved'=true)&(step'=3) + (1-p4_2):(G4b_achievable'=false)&(fail'=true)&(step'=3);

  // outcomes of pursuing goal 2
  [] !t & !fail & step=3 & G5_pursued=0 -> 1:(step'=4);
  [] !t & !fail & step=3 & G5_pursued>0 -> p5:(G5_achieved'=true)&(step'=4) + (1-p5):(G5_achievable'=false)&(fail'=true)&(step'=4);
  
  // outcomes of pursuing goal 11
  [] !t & !fail & step=4 & G6_pursued=0 -> 1:(step'=5);
  [] !t & !fail & step=4 & G6_pursued=1 -> p6_1:(G6a_achieved'=true)&(step'=5) + (1-p6_1):(G6a_achievable'=false)&(fail'=true)&(step'=5);
  [] !t & !fail & step=4 & G6_pursued=2 -> p6_2:(G6b_achieved'=true)&(step'=5) + (1-p6_2):(G6b_achievable'=false)&(fail'=true)&(step'=5);

// Plan failure: inform Turn module and reset counter
  [changeMgmt_done] !t & fail -> 1:(fail'=false) & (step'=0); 

  // done
  [success] !t & !fail & step=5 -> (step'=step+1);
  [end] !t & step=6 -> (step'=6);

  // return to step 0
  //[controller_done] true -> 1:(step'=0);
endmodule

module Turn
  t : bool init true; // true - controller has the turn, false - goal model updating has the turn

  [controller_done] true -> 1:(t'=false);
  [changeMgmt_done] true -> 1:(t'=true);
endmodule


formula G0_achieved = (G1a_achieved | G1b_achieved) & (G6a_achieved | G6b_achieved);
formula G1a_achieved = G2_achieved & (G3a_achieved | G3b_achieved) & (G4a_achieved | G4b_achieved) & G5_achieved;
formula G1b_achieved = G3b_achieved;

rewards "utility"
  [success] G0_achieved : 20;
  [success] G1a_achieved : 12;
  [success] G1b_achieved : 0;
  [success] G2_achieved : 10;
  [success] G3a_achieved : 6;
  [success] G3b_achieved : 5;
  [success] G4a_achieved : 7;
  [success] G4b_achieved : 2;
  [success] G5_achieved : 6;
  [success] G6a_achieved : 10;
  [success] G6b_achieved : 6;
endrewards

rewards "cost"
  [success] G0_achieved : 0;
  [success] G1a_achieved : 0;
  [success] G1b_achieved : 0;
  [success] G2_achieved : 5;
  [success] G3a_achieved : 3;
  [success] G3b_achieved : 12;
  [success] G4a_achieved : 4;
  [success] G4b_achieved : 2;
  [success] G5_achieved : 5;
  [success] G6a_achieved : 3;
  [success] G6b_achieved : 2;
endrewards