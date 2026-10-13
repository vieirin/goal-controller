/**
 * The Edge engines on the definition pool (edge and edgeV2): the goal
 * model, whose conditions use variables and resources, and
 * `variables.json`, which declares the variables and their types; and
 * #58's type rules over every condition.
 */
import {
  assertionType,
  assertionUse,
  type AssertionType,
  type AssertionUse,
} from '../../assertionUses';
import { defineEngine, poolOf, type Check, type Severity } from '../../../pool';
import { goalModel } from '../files/goalModel';
import { variables } from '../files/variables';

const numeric = (type: AssertionType) => type !== 'bool';

type Rule = {
  check: string;
  severity: Severity;
  breaks: (use: AssertionUse, type: AssertionType) => boolean;
  message: string;
};

/** #58's rules, in the order they're tried: a use breaks the first that applies */
const RULES = [
  {
    check: 'assertion-order-on-boolean',
    severity: 'error',
    breaks: ({ shape }, type) => shape === 'ordered' && !numeric(type),
    message: '{name} is a boolean: compare it with = or !=',
  },
  {
    check: 'assertion-boolean-on-number',
    severity: 'error',
    breaks: ({ shape }, type) => shape === 'eqBool' && numeric(type),
    message: '{name} is a number ({type}): compare it with a number',
  },
  {
    check: 'assertion-number-on-boolean',
    severity: 'error',
    breaks: ({ shape }, type) => shape === 'eqNumber' && !numeric(type),
    message: '{name} is a boolean: compare it with true or false',
  },
  {
    check: 'assertion-needs-boolean',
    severity: 'error',
    breaks: ({ shape }, type) => shape === 'bare' && numeric(type),
    message: '{name} is a number ({type}): a condition needs a boolean',
  },
  {
    check: 'assertion-int-with-decimal',
    severity: 'warning',
    breaks: ({ literal }, type) => literal === 'decimal' && type === 'int',
    message: '{name} is an int: compared with a decimal',
  },
] as const satisfies readonly Rule[];

/** what #58's checks are called: their messages' keys */
export type AssertionCheck = (typeof RULES)[number]['check'];

/**
 * #58's type rules: an ordering on a boolean, = or != with the other type,
 * a bare variable or `!` on a number, an int compared with a decimal. A
 * name nothing defines gets none; a goal or a task is a bool.
 */
const assertionTypes: Check = (pool) =>
  pool.has('variables')
    ? pool.references('edge.variable').flatMap((reference) => {
        const use = assertionUse(reference);
        const target = reference.target;
        if (!use || !target) return [];
        const type =
          assertionType(target.type) ??
          (target.kind === 'edge.variable' ? undefined : 'bool');
        const rule = type && RULES.find((r) => r.breaks(use, type));
        return rule
          ? [
              reference.problem(rule.severity, rule.check, {
                name: reference.name,
                type,
              }),
            ]
          : [];
      })
    : [];

/** edge and edgeV2: the same files, kinds and checks */
export const edgeFamilyEngine = defineEngine({
  files: [goalModel, variables],
  kinds: {
    'gm.goal': { label: 'Goal', rename: false },
    'gm.task': { label: 'Task', rename: false },
    'gm.resource': { label: 'Resource', rename: false },
    'edge.variable': {
      label: 'Variable',
      // a JSON key: no quote or backslash
      rename: (name) => (/^[^"\\]+$/.test(name) ? name : null),
    },
  },
  checks: [assertionTypes],
  messages: Object.fromEntries(
    RULES.map(({ check, message }) => [check, message]),
  ),
});

export const edgePool = poolOf(edgeFamilyEngine);
export const edgeV2Pool = poolOf(edgeFamilyEngine);
