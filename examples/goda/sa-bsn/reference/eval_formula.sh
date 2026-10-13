#!/bin/bash
CTX_G3_T1_1="1";
W_G3_T1_1="1";
R_G3_T1_1="0.99";
F_G3_T1_1="0.99";
CTX_G3_T1_2="1";
W_G3_T1_2="1";
R_G3_T1_2="0.99";
F_G3_T1_2="0.99";
CTX_G3_T1_3="1";
W_G3_T1_3="1";
R_G3_T1_3="0.99";
F_G3_T1_3="0.99";
CTX_G3_T1_4="1";
W_G3_T1_4="1";
R_G3_T1_4="0.99";
F_G3_T1_4="0.99";
CTX_G3_T1_5="1";
W_G3_T1_5="1";
R_G3_T1_5="0.99";
F_G3_T1_5="0.99";
CTX_G3_T1_6="1";
W_G3_T1_6="1";
R_G3_T1_6="0.99";
F_G3_T1_6="0.99";
CTX_G4_T1="1";
W_G4_T1="1";
R_G4_T1="0.99";
F_G4_T1="0.99";


sed   -e "s/CTX_G3_T1_1/$CTX_G3_T1_1/g" -e "s/W_G3_T1_1/$W_G3_T1_1/g" -e "s/R_G3_T1_1/$R_G3_T1_1/g" -e "s/F_G3_T1_1/$F_G3_T1_1/g" -e "s/CTX_G3_T1_2/$CTX_G3_T1_2/g" -e "s/W_G3_T1_2/$W_G3_T1_2/g" -e "s/R_G3_T1_2/$R_G3_T1_2/g" -e "s/F_G3_T1_2/$F_G3_T1_2/g" -e "s/CTX_G3_T1_3/$CTX_G3_T1_3/g" -e "s/W_G3_T1_3/$W_G3_T1_3/g" -e "s/R_G3_T1_3/$R_G3_T1_3/g" -e "s/F_G3_T1_3/$F_G3_T1_3/g" -e "s/CTX_G3_T1_4/$CTX_G3_T1_4/g" -e "s/W_G3_T1_4/$W_G3_T1_4/g" -e "s/R_G3_T1_4/$R_G3_T1_4/g" -e "s/F_G3_T1_4/$F_G3_T1_4/g" -e "s/CTX_G3_T1_5/$CTX_G3_T1_5/g" -e "s/W_G3_T1_5/$W_G3_T1_5/g" -e "s/R_G3_T1_5/$R_G3_T1_5/g" -e "s/F_G3_T1_5/$F_G3_T1_5/g" -e "s/CTX_G3_T1_6/$CTX_G3_T1_6/g" -e "s/W_G3_T1_6/$W_G3_T1_6/g" -e "s/R_G3_T1_6/$R_G3_T1_6/g" -e "s/F_G3_T1_6/$F_G3_T1_6/g" -e "s/CTX_G4_T1/$CTX_G4_T1/g" -e "s/W_G4_T1/$W_G4_T1/g" -e "s/R_G4_T1/$R_G4_T1/g" -e "s/F_G4_T1/$F_G4_T1/g" $1 |  gawk '{print "scale=20;"$0}' | bc
exit 0;

