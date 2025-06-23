dtmc

module simple_coin

  state : [0..1] init 0;

  [] state=0 -> 0.5 : (state'=0) + 0.5 : (state'=1);

endmodule