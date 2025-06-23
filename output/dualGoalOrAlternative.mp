dtmc



module G0
  G0_pursued : [0..1] init 0;
  G0_achieved : [0..1] init 0;
  

  [pursue_G0] G0_pursued=0 & G0_achieved=0 -> (G0_pursued'=1);
  [pursue_T0] G0_pursued=1 & T1_pursued=0 -> true;
  [pursue_T1] G0_pursued=1 & T0_pursued=0 -> true;

  [achieved_G0] G0_pursued=1 & (T0_achieved=1 | T1_achieved=1) -> (G0_pursued'=0) & (G0_achieved'=1);
  
  [skip_G0] G0_pursued=1 & T0_pursued=0 & T1_pursued=0 -> (G0_pursued'=0);
end module


module ChangeManager
  
  T0_pursued : [0..1] init 0;
  T0_achieved : [0..1] init 0;
  T1_pursued : [0..1] init 0;
  T1_achieved : [0..1] init 0;
  
  [pursue_T0] true -> true;
  [achieved_T0] true -> true;
  [failed_T0] T0_pursued=1 & T0_achieved=0 -> (T0_pursued'=0);
  
  [pursue_T1] true -> true;
  [achieved_T1] true -> true;
  [failed_T1] T1_pursued=1 & T1_achieved=0 -> (T1_pursued'=0);
  
endmodule

module System
  
endmodule
