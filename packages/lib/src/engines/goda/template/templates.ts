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
  rewardEntry: 's$GID$ = 1 : $COST$;\n\t',
  evalFormula:
    '#!/bin/bash\n$PARAMS_BASH$\n\nsed  $REPLACE_BASH$ $1 |  gawk \'{print "scale=20;"$0}\' | bc\nexit 0;\n',
  frequency: true,
};
