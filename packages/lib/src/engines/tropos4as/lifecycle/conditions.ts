/**
 * A goal's conditions, evaluated in the agent's belief base B (AAMAS 2009
 * §4.1: "B |= c denotes conditions true with respect to the actual
 * beliefs"). A condition is an assertion of the goal language (#134 D3); a
 * name is a belief, false until the agent believes it (a closed world), and
 * a goal's id is `success(id)`, the belief its being dropped with success
 * adds (§4.2.2).
 */
import {
  readAssertion,
  type AssertionReading,
  type ExpressionTree,
} from '@goal-controller/goal-language';

/** What the agent believes: a value per name (`roomClean`, `temperature`, `success(G2)`). */
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

/**
 * A member reference's belief (`room.clean`, goal-controller#135): the
 * belief named `ref.member`, as a scenario writes it.
 */
const memberName = (ref: string, member: string) => `${ref}.${member}`;

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
    case 'member': {
      const value = belief(
        tree.kind === 'var'
          ? tree.name
          : tree.kind === 'ref'
            ? tree.id
            : memberName(tree.ref, tree.member),
        beliefs,
        goals,
      );
      return typeof value === 'number'
        ? value
        : typeof value === 'boolean'
          ? Number(value)
          : NaN;
    }
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
      return belief(tree.variable, beliefs, goals) === true;
    case 'member':
      return belief(memberName(tree.ref, tree.member), beliefs, goals) === true;
    case 'assign': {
      const name = tree.member
        ? memberName(tree.variable, tree.member)
        : tree.variable;
      const is = (belief(name, beliefs, goals) ?? false) === tree.value;
      return tree.negated ? !is : is;
    }
    case 'comparison': {
      const compare = COMPARE[tree.operator];
      if (!compare) throw new Error(`unknown comparison ${tree.operator}`);
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
 * A condition's text read; null when it is empty, an error when the goal
 * language can't read it. `goals` are the ids that read a goal's success.
 */
export const readCondition = (
  text: string | undefined,
  goals: ReadonlySet<string> = new Set(),
): Condition | null | { error: string } => {
  const written = text?.trim();
  if (!written) return null;
  const tree = readAssertion(written);
  if (!tree) return { error: `"${written}" is no condition` };
  if (tree.kind === 'bool') return tree.value ? TRUE : FALSE;
  return { text: written, holds: (beliefs) => evaluate(tree, beliefs, goals) };
};
