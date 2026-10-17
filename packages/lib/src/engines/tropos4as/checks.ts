/**
 * Tropos4AS's named checks: the properties' (the editors run them), each
 * an error about one goal. What crosses goals (a creation condition below
 * the root, a maintain-goal under an achieve-goal, an inhibition or
 * sequence cycle) is `tropos4asProblems`'s, in ./problems, with its
 * severity. Each reads the properties as the dialect does
 * (goal-controller#187): a value written with an error is unset, the
 * dialect's value check reports it.
 */
import { readProperties } from '@goal-controller/goal-language';
import type { Check } from '../checks';
import { tropos4as } from './definition';
import { ATTRIBUTE_TYPES, CONDITION_KEYS, isAttributeType } from './vocabulary';

/** A goal's properties, as the dialect reads them. */
const goal = (raw: Partial<Record<string, string>>) =>
  readProperties(tropos4as, { element: 'goal' }, raw).values;

/**
 * The names of Tropos4AS's checks: what a property's `check` may be
 * (listed, not derived from the registry: the checks read the dialect's
 * values, whose types are the dialect's own).
 */
export type Tropos4asCheckName =
  | 'tropos4as.goal.perform'
  | 'tropos4as.goal.target'
  | 'tropos4as.artifact.attributes';

export const tropos4asCheckRegistry: Readonly<
  Record<Tropos4asCheckName, Check>
> = {
  /** AAMAS 2009 §4.3.1, #134 D4: a perform-goal evaluates no condition */
  'tropos4as.goal.perform': ({ raw }) => {
    const values = goal(raw);
    if (values.type !== 'perform') return null;
    const written = CONDITION_KEYS.filter(
      (key) => key !== 'creation' && key !== 'precondition' && values[key],
    );
    return written.length
      ? `A perform-goal evaluates no condition (AAMAS 2009 §4.3.1): remove ${written.join(', ')}, or make it an achieve- or maintain-goal`
      : null;
  },
  /** §4.3.3: M(m, t, d) has a target only with its maintain condition */
  'tropos4as.goal.target': ({ raw }) => {
    const { target, maintain } = goal(raw);
    return target && !maintain
      ? 'A target condition needs a maintain condition (M(m, t, d), AAMAS 2009 §4.3.3)'
      : null;
  },
  /** an artifact's attributes: each `name:type`, a type the conditions can read */
  'tropos4as.artifact.attributes': ({ raw }) => {
    const wrong = (
      readProperties(tropos4as, { element: 'tropos4as.Artifact' }, raw).values
        .attributes ?? []
    ).filter(({ name, value }) => !name || !isAttributeType(value));
    return wrong.length
      ? `An attribute is name:type, the type ${ATTRIBUTE_TYPES.join(', ')} or its options (mode:wet|dry): not ${wrong.map(({ name, value }) => `${name}:${value}`).join(', ')}`
      : null;
  },
};
