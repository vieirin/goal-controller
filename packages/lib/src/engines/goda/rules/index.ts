/**
 * GODA on the rule layer (goal-controller#75): its context conditions
 * declare their variables by using them (#58). A variable is defined where
 * it is first used, every later use refers to it, and its type is what its
 * uses say: one used both as a boolean and as a number is an error on every
 * use (assertions.rls).
 */
import ASSERTION_RULES from '../../ruleFacts/assertions.rules';
import { ASSERTION_MESSAGES, assertionReader } from '../../ruleFacts/assertion';
import type { EngineRules } from '../../ruleFacts/engine';
import GOAL_MODEL_RULES from '../../ruleFacts/goalModel.rules';
import { GOAL_MODEL_KINDS, readGoalModel } from '../../ruleFacts/goalModel';
import { goda } from '../definition';

export const godaRules: EngineRules = {
  engine: 'goda',
  kinds: {
    ...GOAL_MODEL_KINDS,
    'gm.context': { label: 'context variable' },
  },
  ruleFiles: [GOAL_MODEL_RULES, ASSERTION_RULES],
  messages: ASSERTION_MESSAGES,
  read: ({ model }) =>
    model
      ? readGoalModel(model, goda, {
          // one reader per model read: it remembers the variables declared
          field: assertionReader(goda, { declaredByUse: true }),
        })
      : [],
};
