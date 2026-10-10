/**
 * The generator's templates (`src/main/resources/TemplateInput/PRISM/`), as
 * one version of the generator has them, byte for byte.
 */

export type GodaTemplates = {
  header: string;
  body: string;
  reward: string;
  leafGoal: string;
  and: string;
  /** a leaf's start under a context: skipped when it doesn't hold (`$CTX_GID$`) */
  ctxSkip: string;
  /** a context's constant, for a leaf no decision-making module sets */
  ctxHeader: string;
  /** the decision-making module of an element with a DM annotation */
  nondeterminism: string;
  /** one combination of its contexts: its constant, and its choice in the module */
  ndHeader: string;
  ndBody: string;
  /** an optional leaf's start (`$IF_CTX$`: its context factor, when it has one) */
  opt: string;
  /** an optional leaf's declaration of its optionality */
  optHeader: string;
  rewardEntry: string;
  evalFormula: string;
  /** whether a leaf has a frequency parameter `F_` (in its module and its formula) */
  frequency: boolean;
};

/** cc808b6's (2019-01): a leaf has a frequency parameter `F_`. */
export const CC808B6_TEMPLATES: GodaTemplates = {
  header: 'mdp\n',
  body: '$GOAL_MODULES$\n',
  reward: 'rewards "cost"\n\t$REWARD_STRUCTURE$\nendrewards\n',
  // as the file is: its lines end with CRLF (the other templates' with LF)
  leafGoal:
    "$DEC_HEADER$$CONST_PARAM$ double R_$GID$;\r\n$CONST_PARAM$ double F_$GID$;\r\n\r\nmodule $MODULE_NAME$\r\n\ts$GID$ :[0..4] init 0;\r\n\t\r\n\t$DEC_TYPE$\r\n\t[] s$GID$ =  1 -> R_$GID$ : (s$GID$'=2) + (1 - R_$GID$) : (s$GID$'=4);//running to final state\r\n\t[next$TIME_SLOT$] s$GID$ = 2 -> (s$GID$'=2);//final state success\r\n\t[next$TIME_SLOT$] s$GID$ = 3 -> (s$GID$'=3);//final state skipped\r\n\t[next$TIME_SLOT$] s$GID$ = 4 -> (s$GID$'=4);//final state failure\r\nendmodule\r\n",
  and: "[next$PREV_TIME_SLOT$] s$GID$ = 0 -> F_$GID$ : (s$GID$'=1) + (1 - F_$GID$) : (s$GID$'=3); //init to running or skip\n",
  ctxSkip:
    "[next$PREV_TIME_SLOT$] s$GID$ = 0 -> F_$GID$*$CTX_GID$ : (s$GID$'=1) + (1 - F_$GID$*$CTX_GID$) : (s$GID$'=3); //init to running or skip\r\n",
  ctxHeader: 'const int CTX_$GID$;\r\n',
  nondeterminism:
    "$DEC_HEADER$\r\n\r\nmodule NonDeterminism_$GID$\r\n\ts$GID$ :[0..$MAX_ND$] init 0;\r\n\t\r\n\t[next$PREV_TIME_SLOT$] s$GID$ = 0 -> (s$GID$'= 1);\r\n\r\n\t$DEC_TYPE$\r\n\t[] s$GID$ = 1 -> (s$GID$'=$MAX_ND$); //no uncertainty holding\r\n\r\n$FINAL_TYPE$\r\n\t \r\n\t[next$TIME_SLOT$] s$GID$ = $MAX_ND$ -> (s$GID$'=$MAX_ND$);\r\nendmodule\r\n",
  ndHeader: 'const int CTX_$N$;',
  ndBody:
    "[] s$GID$ = 1 -> CTX_$N$ : (s$GID$'= $NEXT_STATE$)  + (1 - CTX_$N$) : (s$GID$'=1);\n",
  opt: "[next$PREV_TIME_SLOT$] s$GID$ = 0 -> F_$GID$*OPT_$GID$$IF_CTX$ : (s$GID$'=1) + (1 - F_$GID$*OPT_$GID$$IF_CTX$) : (s$GID$'=3); //init to running or skip\r\n",
  optHeader: 'const int OPT_$GID$;\r\n',
  rewardEntry: 's$GID$ = 1 : $COST$;\n\t',
  evalFormula:
    '#!/bin/bash\n$PARAMS_BASH$\n\nsed  $REPLACE_BASH$ $1 |  gawk \'{print "scale=20;"$0}\' | bc\nexit 0;\n',
  frequency: true,
};

