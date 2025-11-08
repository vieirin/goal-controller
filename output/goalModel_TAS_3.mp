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
  [pursue_G2] G0_pursued=1 & G0_achieved=0 & G2_achieved_maintain=false -> true;

  [achieved_G0] G0_pursued=1 & (G1_achieved=1 & G2_achieved_maintain=true) -> (G0_pursued'=0) & (G0_achieved'=1);
  
  [skip_G0] G0_pursued=1 & G1_pursued=0 & G2_pursued=0 -> (G0_pursued'=0);
endmodule

formula G0_achievable = G1_achievable + G2_achievable - (G1_achievable * G2_achievable)

module G1
  G1_pursued : [0..1] init 0;
  G1_achieved : [0..1] init 0;
  G4_failed : [0..10] init 0;

  [pursue_G1] G1_pursued=0 & G1_achieved=0 -> (G1_pursued'=1);
  [pursue_G3] G1_pursued=1 & G1_achieved=0 & G1_pursued=0 & G4_failed >= 2 -> true;
  [pursue_G4] G1_pursued=1 & G1_achieved=0 & G1_pursued=0 & G4_achieved_maintain=false -> (G4_failed'=min(10, G4_failed+1));

  [achieved_G1] G1_pursued=1 & (G3_achieved=1 | G4_achieved_maintain=true) -> (G1_pursued'=0) & (G1_achieved'=1);
  
  [skip_G1] G1_pursued=1 & G3_pursued=0 & G4_pursued=0 -> (G1_pursued'=0);
endmodule

formula G1_achievable = G3_achievable + G4_achievable - (G3_achievable * G4_achievable)

module G2
  G2_pursued : [0..1] init 0;

  [pursue_G2] G2_pursued=0 & G2_achieved_maintain=false & (G4_achieved=1) & patientTracking -> (G2_pursued'=1);
  [pursue_G5] G2_pursued=1 & G2_achieved_maintain=false & G6_pursued=0 -> true;
  [pursue_G6] G2_pursued=1 & G2_achieved_maintain=false & G5_pursued=0 -> true;

  [achieved_G2] G2_pursued=1 & (G5_achieved=1 | G6_achieved=1) -> (G2_pursued'=0) & (G2_achieved'=1);
  
  [skip_G2] G2_pursued=1 & G5_pursued=0 & G6_pursued=0 -> (G2_pursued'=0);
endmodule

formula G2_achieved_maintain = highPrecision;
formula G2_achievable = G5_achievable + G6_achievable - (G5_achievable * G6_achievable)

module G3
  G3_pursued : [0..1] init 0;
  G3_achieved : [0..1] init 0;

  [pursue_G3] G3_pursued=0 & G3_achieved=0 & privacyEnabled -> (G3_pursued'=1);
  [pursue_G7] G3_pursued=1 & G3_achieved=0 -> true;

  [achieved_G3] G3_pursued=1 & (G7_achieved=1) -> (G3_pursued'=0) & (G3_achieved'=1);
  
  [skip_G3] G3_pursued=1 & G7_pursued=0 -> (G3_pursued'=0);
endmodule

formula G3_achievable = G7_achievable - (G7_achievable)

module G4
  G4_pursued : [0..1] init 0;

  [pursue_G4] G4_pursued=0 & G4_achieved_maintain=false & enoughBattery & highReliability -> (G4_pursued'=1);
  [pursue_G8] G4_pursued=1 & G4_achieved_maintain=false & G8_achieved_maintain=false -> true;
  [pursue_G9] G4_pursued=1 & G4_achieved_maintain=false & G8_achieved_maintain=true -> true;

  [achieved_G4] G4_pursued=1 & (G8_achieved_maintain=true & G9_achieved=1) -> (G4_pursued'=0) & (G4_achieved'=1);
  
  [skip_G4] G4_pursued=1 & G8_pursued=0 & G9_pursued=0 -> (G4_pursued'=0);
endmodule

formula G4_achieved_maintain = inEmergency;
formula G4_achievable = G8_achievable + G9_achievable - (G8_achievable * G9_achievable)

module G5
  G5_pursued : [0..1] init 0;
  G5_achieved : [0..1] init 0;

  [pursue_G5] G5_pursued=0 & G5_achieved=0 & privacyEnabled -> (G5_pursued'=1);
  [pursue_T2] G5_pursued=1 & G5_achieved=0 -> true;

  [achieved_G5] G5_pursued=1 & (T2_achieved=1) -> (G5_pursued'=0) & (G5_achieved'=1);
  
  [skip_G5] G5_pursued=1 & T2_pursued=0 -> (G5_pursued'=0);
endmodule

formula G5_achievable = T2_achievable - (T2_achievable)

module G6
  G6_pursued : [0..1] init 0;
  G6_achieved : [0..1] init 0;

  [pursue_G6] G6_pursued=0 & G6_achieved=0 & privacyEnabled=false -> (G6_pursued'=1);
  [pursue_T3] G6_pursued=1 & G6_achieved=0 -> true;

  [achieved_G6] G6_pursued=1 & (T3_achieved=1) -> (G6_pursued'=0) & (G6_achieved'=1);
  
  [skip_G6] G6_pursued=1 & T3_pursued=0 -> (G6_pursued'=0);
endmodule

formula G6_achievable = T3_achievable - (T3_achievable)

module G7
  G7_pursued : [0..1] init 0;
  G7_achieved : [0..1] init 0;

  [pursue_G7] G7_pursued=0 & G7_achieved=0 -> (G7_pursued'=1);
  [pursue_T1] G7_pursued=1 & G7_achieved=0 -> true;

  [achieved_G7] G7_pursued=1 & (T1_achieved=1) -> (G7_pursued'=0) & (G7_achieved'=1);
  
  [skip_G7] G7_pursued=1 & T1_pursued=0 -> (G7_pursued'=0);
endmodule

formula G7_achievable = T1_achievable - (T1_achievable)

module G8
  G8_pursued : [0..1] init 0;

  [pursue_G8] G8_pursued=0 & G8_achieved_maintain=false & sensorAvailable -> (G8_pursued'=1);
  [pursue_G10] G8_pursued=1 & G8_achieved_maintain=false & G10_achieved=0 -> true;
  [pursue_G11] G8_pursued=1 & G8_achieved_maintain=false & G10_achieved=1 -> true;

  [achieved_G8] G8_pursued=1 & (G10_achieved=1 & G11_achieved=1) -> (G8_pursued'=0) & (G8_achieved'=1);
  
  [skip_G8] G8_pursued=1 & G10_pursued=0 & G11_pursued=0 -> (G8_pursued'=0);
endmodule

formula G8_achieved_maintain = enoughBattery & highReliability;
formula G8_achievable = G10_achievable + G11_achievable - (G10_achievable * G11_achievable)

module G9
  G9_pursued : [0..1] init 0;
  G9_achieved : [0..1] init 0;

  [pursue_G9] G9_pursued=0 & G9_achieved=0 -> (G9_pursued'=1);
  [pursue_G13] G9_pursued=1 & G9_achieved=0 & G12_achieved=1 -> true;
  [pursue_G12] G9_pursued=1 & G9_achieved=0 & G12_achieved=0 -> true;

  [achieved_G9] G9_pursued=1 & (G13_achieved=1 & G12_achieved=1) -> (G9_pursued'=0) & (G9_achieved'=1);
  
  [skip_G9] G9_pursued=1 & G13_pursued=0 & G12_pursued=0 -> (G9_pursued'=0);
endmodule

formula G9_achievable = G13_achievable + G12_achievable - (G13_achievable * G12_achievable)

module G10
  G10_pursued : [0..1] init 0;
  G10_achieved : [0..1] init 0;

  [pursue_G10] G10_pursued=0 & G10_achieved=0 -> (G10_pursued'=1);
  [pursue_T4] G10_pursued=1 & G10_achieved=0 -> true;

  [achieved_G10] G10_pursued=1 & (T4_achieved=1) -> (G10_pursued'=0) & (G10_achieved'=1);
  
  [skip_G10] G10_pursued=1 & T4_pursued=0 -> (G10_pursued'=0);
endmodule

formula G10_achievable = T4_achievable - (T4_achievable)

module G11
  G11_pursued : [0..1] init 0;
  G11_achieved : [0..1] init 0;
  G11_chosen : [0..1] init 0;

  [pursue_G11] G11_pursued=0 & G11_achieved=0 -> (G11_pursued'=1);
  [pursue_G14] G11_pursued=1 & G11_achieved=0 & G11_chosen!=1 -> G11_chosen=0;
  [pursue_G15] G11_pursued=1 & G11_achieved=0 & G11_chosen!=0 -> G11_chosen=1;

  [achieved_G11] G11_pursued=1 & (G14_achieved=1 | G15_achieved=1) -> (G11_pursued'=0) & (G11_achieved'=1);
  
  [skip_G11] G11_pursued=1 & G14_pursued=0 & G15_pursued=0 -> (G11_pursued'=0);
endmodule

formula G11_achievable = G14_achievable + G15_achievable - (G14_achievable * G15_achievable)

module G12
  G12_pursued : [0..1] init 0;
  G12_achieved : [0..1] init 0;

  [pursue_G12] G12_pursued=0 & G12_achieved=0 & (G9_achieved=1) & pharmacyAvailable&atHome -> (G12_pursued'=1);
  [pursue_G16] G12_pursued=1 & G12_achieved=0 & G17_pursued=0 -> true;
  [pursue_G17] G12_pursued=1 & G12_achieved=0 & G16_pursued=0 -> true;

  [achieved_G12] G12_pursued=1 & (G16_achieved=1 | G17_achieved=1) -> (G12_pursued'=0) & (G12_achieved'=1);
  
  [skip_G12] G12_pursued=1 & G16_pursued=0 & G17_pursued=0 -> (G12_pursued'=0);
endmodule

formula G12_achievable = G16_achievable + G17_achievable - (G16_achievable * G17_achievable)

module G13
  G13_pursued : [0..1] init 0;
  G13_achieved : [0..1] init 0;

  [pursue_G13] G13_pursued=0 & G13_achieved=0 -> (G13_pursued'=1);
  [pursue_G18] G13_pursued=1 & G13_achieved=0 & G18_achieved_maintain=false -> true;
  [pursue_G19] G13_pursued=1 & G13_achieved=0 & G18_achieved_maintain=true -> true;

  [achieved_G13] G13_pursued=1 & (G18_achieved_maintain=true & G19_achieved=1) -> (G13_pursued'=0) & (G13_achieved'=1);
  
  [skip_G13] G13_pursued=1 & G18_pursued=0 & G19_pursued=0 -> (G13_pursued'=0);
endmodule

formula G13_achievable = G18_achievable + G19_achievable - (G18_achievable * G19_achievable)

module G14
  G14_pursued : [0..1] init 0;
  G14_achieved : [0..1] init 0;
  T5_failed : [0..8] init 0;

  [pursue_G14] G14_pursued=0 & G14_achieved=0 -> (G14_pursued'=1);
  [pursue_T5] G14_pursued=1 & G14_achieved=0 -> (T5_failed'=min(8, T5_failed+1));

  [achieved_G14] G14_pursued=1 & (T5_achieved=1) -> (G14_pursued'=0) & (G14_achieved'=1);
  
  [skip_G14] G14_pursued=1 & T5_pursued=0 -> (G14_pursued'=0);
endmodule

formula G14_achievable = T5_achievable - (T5_achievable)

module G15
  G15_pursued : [0..1] init 0;
  G15_achieved : [0..1] init 0;

  [pursue_G15] G15_pursued=0 & G15_achieved=0 -> (G15_pursued'=1);
  [pursue_T6] G15_pursued=1 & G15_achieved=0 -> true;

  [achieved_G15] G15_pursued=1 & (T6_achieved=1) -> (G15_pursued'=0) & (G15_achieved'=1);
  
  [skip_G15] G15_pursued=1 & T6_pursued=0 -> (G15_pursued'=0);
endmodule

formula G15_achievable = T6_achievable - (T6_achievable)

module G16
  G16_pursued : [0..1] init 0;
  G16_achieved : [0..1] init 0;

  [pursue_G16] G16_pursued=0 & G16_achieved=0 -> (G16_pursued'=1);
  [pursue_T7] G16_pursued=1 & G16_achieved=0 -> true;

  [achieved_G16] G16_pursued=1 & (T7_achieved=1) -> (G16_pursued'=0) & (G16_achieved'=1);
  
  [skip_G16] G16_pursued=1 & T7_pursued=0 -> (G16_pursued'=0);
endmodule

formula G16_achievable = T7_achievable - (T7_achievable)

module G17
  G17_pursued : [0..1] init 0;
  G17_achieved : [0..1] init 0;

  [pursue_G17] G17_pursued=0 & G17_achieved=0 -> (G17_pursued'=1);
  [pursue_T8] G17_pursued=1 & G17_achieved=0 -> true;

  [achieved_G17] G17_pursued=1 & (T8_achieved=1) -> (G17_pursued'=0) & (G17_achieved'=1);
  
  [skip_G17] G17_pursued=1 & T8_pursued=0 -> (G17_pursued'=0);
endmodule

formula G17_achievable = T8_achievable - (T8_achievable)

module G18
  G18_pursued : [0..1] init 0;

  [pursue_G18] G18_pursued=0 & G18_achieved_maintain=false & medicationApplied -> (G18_pursued'=1);
  [pursue_T9] G18_pursued=1 & G18_achieved_maintain=false -> true;

  [achieved_G18] G18_pursued=1 & (T9_achieved=1) -> (G18_pursued'=0) & (G18_achieved'=1);
  
  [skip_G18] G18_pursued=1 & T9_pursued=0 -> (G18_pursued'=0);
endmodule

formula G18_achieved_maintain = inSideEffectWindow;
formula G18_achievable = T9_achievable - (T9_achievable)

module G19
  G19_pursued : [0..1] init 0;
  G19_achieved : [0..1] init 0;
  G19_chosen : [0..1] init 0;

  [pursue_G19] G19_pursued=0 & G19_achieved=0 & inEmergency -> (G19_pursued'=1);
  [pursue_G20] G19_pursued=1 & G19_achieved=0 & G19_chosen!=1 -> G19_chosen=0;
  [pursue_G21] G19_pursued=1 & G19_achieved=0 & G19_chosen!=0 -> G19_chosen=1;

  [achieved_G19] G19_pursued=1 & (G20_achieved=1 | G21_achieved=1) -> (G19_pursued'=0) & (G19_achieved'=1);
  
  [skip_G19] G19_pursued=1 & G20_pursued=0 & G21_pursued=0 -> (G19_pursued'=0);
endmodule

formula G19_achievable = G20_achievable + G21_achievable - (G20_achievable * G21_achievable)

module G20
  G20_pursued : [0..1] init 0;
  G20_achieved : [0..1] init 0;

  [pursue_G20] G20_pursued=0 & G20_achieved=0 -> (G20_pursued'=1);
  [pursue_T10] G20_pursued=1 & G20_achieved=0 -> true;

  [achieved_G20] G20_pursued=1 & (T10_achieved=1) -> (G20_pursued'=0) & (G20_achieved'=1);
  
  [skip_G20] G20_pursued=1 & T10_pursued=0 -> (G20_pursued'=0);
endmodule

formula G20_achievable = T10_achievable - (T10_achievable)

module G21
  G21_pursued : [0..1] init 0;
  G21_achieved : [0..1] init 0;

  [pursue_G21] G21_pursued=0 & G21_achieved=0 -> (G21_pursued'=1);
  [pursue_T11] G21_pursued=1 & G21_achieved=0 -> true;

  [achieved_G21] G21_pursued=1 & (T11_achieved=1) -> (G21_pursued'=0) & (G21_achieved'=1);
  
  [skip_G21] G21_pursued=1 & T11_pursued=0 -> (G21_pursued'=0);
endmodule

formula G21_achievable = T11_achievable - (T11_achievable)


module ChangeManager
  T1_pursued: [0..1] init 0;
  T1_achieved: [0..1] init 0;
  T10_pursued: [0..1] init 0;
  T10_achieved: [0..1] init 0;
  T11_pursued: [0..1] init 0;
  T11_achieved: [0..1] init 0;
  T2_pursued: [0..1] init 0;
  T2_achieved: [0..1] init 0;
  T3_pursued: [0..1] init 0;
  T3_achieved: [0..1] init 0;
  T4_pursued: [0..1] init 0;
  T4_achieved: [0..1] init 0;
  T5_pursued: [0..1] init 0;
  T5_achieved: [0..1] init 0;
  T5_failed: [0..8] init 0;
  T6_pursued: [0..1] init 0;
  T6_achieved: [0..1] init 0;
  T7_pursued: [0..1] init 0;
  T7_achieved: [0..1] init 0;
  T8_pursued: [0..1] init 0;
  T8_achieved: [0..1] init 0;
  T9_pursued: [0..1] init 0;
  T9_achieved: [0..1] init 0;
  
  [pursue_T1] true -> true;
  [try_T1] T1_pursued=1 & T1_achieved=0 -> T1_achievable: (T1_achieved'=1) + 1-T1_achievable: (T1_pursued'=0);
  [achieved_T1] true -> true;
  [failed_T1] T1_pursued=1 & T1_achieved=0 -> (T1_pursued'=0);
  

  [pursue_T10] true -> true;
  [try_T10] T10_pursued=1 & T10_achieved=0 -> T10_achievable: (T10_achieved'=1) + 1-T10_achievable: (T10_pursued'=0);
  [achieved_T10] true -> true;
  [failed_T10] T10_pursued=1 & T10_achieved=0 -> (T10_pursued'=0);
  

  [pursue_T11] true -> true;
  [try_T11] T11_pursued=1 & T11_achieved=0 -> T11_achievable: (T11_achieved'=1) + 1-T11_achievable: (T11_pursued'=0);
  [achieved_T11] true -> true;
  [failed_T11] T11_pursued=1 & T11_achieved=0 -> (T11_pursued'=0);
  

  [pursue_T2] true -> true;
  [try_T2] T2_pursued=1 & T2_achieved=0 -> T2_achievable: (T2_achieved'=1) + 1-T2_achievable: (T2_pursued'=0);
  [achieved_T2] true -> true;
  [failed_T2] T2_pursued=1 & T2_achieved=0 -> (T2_pursued'=0);
  

  [pursue_T3] true -> true;
  [try_T3] T3_pursued=1 & T3_achieved=0 -> T3_achievable: (T3_achieved'=1) + 1-T3_achievable: (T3_pursued'=0);
  [achieved_T3] true -> true;
  [failed_T3] T3_pursued=1 & T3_achieved=0 -> (T3_pursued'=0);
  

  [pursue_T4] true -> true;
  [try_T4] T4_pursued=1 & T4_achieved=0 -> T4_achievable: (T4_achieved'=1) + 1-T4_achievable: (T4_pursued'=0);
  [achieved_T4] true -> true;
  [failed_T4] T4_pursued=1 & T4_achieved=0 -> (T4_pursued'=0);
  

  [pursue_T5] true -> true;
  [try_T5] T5_pursued=1 & T5_achieved=0 -> T5_achievable: (T5_achieved'=1) + 1-T5_achievable: (T5_pursued'=0);
  [achieved_T5] true -> true;
  [failed_T5] T5_pursued=1 & T5_achieved=0 -> (T5_pursued'=0) & (T5_failed'=min(8, T5_failed+1));
  

  [pursue_T6] true -> true;
  [try_T6] T6_pursued=1 & T6_achieved=0 -> T6_achievable: (T6_achieved'=1) + 1-T6_achievable: (T6_pursued'=0);
  [achieved_T6] true -> true;
  [failed_T6] T6_pursued=1 & T6_achieved=0 -> (T6_pursued'=0);
  

  [pursue_T7] true -> true;
  [try_T7] T7_pursued=1 & T7_achieved=0 -> T7_achievable: (T7_achieved'=1) + 1-T7_achievable: (T7_pursued'=0);
  [achieved_T7] true -> true;
  [failed_T7] T7_pursued=1 & T7_achieved=0 -> (T7_pursued'=0);
  

  [pursue_T8] true -> true;
  [try_T8] T8_pursued=1 & T8_achieved=0 -> T8_achievable: (T8_achieved'=1) + 1-T8_achievable: (T8_pursued'=0);
  [achieved_T8] true -> true;
  [failed_T8] T8_pursued=1 & T8_achieved=0 -> (T8_pursued'=0);
  

  [pursue_T9] true -> true;
  [try_T9] T9_pursued=1 & T9_achieved=0 -> T9_achievable: (T9_achieved'=1) + 1-T9_achievable: (T9_pursued'=0);
  [achieved_T9] true -> true;
  [failed_T9] T9_pursued=1 & T9_achieved=0 -> (T9_pursued'=0);
  
endmodule

module System
  pharmacyAvailable: bool init true;
  atHome: bool init false;
  inSideEffectWindow: bool init false;
  medicationApplied: bool init false;
  inEmergency: bool init false;
  highPrecision: bool init false;
  patientTracking: bool init false;
  privacyEnabled: bool init false;
  enoughBattery: bool init true;
  highReliability: bool init false;
  sensorAvailable: bool init true;
  R0: bool init MISSING_VARIABLE_DEFINITION;
  R1: [undefined..undefined] init MISSING_VARIABLE_DEFINITION;
  R2: [undefined..undefined] init MISSING_VARIABLE_DEFINITION;
  R3: bool init MISSING_VARIABLE_DEFINITION;
  R4: [undefined..undefined] init MISSING_VARIABLE_DEFINITION;
  R5: [undefined..undefined] init MISSING_VARIABLE_DEFINITION;
endmodule
