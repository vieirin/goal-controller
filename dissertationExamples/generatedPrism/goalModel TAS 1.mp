dtmc

const int decision_G2_t0_loc0;
const int decision_G2_t0_loc1;
const int decision_G2_t0_loc2;
const int decision_G2_t1_loc0;
const int decision_G2_t1_loc1;
const int decision_G2_t1_loc2;
const int decision_G2_t2_loc0;
const int decision_G2_t2_loc1;
const int decision_G2_t2_loc2;
const int decision_G2_t3_loc0;
const int decision_G2_t3_loc1;
const int decision_G2_t3_loc2;
const int decision_G2_t4_loc0;
const int decision_G2_t4_loc1;
const int decision_G2_t4_loc2;
const int decision_G2_t5_loc0;
const int decision_G2_t5_loc1;
const int decision_G2_t5_loc2;
const int decision_G2_t6_loc0;
const int decision_G2_t6_loc1;
const int decision_G2_t6_loc2;
const int decision_G2_t7_loc0;
const int decision_G2_t7_loc1;
const int decision_G2_t7_loc2;
const int decision_G2_t8_loc0;
const int decision_G2_t8_loc1;
const int decision_G2_t8_loc2;


module G0

  G0_pursued : [0..1] init 0;
  G0_achieved : [0..1] init 0;
  
  

  [pursue_G0] G0_pursued=0 & G0_achieved=0 -> (G0_pursued'=1);
  [pursue_G1] G0_pursued=1 & G0_achieved=0 -> true;
  [pursue_G2] G0_pursued=1 & G0_achieved=0 & G2_achieved_maintain -> true;

  [achieved_G0] G0_pursued=1 & (G1_achieved=1 & G2_achieved=1) -> (G0_pursued'=0) & (G0_achieved'=1);
  
  [skip_G0] G0_pursued=1 & G1_pursued=0 & G2_pursued=0 -> (G0_pursued'=0);

endmodule

module G1

  G1_pursued : [0..1] init 0;
  G1_achieved : [0..1] init 0;
  
  

  [pursue_G1] G1_pursued=0 & G1_achieved=0 -> (G1_pursued'=1);
  [pursue_G3] G1_pursued=1 & G1_achieved=0 & G4_pursued=0 & G4_failed >= 2 & G3_achieved_maintain -> true;
  [pursue_G4] G1_pursued=1 & G1_achieved=0 & G3_pursued=0 & G4_achieved_maintain -> true;

  [achieved_G1] G1_pursued=1 & (G3_achieved=1 | G4_achieved=1) -> (G1_pursued'=0) & (G1_achieved'=1);
  
  [skip_G1] G1_pursued=1 & G3_pursued=0 & G4_pursued=0 -> (G1_pursued'=0);

endmodule

module G2

  G2_pursued : [0..1] init 0;
  G2_achieved : [0..1] init 0;
  
  

  [pursue_G2] G2_pursued=0 & G2_achieved=0 & (G4_achieved=1) & patientTracking -> (G2_pursued'=1);
  [pursue_T2] G2_pursued=1 & G2_achieved=0 & (G4_achieved=1) & T3_pursued=0 & T2_achieved_maintain -> true;
  [pursue_T3] G2_pursued=1 & G2_achieved=0 & (G4_achieved=1) & T2_pursued=0 & T3_achieved_maintain -> true;

  [achieved_G2] G2_pursued=1 & (T2_achieved=1 | T3_achieved=1) -> (G2_pursued'=0) & (G2_achieved'=1);
  
  [skip_G2] G2_pursued=1 & T2_pursued=0 & T3_pursued=0 -> (G2_pursued'=0);

endmodule

formula G2_achieved_maintain = highPrecision;

module G3

  G3_pursued : [0..1] init 0;
  G3_achieved : [0..1] init 0;
  
  

  [pursue_G3] G3_pursued=0 & G3_achieved=0 & privacyEnabled | battery!=low -> (G3_pursued'=1);
  [pursue_G5] G3_pursued=1 & G3_achieved=0 -> true;

  [achieved_G3] G3_pursued=1 & (G5_achieved=1) -> (G3_pursued'=0) & (G3_achieved'=1);
  
  [skip_G3] G3_pursued=1 & G5_pursued=0 -> (G3_pursued'=0);

endmodule

module G4

  G4_pursued : [0..1] init 0;
  G4_achieved : [0..1] init 0;
  
  G4_failed : [0..10] init 0;

  [pursue_G4] G4_pursued=0 & G4_achieved=0 & enoughBattery & highReliability -> (G4_pursued'=1);
  [pursue_G6] G4_pursued=1 & G4_achieved=0 & G6_achieved=0 & G6_achieved_maintain -> true;
  [pursue_G7] G4_pursued=1 & G4_achieved=0 & G6_achieved=1 & G7_achieved=0 -> true;

  [achieved_G4] G4_pursued=1 & (G6_achieved=1 & G7_achieved=1) -> (G4_pursued'=0) & (G4_achieved'=1);
  
  [skip_G4] G4_pursued=1 & G6_pursued=0 & G7_pursued=0 -> (G4_pursued'=0);

endmodule

formula G4_achieved_maintain = inEmergency;

module G5

  G5_pursued : [0..1] init 0;
  G5_achieved : [0..1] init 0;
  
  

  [pursue_G5] G5_pursued=0 & G5_achieved=0 -> (G5_pursued'=1);
  [pursue_T1] G5_pursued=1 & G5_achieved=0 -> true;

  [achieved_G5] G5_pursued=1 & (T1_achieved=1) -> (G5_pursued'=0) & (G5_achieved'=1);
  
  [skip_G5] G5_pursued=1 & T1_pursued=0 -> (G5_pursued'=0);

endmodule

module G6

  G6_pursued : [0..1] init 0;
  G6_achieved : [0..1] init 0;
  
  

  [pursue_G6] G6_pursued=0 & G6_achieved=0 & sensorAvailable -> (G6_pursued'=1);
  [pursue_G8] G6_pursued=1 & G6_achieved=0 & G8_achieved=0 -> true;
  [pursue_G9] G6_pursued=1 & G6_achieved=0 & G8_achieved=1 & G9_achieved=0 -> true;

  [achieved_G6] G6_pursued=1 & (G8_achieved=1 & G9_achieved=1) -> (G6_pursued'=0) & (G6_achieved'=1);
  
  [skip_G6] G6_pursued=1 & G8_pursued=0 & G9_pursued=0 -> (G6_pursued'=0);

endmodule

formula G6_achieved_maintain = enoughBattery & highReliability;

module G7

  G7_pursued : [0..1] init 0;
  G7_achieved : [0..1] init 0;
  
  

  [pursue_G7] G7_pursued=0 & G7_achieved=0 -> (G7_pursued'=1);
  [pursue_G10] G7_pursued=1 & G7_achieved=0 & G10_achieved=0 & G10_achieved_maintain -> true;
  [pursue_G13] G7_pursued=1 & G7_achieved=0 & G10_achieved=1 & G13_achieved=0 & G13_achieved_maintain -> true;

  [achieved_G7] G7_pursued=1 & (G10_achieved=1 & G13_achieved=1) -> (G7_pursued'=0) & (G7_achieved'=1);
  
  [skip_G7] G7_pursued=1 & G10_pursued=0 & G13_pursued=0 -> (G7_pursued'=0);

endmodule

module G8

  G8_pursued : [0..1] init 0;
  G8_achieved : [0..1] init 0;
  
  

  [pursue_G8] G8_pursued=0 & G8_achieved=0 -> (G8_pursued'=1);
  [pursue_T2] G8_pursued=1 & G8_achieved=0 -> true;

  [achieved_G8] G8_pursued=1 & (T2_achieved=1) -> (G8_pursued'=0) & (G8_achieved'=1);
  
  [skip_G8] G8_pursued=1 & T2_pursued=0 -> (G8_pursued'=0);

endmodule

module G9

  G9_pursued : [0..1] init 0;
  G9_achieved : [0..1] init 0;
  
  

  [pursue_G9] G9_pursued=0 & G9_achieved=0 -> (G9_pursued'=1);
  [pursue_T4] G9_pursued=1 & G9_achieved=0 & T3_pursued=0 -> true;
  [pursue_T3] G9_pursued=1 & G9_achieved=0 & T4_pursued=0 & T4_failed >= 2 -> true;

  [achieved_G9] G9_pursued=1 & (T4_achieved=1 | T3_achieved=1) -> (G9_pursued'=0) & (G9_achieved'=1);
  
  [skip_G9] G9_pursued=1 & T4_pursued=0 & T3_pursued=0 -> (G9_pursued'=0);

endmodule

module G10

  G10_pursued : [0..1] init 0;
  G10_achieved : [0..1] init 0;
  
  

  [pursue_G10] G10_pursued=0 & G10_achieved=0 & (G9_achieved=1) & pharmacyAvailable & atHome -> (G10_pursued'=1);
  [pursue_G11] G10_pursued=1 & G10_achieved=0 & (G9_achieved=1) & G12_pursued=0 -> true;
  [pursue_G12] G10_pursued=1 & G10_achieved=0 & (G9_achieved=1) & G11_pursued=0 -> true;

  [achieved_G10] G10_pursued=1 & (G11_achieved=1 | G12_achieved=1) -> (G10_pursued'=0) & (G10_achieved'=1);
  
  [skip_G10] G10_pursued=1 & G11_pursued=0 & G12_pursued=0 -> (G10_pursued'=0);

endmodule

module G11

  G11_pursued : [0..1] init 0;
  G11_achieved : [0..1] init 0;
  
  

  [pursue_G11] G11_pursued=0 & G11_achieved=0 -> (G11_pursued'=1);
  [pursue_T5] G11_pursued=1 & G11_achieved=0 -> true;

  [achieved_G11] G11_pursued=1 & (T5_achieved=1) -> (G11_pursued'=0) & (G11_achieved'=1);
  
  [skip_G11] G11_pursued=1 & T5_pursued=0 -> (G11_pursued'=0);

endmodule

module G12

  G12_pursued : [0..1] init 0;
  G12_achieved : [0..1] init 0;
  
  

  [pursue_G12] G12_pursued=0 & G12_achieved=0 -> (G12_pursued'=1);
  [pursue_T7] G12_pursued=1 & G12_achieved=0 -> true;

  [achieved_G12] G12_pursued=1 & (T7_achieved=1) -> (G12_pursued'=0) & (G12_achieved'=1);
  
  [skip_G12] G12_pursued=1 & T7_pursued=0 -> (G12_pursued'=0);

endmodule

module G13

  G13_pursued : [0..1] init 0;
  G13_achieved : [0..1] init 0;
  
  

  [pursue_G13] G13_pursued=0 & G13_achieved=0 & medicationApplied -> (G13_pursued'=1);
  [pursue_G14] G13_pursued=1 & G13_achieved=0 & G14_achieved=0 & G14_achieved_maintain -> true;
  [pursue_G15] G13_pursued=1 & G13_achieved=0 & G14_achieved=1 & G15_achieved=0 & G15_achieved_maintain -> true;

  [achieved_G13] G13_pursued=1 & (G14_achieved=1 & G15_achieved=1) -> (G13_pursued'=0) & (G13_achieved'=1);
  
  [skip_G13] G13_pursued=1 & G14_pursued=0 & G15_pursued=0 -> (G13_pursued'=0);

endmodule

module G14

  G14_pursued : [0..1] init 0;
  G14_achieved : [0..1] init 0;
  
  

  [pursue_G14] G14_pursued=0 & G14_achieved=0 & medicationApplied -> (G14_pursued'=1);
  [pursue_T9] G14_pursued=1 & G14_achieved=0 -> true;

  [achieved_G14] G14_pursued=1 & (T9_achieved=1) -> (G14_pursued'=0) & (G14_achieved'=1);
  
  [skip_G14] G14_pursued=1 & T9_pursued=0 -> (G14_pursued'=0);

endmodule

formula G14_achieved_maintain = inSideEffectWindow;

module G15

  G15_pursued : [0..1] init 0;
  G15_achieved : [0..1] init 0;
  G15_chosen : [0..2] init 0;
  

  [pursue_G15] G15_pursued=0 & G15_achieved=0 & inEmergency -> (G15_pursued'=1);
  [pursue_T13] G15_pursued=1 & G15_achieved=0 & G15_chosen!=1 -> true;
  [pursue_T14] G15_pursued=1 & G15_achieved=0 & G15_chosen!=0 & T14_achieved_maintain -> true;

  [achieved_G15] G15_pursued=1 & (T13_achieved=1 | T14_achieved=1) -> (G15_pursued'=0) & (G15_achieved'=1);
  
  [skip_G15] G15_pursued=1 & T13_pursued=0 & T14_pursued=0 -> (G15_pursued'=0);

endmodule


module ChangeManager
  
  T1_pursued : [0..1] init 0;
  T1_achieved : [0..1] init 0;
  T13_pursued : [0..1] init 0;
  T13_achieved : [0..1] init 0;
  T14_pursued : [0..1] init 0;
  T14_achieved : [0..1] init 0;
  T2_pursued : [0..1] init 0;
  T2_achieved : [0..1] init 0;
  T3_pursued : [0..1] init 0;
  T3_achieved : [0..1] init 0;
  T4_pursued : [0..1] init 0;
  T4_achieved : [0..1] init 0;
  T4_failed: [0..8] init 0;
  T5_pursued : [0..1] init 0;
  T5_achieved : [0..1] init 0;
  T7_pursued : [0..1] init 0;
  T7_achieved : [0..1] init 0;
  T9_pursued : [0..1] init 0;
  T9_achieved : [0..1] init 0;
  
  [pursue_T1] true -> true;
  [achieved_T1] true -> true;
  [failed_T1] T1_pursued=1 & T1_achieved=0 -> (T1_pursued'=0);
  
  [pursue_T13] true -> true;
  [achieved_T13] true -> true;
  [failed_T13] T13_pursued=1 & T13_achieved=0 -> (T13_pursued'=0);
  
  [pursue_T14] true -> true;
  [achieved_T14] true -> true;
  [failed_T14] T14_pursued=1 & T14_achieved=0 -> (T14_pursued'=0);
  
  [pursue_T2] true -> true;
  [achieved_T2] true -> true;
  [failed_T2] T2_pursued=1 & T2_achieved=0 -> (T2_pursued'=0);
  
  [pursue_T3] true -> true;
  [achieved_T3] true -> true;
  [failed_T3] T3_pursued=1 & T3_achieved=0 -> (T3_pursued'=0);
  
  [pursue_T4] true -> true;
  [achieved_T4] true -> true;
  [failed_T4] T4_pursued=1 & T4_achieved=0 -> (T4_pursued'=0) & (T4_failed'=min(8, T4_failed+1));
  
  [pursue_T5] true -> true;
  [achieved_T5] true -> true;
  [failed_T5] T5_pursued=1 & T5_achieved=0 -> (T5_pursued'=0);
  
  [pursue_T7] true -> true;
  [achieved_T7] true -> true;
  [failed_T7] T7_pursued=1 & T7_achieved=0 -> (T7_pursued'=0);
  
  [pursue_T9] true -> true;
  [achieved_T9] true -> true;
  [failed_T9] T9_pursued=1 & T9_achieved=0 -> (T9_pursued'=0);
  
endmodule

module System
  pharmacyAvailable: bool init false;
  atHome: bool init false;
  medicationApplied: bool init false;
  inSideEffectWindow: bool init true;
  inEmergency: bool init true;
  highPrecision: bool init true;
  patientTracking: bool init false;
  privacyEnabled: bool init false;
  enoughBattery: bool init true;
  highReliability: bool init false;
  sensorAvailable: bool init false;
  R0: bool init true;
  R1: [0..100] init 50;
  R2: bool init false;
  R3: bool init true;
  R4: [0..100] init 50;
endmodule