/**
 * 5305bc1's (2019-07): no frequency parameter; a leaf's start is guarded by
 * its previous sibling's success (`$PREV_SUCCESS$`), with a skip when it
 * failed (`$PREV_EFFECT$`); a decision-making module of three states.
 */
export const JULY_2019_TEMPLATES: GodaTemplates = {
  header: 'mdp\n',
  body: '$GOAL_MODULES$\n',
  reward: 'rewards "cost"\n\t$REWARD_STRUCTURE$\nendrewards\n',
  leafGoal:
    "$DEC_HEADER$$CONST_PARAM$ double R_$GID$;\r\nmodule $MODULE_NAME$\r\n\ts$GID$ :[0..4] init 0;\r\n\t\r\n\t$DEC_TYPE$\r\n\t[] s$GID$ =  1 -> R_$GID$ : (s$GID$'=2) + (1 - R_$GID$) : (s$GID$'=4);//running to final state\r\n\t[next$TIME_SLOT$] s$GID$ = 2 -> (s$GID$'=2);//final state success\r\n\t[next$TIME_SLOT$] s$GID$ = 3 -> (s$GID$'=3);//final state skipped\r\n\t[next$TIME_SLOT$] s$GID$ = 4 -> (s$GID$'=4);//final state failure\r\nendmodule\r\n",
  and: "[next$PREV_TIME_SLOT$] $PREV_SUCCESS$s$GID$ = 0 -> (s$GID$'=1);//init to running\n\t$PREV_EFFECT$\n",
  ctxSkip:
    "[next$PREV_TIME_SLOT$] $PREV_SUCCESS$s$GID$ = 0 -> $CTX_GID$ : (s$GID$'=1) + (1 - $CTX_GID$) : (s$GID$'=3); //init to running or skip\r\n\t$PREV_EFFECT$\r\n",
  ctxHeader: 'const int CTX_$GID$;\r\n',
  nondeterminism:
    "$DEC_HEADER$\r\n\r\nmodule NonDeterminism_$GID$\r\n\ts$GID$ :[0..2] init 0;\r\n\t\r\n\t[next$PREV_TIME_SLOT$] s$GID$ = 0 -> (s$GID$'= 1);\r\n\r\n\t$DEC_TYPE$\r\n\t[] s$GID$ = 1 -> (s$GID$'=2); //no uncertainty holding\r\n\t \r\n\t[next$TIME_SLOT$] s$GID$ = 2 -> (s$GID$'=2);\r\nendmodule\r\n",
  ndHeader: 'const int CTX_$N$;',
  ndBody:
    "[] s$GID$ = 1 -> CTX_$N$ : (s$GID$'= 2)$CONTEXT_UPDATE$ + (1 - CTX_$N$) : (s$GID$'=1);\n",
  opt: "[next$PREV_TIME_SLOT$] $PREV_SUCCESS$s$GID$ = 0 -> OPT_$GID$$IF_CTX$ : (s$GID$'=1) + (1 - OPT_$GID$$IF_CTX$) : (s$GID$'=3); //init to running or skip\r\n\t$PREV_EFFECT$\r\n",
  optHeader: 'const int OPT_$GID$;\r\n',
  rewardEntry: 's$GID$ = 1 : $COST$;\n\t',
  evalFormula:
    '#!/bin/bash\n$PARAMS_BASH$\n\nsed  $REPLACE_BASH$ $1 |  gawk \'{print "scale=20;"$0}\' | bc\nexit 0;\n',
  frequency: false,
};

/** 5305bc1's `pattern_prev_failure.nm`: the skip of a leaf whose previous sibling didn't succeed. */
export const JULY_2019_PREV_FAILURE =
  "[next$PREV_TIME_SLOT$] $PREV_SUCCESS_EFFECT$s$GID$ = 0 -> (s$GID$'=3);//init to skip";
