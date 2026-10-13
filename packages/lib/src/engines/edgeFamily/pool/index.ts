/**
 * The Edge engines on the definition pool (edge and edgeV2): the goal
 * model, whose conditions use variables and resources, and
 * `variables.json`, which declares the variables and their types; and
 * #58's type rules over every condition.
 */
import {
  assertionUse,
  type AssertionType,
  type AssertionUse,
} from '../../assertionUses';
import { defineEngine, poolOf, type Check } from '../../../pool';
import { goalModel } from '../files/goalModel';
import { variables } from '../files/variables';

const numeric = (type: AssertionType) => type !== 'boolean';

/** #58's rule a use breaks, if any (a decimal on an int: a warning) */
const broken = (
  { shape, literal }: AssertionUse,
  type: AssertionType,
): [string, 'error' | 'warning'] | null =>
  shape === 'ordered' && !numeric(type)
    ? ['assertion-order-on-boolean', 'error']
    : shape === 'eqBool' && numeric(type)
      ? ['assertion-boolean-on-number', 'error']
      : shape === 'eqNumber' && !numeric(type)
        ? ['assertion-number-on-boolean', 'error']
        : shape === 'bare' && numeric(type)
          ? ['assertion-needs-boolean', 'error']
          : literal === 'decimal' && type === 'int'
            ? ['assertion-int-with-decimal', 'warning']
            : null;

/**
 * #58's type rules: an ordering on a boolean, = or != with the other type,
 * a bare variable or `!` on a number, an int compared with a decimal. A
 * name nothing defines gets none; an element without a type is a boolean.
 */
const assertionTypes: Check = (pool) =>
  pool.has('variables')
    ? pool.references('edge.variable').flatMap((reference) => {
        const use = assertionUse(reference);
        const target = reference.target;
        if (!use || !target) return [];
        const type = (target.type ??
          (target.kind === 'edge.variable' ? undefined : 'boolean')) as
          | AssertionType
          | undefined;
        const rule = type && broken(use, type);
        return rule
          ? [
              reference.problem(rule[1], rule[0], {
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
  messages: {
    'assertion-order-on-boolean':
      '{name} is a boolean: compare it with = or !=',
    'assertion-boolean-on-number':
      '{name} is a number ({type}): compare it with a number',
    'assertion-number-on-boolean':
      '{name} is a boolean: compare it with true or false',
    'assertion-needs-boolean':
      '{name} is a number ({type}): a condition needs a boolean',
    'assertion-int-with-decimal': '{name} is an int: compared with a decimal',
  },
});

export const edgePool = poolOf(edgeFamilyEngine);
export const edgeV2Pool = poolOf(edgeFamilyEngine);
