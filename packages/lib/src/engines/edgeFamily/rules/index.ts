/**
 * The Edge engines (edge, edgeV2) on the rule layer (goal-controller#75):
 * their conditions' variables, declared and typed by variables.json, and
 * #58's type rules on every use; a resource is the type it declares
 * (`{int 0..5 = 3}`), a boolean without one.
 */
import type { AnyDialect } from '@goal-controller/dialect';
import ASSERTION_RULES from '../../ruleFacts/assertions.rules';
import { ASSERTION_MESSAGES, assertionReader } from '../../ruleFacts/assertion';
import type { EngineRules } from '../../ruleFacts/engine';
import GOAL_MODEL_RULES from '../../ruleFacts/goalModel.rules';
import { GOAL_MODEL_KINDS, readGoalModel } from '../../ruleFacts/goalModel';
import { readVariables, VARIABLES_KINDS } from './variables';

export * from './variables';

/** An Edge engine's rules: its dialect's assertions, variables.json's variables. */
export const edgeFamilyRules = (
  engine: string,
  dialect: AnyDialect,
): EngineRules => ({
  engine,
  kinds: { ...GOAL_MODEL_KINDS, ...VARIABLES_KINDS },
  ruleFiles: [GOAL_MODEL_RULES, ASSERTION_RULES],
  messages: ASSERTION_MESSAGES,
  read: ({ model, resources }) => [
    ...(model
      ? readGoalModel(model, dialect, {
          // a resource's declared type (`bool` is a boolean)
          elementType: (node) =>
            node.properties.type === 'bool'
              ? 'boolean'
              : node.properties.type || undefined,
          field: assertionReader(dialect, { kind: 'edge.variable' }),
        })
      : []),
    ...resources.flatMap(({ kind, path, text }) =>
      kind === 'variables' ? [readVariables(path, text)] : [],
    ),
  ],
});
