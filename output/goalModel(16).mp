dtmc




module G0

  G0_pursued : [0..1] init 0;
  G0_achieved : [0..1] init 0;
  
  

  [pursue_G0] G0_pursued=0 & G0_achieved=0 -> (G0_pursued'=1);
  [pursue_G1] G0_pursued=1 & G0_achieved=0 & G1_achieved_maintain & sampleLoaded -> true;
  [pursue_G2] G0_pursued=1 & G0_achieved=0 -> true;

  [achieved_G0] G0_pursued=1 & (G1_achieved=1 & G2_achieved=1) -> (G0_pursued'=0) & (G0_achieved'=1);
  
  [skip_G0] G0_pursued=1 & G1_pursued=0 & G2_pursued=0 -> (G0_pursued'=0);

endmodule

module G1

  G1_pursued : [0..1] init 0;
  G1_achieved : [0..1] init 0;
  
  

  [pursue_G1] G1_pursued=0 & G1_achieved=0 & sampleLoaded & sampleLoaded -> (G1_pursued'=1);
  [pursue_T1] G1_pursued=1 & G1_achieved=0 & T1_achieved_maintain & R0=true -> true;

  [achieved_G1] G1_pursued=1 & (T1_achieved=1) -> (G1_pursued'=0) & (G1_achieved'=1);
  
  [skip_G1] G1_pursued=1 & T1_pursued=0 -> (G1_pursued'=0);

endmodule

formula G1_achieved_maintain = sampleLoaded;

module G2

  G2_pursued : [0..1] init 0;
  G2_achieved : [0..1] init 0;
  
  

  [pursue_G2] G2_pursued=0 & G2_achieved=0 -> (G2_pursued'=1);
  [pursue_G13] G2_pursued=1 & G2_achieved=0 & G13_achieved=0 -> true;
  [pursue_G6] G2_pursued=1 & G2_achieved=0 & G13_achieved=1 & G6_achieved=0 -> true;

  [achieved_G2] G2_pursued=1 & (G13_achieved=1 & G6_achieved=1) -> (G2_pursued'=0) & (G2_achieved'=1);
  
  [skip_G2] G2_pursued=1 & G13_pursued=0 & G6_pursued=0 -> (G2_pursued'=0);

endmodule

module G3

  G3_pursued : [0..1] init 0;
  G3_achieved : [0..1] init 0;
  
  

  [pursue_G3] G3_pursued=0 & G3_achieved=0 -> (G3_pursued'=1);
  [pursue_G5] G3_pursued=1 & G3_achieved=0 & G5_achieved=0 -> true;

  [achieved_G3] G3_pursued=1 & (G5_achieved=1) -> (G3_pursued'=0) & (G3_achieved'=1);
  
  [skip_G3] G3_pursued=1 & G5_pursued=0 -> (G3_pursued'=0);

endmodule

module G4

  G4_pursued : [0..1] init 0;
  G4_achieved : [0..1] init 0;
  
  

  [pursue_G4] G4_pursued=0 & G4_achieved=0 -> (G4_pursued'=1);
  [pursue_T2] G4_pursued=1 & G4_achieved=0 & T2_achieved=0 & T2_achieved_maintain & R2=true -> true;

  [achieved_G4] G4_pursued=1 & (T2_achieved=1) -> (G4_pursued'=0) & (G4_achieved'=1);
  
  [skip_G4] G4_pursued=1 & T2_pursued=0 -> (G4_pursued'=0);

endmodule

module G5

  G5_pursued : [0..1] init 0;
  G5_achieved : [0..1] init 0;
  
  

  [pursue_G5] G5_pursued=0 & G5_achieved=0 -> (G5_pursued'=1);
  [pursue_G7] G5_pursued=1 & G5_achieved=0 & G7_achieved=0 -> true;
  [pursue_G8] G5_pursued=1 & G5_achieved=0 & G7_achieved=1 & G9_achieved=0 -> true;
  [pursue_G9] G5_pursued=1 & G5_achieved=0 & G7_achieved=1 & G9_achieved=0 -> true;

  [achieved_G5] G5_pursued=1 & (G7_achieved=1 & G8_achieved=1 & G9_achieved=1) -> (G5_pursued'=0) & (G5_achieved'=1);
  
  [skip_G5] G5_pursued=1 & G7_pursued=0 & G8_pursued=0 & G9_pursued=0 -> (G5_pursued'=0);

endmodule

module G6

  G6_pursued : [0..1] init 0;
  G6_achieved : [0..1] init 0;
  
  

  [pursue_G6] G6_pursued=0 & G6_achieved=0 -> (G6_pursued'=1);
  [pursue_G10] G6_pursued=1 & G6_achieved=0 & G10_achieved=0 -> true;
  [pursue_G11] G6_pursued=1 & G6_achieved=0 & G10_achieved=1 & G12_achieved=0 & G11_achieved_maintain & sampleLoaded -> true;
  [pursue_G12] G6_pursued=1 & G6_achieved=0 & G10_achieved=1 & G12_achieved=0 -> true;

  [achieved_G6] G6_pursued=1 & (G10_achieved=1 & G11_achieved=1 & G12_achieved=1) -> (G6_pursued'=0) & (G6_achieved'=1);
  
  [skip_G6] G6_pursued=1 & G10_pursued=0 & G11_pursued=0 & G12_pursued=0 -> (G6_pursued'=0);

endmodule

module G7

  G7_pursued : [0..1] init 0;
  G7_achieved : [0..1] init 0;
  
  

  [pursue_G7] G7_pursued=0 & G7_achieved=0 -> (G7_pursued'=1);
  [pursue_T2] G7_pursued=1 & G7_achieved=0 & T2_achieved_maintain & R1>60 -> true;

  [achieved_G7] G7_pursued=1 & (T2_achieved=1) -> (G7_pursued'=0) & (G7_achieved'=1);
  
  [skip_G7] G7_pursued=1 & T2_pursued=0 -> (G7_pursued'=0);

endmodule

module G8

  G8_pursued : [0..1] init 0;
  G8_achieved : [0..1] init 0;
  
  

  [pursue_G8] G8_pursued=0 & G8_achieved=0 -> (G8_pursued'=1);
  [pursue_T3] G8_pursued=1 & G8_achieved=0 & T3_achieved_maintain & R1>=20 -> true;

  [achieved_G8] G8_pursued=1 & (T3_achieved=1) -> (G8_pursued'=0) & (G8_achieved'=1);
  
  [skip_G8] G8_pursued=1 & T3_pursued=0 -> (G8_pursued'=0);

endmodule

module G9

  G9_pursued : [0..1] init 0;
  G9_achieved : [0..1] init 0;
  
  

  [pursue_G9] G9_pursued=0 & G9_achieved=0 -> (G9_pursued'=1);
  [pursue_T3] G9_pursued=1 & G9_achieved=0 & T3_achieved_maintain & R1>50&R2=true -> true;

  [achieved_G9] G9_pursued=1 & (T3_achieved=1) -> (G9_pursued'=0) & (G9_achieved'=1);
  
  [skip_G9] G9_pursued=1 & T3_pursued=0 -> (G9_pursued'=0);

endmodule

module G10

  G10_pursued : [0..1] init 0;
  G10_achieved : [0..1] init 0;
  
  

  [pursue_G10] G10_pursued=0 & G10_achieved=0 -> (G10_pursued'=1);
  [pursue_T4] G10_pursued=1 & G10_achieved=0 & T4_achieved_maintain & R1>=50 -> true;

  [achieved_G10] G10_pursued=1 & (T4_achieved=1) -> (G10_pursued'=0) & (G10_achieved'=1);
  
  [skip_G10] G10_pursued=1 & T4_pursued=0 -> (G10_pursued'=0);

endmodule

module G11

  G11_pursued : [0..1] init 0;
  G11_achieved : [0..1] init 0;
  
  

  [pursue_G11] G11_pursued=0 & G11_achieved=0 & sampleLoaded & sampleLoaded -> (G11_pursued'=1);
  [pursue_T5] G11_pursued=1 & G11_achieved=0 & T5_achieved=0 & T5_achieved_maintain & sample=true -> true;
  [pursue_T6] G11_pursued=1 & G11_achieved=0 & T5_achieved=1 & T6_achieved=0 & T6_achieved_maintain & R2=true -> true;

  [achieved_G11] G11_pursued=1 & (T5_achieved=1 & T6_achieved=1) -> (G11_pursued'=0) & (G11_achieved'=1);
  
  [skip_G11] G11_pursued=1 & T5_pursued=0 & T6_pursued=0 -> (G11_pursued'=0);

endmodule

formula G11_achieved_maintain = analysisEnded;

module G12

  G12_pursued : [0..1] init 0;
  G12_achieved : [0..1] init 0;
  
  

  [pursue_G12] G12_pursued=0 & G12_achieved=0 -> (G12_pursued'=1);
  [pursue_T7] G12_pursued=1 & G12_achieved=0 & T7_achieved_maintain & R1>30 -> true;

  [achieved_G12] G12_pursued=1 & (T7_achieved=1) -> (G12_pursued'=0) & (G12_achieved'=1);
  
  [skip_G12] G12_pursued=1 & T7_pursued=0 -> (G12_pursued'=0);

endmodule

module G13

  G13_pursued : [0..1] init 0;
  G13_achieved : [0..1] init 0;
  
  

  [pursue_G13] G13_pursued=0 & G13_achieved=0 -> (G13_pursued'=1);
  [pursue_G3] G13_pursued=1 & G13_achieved=0 & G4_pursued=0 -> true;
  [pursue_G4] G13_pursued=1 & G13_achieved=0 & G3_pursued=0 -> true;

  [achieved_G13] G13_pursued=1 & (G3_achieved=1 | G4_achieved=1) -> (G13_pursued'=0) & (G13_achieved'=1);
  
  [skip_G13] G13_pursued=1 & G3_pursued=0 & G4_pursued=0 -> (G13_pursued'=0);

endmodule


module ChangeManager
  
  T1_pursued : [0..1] init 0;
  T1_achieved : [0..1] init 0;
  T2_pursued : [0..1] init 0;
  T2_achieved : [0..1] init 0;
  T3_pursued : [0..1] init 0;
  T3_achieved : [0..1] init 0;
  T4_pursued : [0..1] init 0;
  T4_achieved : [0..1] init 0;
  T5_pursued : [0..1] init 0;
  T5_achieved : [0..1] init 0;
  T6_pursued : [0..1] init 0;
  T6_achieved : [0..1] init 0;
  T7_pursued : [0..1] init 0;
  T7_achieved : [0..1] init 0;
  
  [pursue_T1] true -> true;
  [achieved_T1] true -> true;
  [failed_T1] T1_pursued=1 & T1_achieved=0 -> (T1_pursued'=0);
  
  [pursue_T2] true -> true;
  [achieved_T2] true -> true;
  [failed_T2] T2_pursued=1 & T2_achieved=0 -> (T2_pursued'=0);
  
  [pursue_T3] true -> true;
  [achieved_T3] true -> true;
  [failed_T3] T3_pursued=1 & T3_achieved=0 -> (T3_pursued'=0);
  
  [pursue_T4] true -> true;
  [achieved_T4] true -> true;
  [failed_T4] T4_pursued=1 & T4_achieved=0 -> (T4_pursued'=0);
  
  [pursue_T5] true -> true;
  [achieved_T5] true -> true;
  [failed_T5] T5_pursued=1 & T5_achieved=0 -> (T5_pursued'=0);
  
  [pursue_T6] true -> true;
  [achieved_T6] true -> true;
  [failed_T6] T6_pursued=1 & T6_achieved=0 -> (T6_pursued'=0);
  
  [pursue_T7] true -> true;
  [achieved_T7] true -> true;
  [failed_T7] T7_pursued=1 & T7_achieved=0 -> (T7_pursued'=0);
  
endmodule

module System
  sampleLoaded: bool init false;
  analysisEnded: bool init false;
  R0: bool init true;
  R1: [0..100] init 100;
  R2: bool init true;
endmodule
