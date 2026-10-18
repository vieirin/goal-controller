/**
 * A goal's conditions, evaluated in the agent's belief base B (AAMAS 2009
 * §4.1: "B |= c denotes conditions true with respect to the actual
 * beliefs"). A condition is an assertion of the goal language (#134 D3); a
 * name is a belief, false until the agent believes it (a closed world), and
 * a goal's id is `success(id)`, the belief its being dropped with success
 * adds (§4.2.2).
 */
import {
  parseValue,
  type Assertion,
  type AssertionReading,
  type ExpressionTree,
} from '@goal-controller/goal-language';

/**
 * What the agent believes: a value per name (`roomClean`, `temperature`,
 * `success(G2)`), an artifact's attribute by its member's name
 * (`mealSensor.meals`).
 */
export type Beliefs = ReadonlyMap<string, boolean | number | string>;

/** A condition c, as written, and whether B |= c. */
export type Condition = {
  text: string;
  holds: (beliefs: Beliefs) => boolean;
};

export const TRUE: Condition = { text: 'true', holds: () => true };
export const FALSE: Condition = { text: 'false', holds: () => false };

/** ¬c */
export const not = (c: Condition): Condition =>
  c === TRUE
    ? FALSE
    : c === FALSE
      ? TRUE
      : { text: `¬${wrap(c)}`, holds: (b) => !c.holds(b) };

/** a ∨ b */
export const or = (a: Condition, b: Condition): Condition =>
  a === FALSE
    ? b
    : b === FALSE
      ? a
      : {
          text: `${wrap(a)} ∨ ${wrap(b)}`,
          holds: (x) => a.holds(x) || b.holds(x),
        };

const wrap = (c: Condition) =>
  /^[\w.()]+$/.test(c.text) || c.text.startsWith('¬') ? c.text : `(${c.text})`;

/** The belief a goal's success adds (§4.2.2: success(γ)). */
export const successOf = (goal: string) => `success(${goal})`;
/** The belief a goal's failure adds (§4.2.4: failed(g)). */
export const failedOf = (goal: string) => `failed(${goal})`;

/** A name's belief: a goal's id reads its success. */
const belief = (name: string, beliefs: Beliefs, goals: ReadonlySet<string>) =>
  goals.has(name) ? beliefs.get(successOf(name)) : beliefs.get(name);

/** A member's belief: `mealSensor.meals`, as a scenario names it. */
const memberOf = (ref: string, member: string) => `${ref}.${member}`;

const asNumber = (value: boolean | number | string | undefined) =>
  typeof value === 'number'
    ? value
    : typeof value === 'boolean'
      ? Number(value)
      : NaN;

const number = (
  tree: ExpressionTree,
  beliefs: Beliefs,
  goals: ReadonlySet<string>,
): number => {
  switch (tree.kind) {
    case 'number':
      return Number(tree.value);
    case 'var':
    case 'ref':
      return asNumber(
        belief(tree.kind === 'var' ? tree.name : tree.id, beliefs, goals),
      );
    case 'member':
      return asNumber(beliefs.get(memberOf(tree.ref, tree.member)));
    case 'unary':
      return -number(tree.expr, beliefs, goals);
    case 'binary': {
      const left = number(tree.left, beliefs, goals);
      const right = number(tree.right, beliefs, goals);
      switch (tree.operator) {
        case '*':
          return left * right;
        case '/':
          return left / right;
        case '+':
          return left + right;
        case '-':
          return left - right;
      }
      return NaN;
    }
    case 'call':
      throw new Error(`a condition calls no function (${tree.name})`);
  }
};

const COMPARE: Readonly<Record<string, (a: number, b: number) => boolean>> = {
  '=': (a, b) => a === b,
  '!=': (a, b) => a !== b,
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
};

const evaluate = (
  tree: AssertionReading | null,
  beliefs: Beliefs,
  goals: ReadonlySet<string>,
): boolean => {
  if (!tree) return false;
  switch (tree.kind) {
    case 'and':
      return (
        evaluate(tree.left, beliefs, goals) &&
        evaluate(tree.right, beliefs, goals)
      );
    case 'or':
      return (
        evaluate(tree.left, beliefs, goals) ||
        evaluate(tree.right, beliefs, goals)
      );
    case 'not':
      return !evaluate(tree.expr, beliefs, goals);
    case 'paren':
      return evaluate(tree.expr, beliefs, goals);
    case 'bool':
      return tree.value;
    case 'var':
      // #240: TRUE / FALSE in any case are the constants, not beliefs
      if (/^true$/i.test(tree.variable)) return true;
      if (/^false$/i.test(tree.variable)) return false;
      return belief(tree.variable, beliefs, goals) === true;
    case 'member':
      return beliefs.get(memberOf(tree.ref, tree.member)) === true;
    case 'assign': {
      const is =
        ((tree.member
          ? beliefs.get(memberOf(tree.variable, tree.member))
          : belief(tree.variable, beliefs, goals)) ?? false) === tree.value;
      return tree.negated ? !is : is;
    }
    case 'comparison': {
      const compare = COMPARE[tree.operator];
      if (!compare) throw new Error(`unknown comparison ${tree.operator}`);
      // an enum member and one of its options: `room.mode = wet`
      if (
        tree.left.kind === 'member' &&
        tree.right.kind === 'var' &&
        (tree.operator === '=' || tree.operator === '!=')
      ) {
        const is =
          beliefs.get(memberOf(tree.left.ref, tree.left.member)) ===
          tree.right.name;
        return tree.operator === '=' ? is : !is;
      }
      return compare(
        number(tree.left, beliefs, goals),
        number(tree.right, beliefs, goals),
      );
    }
    case 'call':
      throw new Error(`a condition calls no function (${tree.name})`);
  }
};

/**
 * A condition as a property holds it: its assertion, as the dialect reads
 * it (goal-controller#187; none when unset, blank or written with an
 * error, which the dialect's checks report), shown as written (`text`,
 * trimmed). `goals` are the ids that read a goal's success.
 */
export const conditionOf = (
  tree: Assertion | null | undefined,
  text: string | undefined,
  goals: ReadonlySet<string> = new Set(),
): Condition | null => {
  if (!tree) return null;
  const reading = tree.asReading();
  if (reading.kind === 'bool') return reading.value ? TRUE : FALSE;
  // #240: TRUE / FALSE in any case are the constant, not a belief
  if (reading.kind === 'var' && /^true$/i.test(reading.variable)) return TRUE;
  if (reading.kind === 'var' && /^false$/i.test(reading.variable)) return FALSE;
  return {
    text: text?.trim() || tree.text(),
    holds: (beliefs) => evaluate(reading, beliefs, goals),
  };
};

/** A condition written outside a property (a test's): its text read as an assertion; null when it is empty or isn't one. */
export const readCondition = (
  text: string | undefined,
  goals: ReadonlySet<string> = new Set(),
): Condition | null => {
  const read = parseValue('assertion', text ?? '');
  return read.errors.length ? null : conditionOf(read.value, text, goals);
};
