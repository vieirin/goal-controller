dtmc

module G0
  G0pursued: [0..1] init 0;
  G0achieved: [0..1] init 0;

  [pursueG0] G0pursued=0 & G0achieved=0 -> (G0pursued'=1);

  [pursueG1] G0pursued=1 -> true;
  [pursueG2] G0pursued=1 & outside -> true;
  [pursue_maintain] G0pursued=1 & !achieved_maintain -> true;
endmodule

formula achieved_maintain = outside=true;

module G1
  G1pursued: [0..1] init 0;
  G1achieved: [0..1] init 0;

  [pursueG1] G1pursued=0 & G1achieved=0 -> (G1pursued'=1);
  ## how do we define the number of failed goals threshold?
  [pursueG3] G1pursued=1 & G4pursued=0 & G4failed > 1 -> true;
  [pursueG4] G1pursued=1 & G3pursued=0 -> true;

  [achievedG1] G1pursued=1 & (G3achieved=1 | G4achieved=1) -> (G1pursued'=0) & (G1achieved'=1);
  [skipG1] G1pursued=1 -> (G1pursued'=0);
endmodule

module G3
  G3pursued: [0..1] init 0;
  G3achieved: [0..1] init 0;

  [pursueG3] G3pursued=0 & G3achieved=0 -> (G3pursued'=1);
  [achievedG3] G3pursued=1 -> (G3pursued'=0) & (G3achieved'=1);
  [skipG3] G3pursued=1 -> (G3pursued'=0);
endmodule

module G4
  G4pursued: [0..1] init 0;
  G4achieved: [0..1] init 0;
  G4failed: [0..10] init 0;

  [pursueG4] G4pursued=0 & G4achieved=0 -> (G4pursued'=1);
  [achievedG4] G4pursued=1 -> (G4pursued'=0) & (G4achieved'=1);
  [skipG4] G4pursued=1 -> (G4pursued'=0);
  [pursueG6] G4pursued=1 & G6achieved=0 -> true;
  [pursueG7] G4pursued=1 & G6achieved=1 -> true;
endmodule

module G2
  G2pursued: [0..1] init 0;
  G2achieved: [0..1] init 0;

  [pursueG2] G2pursued=0 & G2achieved=0 & outside=true -> (G2pursued'=1);
endmodule

module G10
  G10pursued: [0..1] init 0;

  [pursueG10]  G10pursued=0 -> (G10pursued'=1);
  [pursueG11]  G10pursued=1 & G12pursued=0 & G12achieved=0 -> true;
  [pursueG12]  G10pursued=1 & G11pursued=0 & G11achieved=0 -> true;
endmodule

module ChangeManager
  [pursueT1] true -> true;
  [achievedT1] true -> true;
endmodule

module System
  outside: bool init false;
endmodule
