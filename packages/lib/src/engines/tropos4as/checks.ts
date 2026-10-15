/**
 * Tropos4AS's named checks: the properties' (the editors run them), each
 * an error about one goal. What crosses goals (a creation condition below
 * the root, a maintain-goal under an achieve-goal, an inhibition or
 * sequence cycle) is `tropos4asProblems`'s, in ./problems, with its
 * severity.
 */
import { checks } from '../checks';
import { pairItems } from '../elementText';
import { ATTRIBUTE_TYPES, CONDITION_KEYS, isAttributeType } from './vocabulary';

const set = (value: string | undefined) => Boolean(value?.trim());

export const tropos4asCheckRegistry = checks({
  /** AAMAS 2009 §4.3.1, #134 D4: a perform-goal evaluates no condition */
  'tropos4as.goal.perform': (raw) => {
    if (raw.type?.trim() !== 'perform') return null;
    const written = CONDITION_KEYS.filter(
      (key) => key !== 'creation' && key !== 'precondition' && set(raw[key]),
    );
    return written.length
      ? `A perform-goal evaluates no condition (AAMAS 2009 §4.3.1): remove ${written.join(', ')}, or make it an achieve- or maintain-goal`
      : null;
  },
  /** §4.3.3: M(m, t, d) has a target only with its maintain condition */
  'tropos4as.goal.target': (raw) =>
    set(raw.target) && !set(raw.maintain)
      ? 'A target condition needs a maintain condition (M(m, t, d), AAMAS 2009 §4.3.3)'
      : null,
  /** an artifact's attributes: each `name:type`, a type the conditions can read */
  'tropos4as.artifact.attributes': (raw) => {
    const wrong = pairItems(raw.attributes).filter(
      ([name, type]) => !name || !isAttributeType(type),
    );
    return wrong.length
      ? `An attribute is name:type, the type ${ATTRIBUTE_TYPES.join(', ')} or its options (mode:wet|dry): not ${wrong.map((pair) => pair.join(':')).join(', ')}`
      : null;
  },
});

/** The names of Tropos4AS's checks: what a property's `check` may be. */
export type Tropos4asCheckName = keyof typeof tropos4asCheckRegistry;
