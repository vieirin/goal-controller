/**
 * What each value type the language reads can do (goal-controller#188): an
 * assertion, an expression, a refList, a pairList and a notation carry their
 * operations as members. The value is its plain data (`kind`-discriminated
 * trees, arrays), as stored and snapshotted; the members are on it, not
 * enumerable, so JSON, a structured clone and a deep comparison see the data
 * only. The reader builds them (`parseValue`, `readAssertion`,
 * `readExpression`, `parseElementLine`, `readProperties`); `asAssertion`, …
 * build them over data read before. An operation takes the value, never its
 * text; one that needs the dialect takes it as an argument.
 */
import type { WithNotation } from '@goal-controller/dialect';
import { EXPRESSION, EXPRESSION_REF } from './catalog.js';
import type {
  AssertionNode,
  AssertionReading,
  AssertionTree,
  ExpressionComparison,
  ExpressionTree,
  RtTree,
} from './parse.js';
import type { ExecutionDetailOf } from './notation/goalNames.js';

// ---------------------------------------------------------------------------
// the operations, over the data
// ---------------------------------------------------------------------------

const CLOSE: Record<string, string> = { '[': ']', '(': ')' };

/** A notation's text without whitespace, as ANTLR's `getText()` (edgeV2 keys retries by it). */
export const notationText = (tree: RtTree | null): string => {
  switch (tree?.kind) {
    case 'ref':
      return tree.id;
    case 'skip':
      return 'skip';
    case 'standalone':
      return tree.symbol;
    case 'group':
      return `${tree.open}${notationText(tree.expr)}${CLOSE[tree.open] ?? ''}`;
    case 'prefix':
      return `${tree.operator}${notationText(tree.expr)}`;
    case 'postfix':
      return `${notationText(tree.expr)}${tree.operator}${tree.argument}`;
    case 'binary':
      return `${notationText(tree.left)}${tree.operator}${notationText(tree.right)}`;
    case 'call':
      return `${tree.name}(${tree.args.map(notationText).join(',')})`;
    default:
      return '';
  }
};

/**
 * An operand's element ids (and `skip`, and standalone symbols): through
 * operators and modifiers; a group's (`[...]`) and a call's
 * (`FALLBACK(...)`) are their own, not their parent's.
 */
export const notationOperandIds = (tree: RtTree | null): string[] => {
  switch (tree?.kind) {
    case 'ref':
      return [tree.id];
    case 'skip':
      return ['skip'];
    case 'standalone':
      return [tree.symbol];
    case 'postfix':
    case 'prefix':
      return notationOperandIds(tree.expr);
    case 'binary':
      return [
        ...notationOperandIds(tree.left),
        ...notationOperandIds(tree.right),
      ];
    default:
      return [];
  }
};

/**
 * Every element id a notation names, in the order written: through operators,
 * groups and calls alike (`[G2;FALLBACK(G3,[G4#AT1])]`: G2, G3, G4, AT1).
 */
export const notationIds = (tree: RtTree | null): string[] => {
  switch (tree?.kind) {
    case 'ref':
      return [tree.id];
    case 'group':
    case 'prefix':
    case 'postfix':
      return notationIds(tree.expr);
    case 'binary':
      return [...notationIds(tree.left), ...notationIds(tree.right)];
    case 'call':
      return tree.args.flatMap(notationIds);
    default:
      return [];
  }
};

/** A call's operands' ids, its arguments in order (`FALLBACK(G2,G3)`: G2, G3). */
export const callOperands = (
  tree: Extract<RtTree, { kind: 'call' }>,
): string[] => tree.args.flatMap(notationOperandIds);

type Form = 'infix' | 'prefix' | 'postfix' | 'standalone' | 'call';

/**
 * Whether a dialect enables an operator: a standalone symbol as standalone,
 * any other by its symbol (a postfix one, to a modifier). The validator
 * reports the ones it does not.
 */
export const isEnabled = (
  { notation }: WithNotation,
  symbol: string,
  form: Form,
): boolean => {
  if (form === 'standalone') return symbol in (notation.standalone ?? {});
  const meaning = notation.operators[symbol];
  if (meaning === undefined) return false;
  return form === 'postfix'
    ? meaning in (notation.modifiers ?? {})
    : meaning in notation.constructs;
};

export type NotationReading = {
  /** each construct's ids, from its last (outermost) operator, empty or not */
  constructs: Map<string, string[]>;
  /** the standalone constructs written */
  standalone: Set<string>;
  /** each modifier's arguments, by the modified operand's text */
  modifiers: Map<string, Record<string, number>>;
  /** the operators written that the dialect does not enable */
  disabled: string[];
};

/** A notation's tree read in a dialect, innermost operator first. */
export const readNotation = (
  dialect: WithNotation,
  tree: RtTree | null,
): NotationReading => {
  const { operators, standalone = {} } = dialect.notation;
  const reading: NotationReading = {
    constructs: new Map(),
    standalone: new Set(),
    modifiers: new Map(),
    disabled: [],
  };
  const enabled = (symbol: string, form: Form) => {
    const yes = isEnabled(dialect, symbol, form);
    if (!yes) reading.disabled.push(symbol);
    return yes;
  };
  const visit = (node: RtTree | null): void => {
    switch (node?.kind) {
      case 'group':
        return visit(node.expr);
      case 'binary':
      case 'prefix':
        if (node.kind === 'binary') {
          visit(node.left);
          visit(node.right);
        } else visit(node.expr);
        if (enabled(node.operator, node.kind === 'binary' ? 'infix' : 'prefix'))
          reading.constructs.set(
            operators[node.operator]!,
            notationOperandIds(node).filter(Boolean),
          );
        return;
      case 'call':
        for (const arg of node.args) visit(arg);
        if (enabled(node.name, 'call'))
          reading.constructs.set(
            operators[node.name]!,
            callOperands(node).filter(Boolean),
          );
        return;
      case 'postfix': {
        visit(node.expr);
        if (!enabled(node.operator, 'postfix')) return;
        const modifier = operators[node.operator]!;
        reading.modifiers.set(modifier, {
          ...reading.modifiers.get(modifier),
          [notationText(node.expr)]: parseInt(node.argument),
        });
        return;
      }
      case 'standalone':
        if (enabled(node.symbol, 'standalone'))
          reading.standalone.add(standalone[node.symbol]!);
        return;
      default:
        return;
    }
  };
  visit(tree);
  return reading;
};

/** The outermost enabled operator of a notation (groups and modifiers looked through). */
const outermost = (
  dialect: WithNotation,
  tree: RtTree | null,
): { construct: string; ids: string[] } | null => {
  switch (tree?.kind) {
    case 'group':
    case 'postfix':
      return outermost(dialect, tree.expr);
    case 'call':
      return isEnabled(dialect, tree.name, 'call')
        ? {
            construct: dialect.notation.operators[tree.name]!,
            ids: callOperands(tree).filter(Boolean),
          }
        : null;
    case 'prefix':
    case 'binary': {
      const form = tree.kind === 'binary' ? 'infix' : 'prefix';
      if (isEnabled(dialect, tree.operator, form))
        return {
          construct: dialect.notation.operators[tree.operator]!,
          ids: notationOperandIds(tree).filter(Boolean),
        };
      // a disabled operator: what is under it
      return tree.kind === 'binary'
        ? (outermost(dialect, tree.left) ?? outermost(dialect, tree.right))
        : outermost(dialect, tree.expr);
    }
    default:
      return null;
  }
};

/**
 * A notation's execution detail in a dialect: a standalone construct when
 * one is written, else the outermost enabled operator's construct with its
 * operands (none: no detail).
 */
export const notationExecution = <D extends WithNotation>(
  dialect: D,
  tree: RtTree | null,
): ExecutionDetailOf<D> | null => {
  const said = readNotation(dialect, tree);
  const [standalone] = said.standalone;
  const outer = standalone
    ? { construct: standalone, ids: [] }
    : outermost(dialect, tree);
  if (!outer || (!standalone && !outer.ids.length)) return null;
  const modifiers = Object.fromEntries(
    Object.entries(dialect.notation.modifiers ?? {})
      .filter(
        ([name, modifier]) =>
          modifier.appliesTo.includes(outer.construct) &&
          said.modifiers.has(name),
      )
      .map(([name]) => [name, said.modifiers.get(name)!]),
  );
  // the names are the dialect's: its type says which (ExecutionDetailOf)
  return {
    type: outer.construct,
    ids: outer.ids,
    modifiers,
  } as ExecutionDetailOf<D>;
};

/** How tightly each binary operator binds: 0 tightest (the catalog's levels). */
const LEVEL = new Map<string, number>(
  EXPRESSION.infix.flatMap((level, i) =>
    level.map((operator) => [operator, i] as const),
  ),
);

/**
 * An expression's text: `0.5 + 0.9 * previous(t)`, with the parentheses its
 * shape needs and no others. It reads back as the same tree.
 */
export const expressionTextOf = (tree: ExpressionTree): string => {
  switch (tree.kind) {
    case 'number':
      return tree.value;
    case 'ref':
      return tree.id;
    case 'var':
      return tree.name;
    case 'member':
      return `${tree.ref}.${tree.member}`;
    case 'call':
      return `${tree.name}(${tree.args.map(expressionTextOf).join(', ')})`;
    case 'unary': {
      const operand = expressionTextOf(tree.expr);
      return tree.expr.kind === 'binary'
        ? `${tree.operator}(${operand})`
        : `${tree.operator}${operand}`;
    }
    case 'binary': {
      const level = LEVEL.get(tree.operator)!;
      // an operand that binds looser is grouped; on the right, one that binds
      // as tightly too (every operator is left-associative)
      const side = (
        operand: ExpressionTree,
        grouped: (l: number) => boolean,
      ) =>
        operand.kind === 'binary' && grouped(LEVEL.get(operand.operator)!)
          ? `(${expressionTextOf(operand)})`
          : expressionTextOf(operand);
      return `${side(tree.left, (l) => l > level)} ${tree.operator} ${side(tree.right, (l) => l >= level)}`;
    }
  }
};

/** An expression's nodes, each before its operands (a check or an engine walks them). */
export const expressionNodesOf = (tree: ExpressionTree): ExpressionTree[] => {
  switch (tree.kind) {
    case 'call':
      return [tree, ...tree.args.flatMap(expressionNodesOf)];
    case 'binary':
      return [
        tree,
        ...expressionNodesOf(tree.left),
        ...expressionNodesOf(tree.right),
      ];
    case 'unary':
      return [tree, ...expressionNodesOf(tree.expr)];
    default:
      return [tree];
  }
};

const REF = new RegExp(`^(?:${EXPRESSION_REF})$`);

/**
 * Whether a name, as an assertion writes it (a variable, a member's
 * reference), is an element's id: the lexer reads it as one (`G1`, `T1.1`;
 * `E1` and `x` are names).
 */
export const isElementId = (name: string): boolean => REF.test(name);

/** The element ids an expression names, in the order written, each once (a member's reference too). */
export const expressionIds = (tree: ExpressionTree): string[] =>
  unique(
    expressionNodesOf(tree).flatMap((node) =>
      node.kind === 'ref'
        ? [node.id]
        : node.kind === 'member' && isElementId(node.ref)
          ? [node.ref]
          : [],
    ),
  );

/** A call in an expression or an assertion: `previous(t)`. */
export type ExpressionCall = Extract<ExpressionTree, { kind: 'call' }>;

/** The calls an expression makes, outermost first, in the order written. */
export const expressionCalls = (tree: ExpressionTree): ExpressionCall[] =>
  expressionNodesOf(tree).filter(
    (node): node is ExpressionCall => node.kind === 'call',
  );

/**
 * An assertion's text, as read (its groups are its `paren` nodes):
 * `previous(t) < 18 & !on`. It reads back as the same tree.
 */
export const assertionTextOf = (tree: AssertionTree | null): string => {
  switch (tree?.kind) {
    case 'and':
    case 'or':
      return `${assertionTextOf(tree.left)} ${tree.kind === 'and' ? '&' : '|'} ${assertionTextOf(tree.right)}`;
    case 'not':
      return `!${assertionTextOf(tree.expr)}`;
    case 'paren':
      return `(${assertionTextOf(tree.expr)})`;
    case 'assign':
      return `${tree.variable}${tree.member ? `.${tree.member}` : ''} ${tree.negated ? '!=' : '='} ${tree.value}`;
    case 'member':
      return `${tree.ref}.${tree.member}`;
    case 'compare':
      return `${tree.variable} ${tree.operator} ${tree.value}`;
    case 'comparison':
      return `${expressionTextOf(tree.left)} ${tree.operator} ${expressionTextOf(tree.right)}`;
    case 'call':
      return expressionTextOf(tree);
    case 'var':
      return tree.variable;
    case 'bool':
      return String(tree.value);
    default:
      return '';
  }
};

/** A comparison of expressions, or a call, as an assertion holds one. */
export type Comparison =
  | ExpressionComparison
  | Extract<AssertionTree, { kind: 'call' }>;

/** An assertion's comparisons of expressions and its calls, in the order written. */
export const assertionComparisons = (
  tree: AssertionTree | null,
): Comparison[] => {
  switch (tree?.kind) {
    case 'and':
    case 'or':
      return [
        ...assertionComparisons(tree.left),
        ...assertionComparisons(tree.right),
      ];
    case 'not':
    case 'paren':
      return assertionComparisons(tree.expr);
    case 'comparison':
    case 'call':
      return [tree];
    default:
      return [];
  }
};

/** The expressions an assertion's comparisons and calls hold (each side; a call whole). */
export const assertionExpressionsOf = (
  tree: AssertionTree | null,
): ExpressionTree[] =>
  assertionComparisons(tree).flatMap((atom) =>
    atom.kind === 'call' ? [atom] : [atom.left, atom.right],
  );

/** A variable an assertion names, and the value it sets (`x = true`), if any. */
export type AssertionVariable = { name: string; value: boolean | null };

/**
 * The variables an assertion names (`battery > 20 & !charging`), in the
 * order written: `x = true` sets a value (each time), a name or an integer
 * comparison adds the name once, without one.
 */
export const assertionVariablesOf = (
  tree: AssertionTree | null,
): AssertionVariable[] => {
  const variables: AssertionVariable[] = [];
  const named = (name: string) => {
    if (!variables.some((v) => v.name === name))
      variables.push({ name, value: null });
  };
  const walk = (node: AssertionTree | null): void => {
    switch (node?.kind) {
      case 'and':
      case 'or':
        walk(node.left);
        walk(node.right);
        return;
      case 'not':
      case 'paren':
        walk(node.expr);
        return;
      case 'assign':
        // `x != true` names x, without setting it; `room.clean = true`
        // names room (it sets a member, not the name)
        if (node.negated || node.member) named(node.variable);
        else variables.push({ name: node.variable, value: node.value });
        return;
      case 'compare':
      case 'var':
        named(node.variable);
        return;
      case 'member':
        named(node.ref);
        return;
      case 'comparison':
      case 'call':
        // the names its expressions read (an element's id too), not the functions they call
        for (const part of assertionExpressionsOf(node).flatMap(
          expressionNodesOf,
        ))
          if (part.kind === 'var') named(part.name);
          else if (part.kind === 'ref') named(part.id);
          else if (part.kind === 'member') named(part.ref);
        return;
      default:
        return;
    }
  };
  walk(tree);
  return variables;
};

/** A name as an expression reads it: an element's id, or a variable. */
const operand = (name: string): ExpressionTree =>
  isElementId(name) ? { kind: 'ref', id: name } : { kind: 'var', name };

/**
 * An assertion with every comparison's sides as expressions (`x > 3`: a
 * `var` and a `number`), as `readAssertion` reads one.
 */
export const assertionReading = <C>(
  tree: AssertionNode<C> | null,
): AssertionReading | null => {
  if (!tree) return null;
  const node = tree as AssertionTree;
  switch (node.kind) {
    case 'and':
    case 'or':
      return {
        kind: node.kind,
        left: assertionReading(node.left),
        right: assertionReading(node.right),
      };
    case 'not':
    case 'paren':
      return { kind: node.kind, expr: assertionReading(node.expr) };
    case 'compare':
      return {
        kind: 'comparison',
        operator: node.operator,
        left: operand(node.variable),
        right: { kind: 'number', value: node.value },
      };
    default:
      return node;
  }
};

/** The element ids an assertion names, in the order written, each once. */
export const assertionIds = (tree: AssertionTree | null): string[] =>
  unique(
    assertionVariablesOf(tree)
      .map((variable) => variable.name)
      .filter(isElementId),
  );

const unique = (ids: string[]): string[] => [...new Set(ids)];

/** A pairList's text: `x:3, y:2`. */
export const pairListText = (
  pairs: readonly { name: string; value: string | number }[],
): string => pairs.map((pair) => `${pair.name}:${pair.value}`).join(', ');

// ---------------------------------------------------------------------------
// the value types: the data, with its operations as members
// ---------------------------------------------------------------------------

/** What every value type has: its text as the language writes it (it reads back as the value). */
type Written = { text(): string };

/** What a value naming elements has: the ids it names, in the order written. */
type Naming = { refs(): string[] };

/**
 * An `&` or `|`'s operands, associative (`a & b & c`), through groupings;
 * any other node is itself.
 */
const assertionOperands = (
  kind: 'and' | 'or',
  tree: AssertionTree | null,
): AssertionTree[] => {
  if (!tree) return [];
  if (tree.kind === 'paren') return assertionOperands(kind, tree.expr);
  if (tree.kind === kind)
    return [
      ...assertionOperands(kind, tree.left),
      ...assertionOperands(kind, tree.right),
    ];
  return [tree];
};

/**
 * An assertion with `&` / `|` operands in canonical order (goal-controller
 * #238): groupings dropped, each operand normalised, then sorted by its
 * text, so `C2 & C1` and `C1 & C2` compare equal.
 */
export const assertionNormalized = (
  tree: AssertionTree | null,
): AssertionTree | null => {
  if (!tree) return null;
  if (tree.kind === 'paren') return assertionNormalized(tree.expr);
  if (tree.kind === 'and' || tree.kind === 'or') {
    const operands = assertionOperands(tree.kind, tree)
      .map(assertionNormalized)
      .filter((operand): operand is AssertionTree => operand !== null)
      .sort((a, b) =>
        assertionTextOf(a).localeCompare(assertionTextOf(b), 'en'),
      );
    if (!operands.length) return null;
    return operands.reduce((left, right) => ({
      kind: tree.kind,
      left,
      right,
    }));
  }
  if (tree.kind === 'not')
    return { kind: 'not', expr: assertionNormalized(tree.expr) };
  return tree;
};

/**
 * Whether two assertions are the same formula structurally
 * (goal-controller#238): `&` and `|` commute, groupings don't count.
 */
export const assertionEquals = (
  a: AssertionTree | null | undefined,
  b: AssertionTree | null | undefined,
): boolean => {
  if (a == null || b == null) return a == null && b == null;
  return (
    JSON.stringify(assertionNormalized(a)) ===
    JSON.stringify(assertionNormalized(b))
  );
};

/** An assertion's members. */
export type AssertionMembers = Written &
  Naming & {
    /** the data: the tree itself, as stored */
    readonly tree: AssertionTree;
    /** the variables it names, in order (`x = true` gives a value) */
    variables(): AssertionVariable[];
    /** its comparisons of expressions and its calls, in order */
    comparisons(): Comparison[];
    /** the expressions those hold (each side; a call whole) */
    expressions(): ExpressionTree[];
    /** every comparison's sides as expressions (`x > 3`: a `var` and a `number`) */
    asReading(): Assertion<AssertionReading>;
    /**
     * whether another assertion is the same formula structurally
     * (goal-controller#238): `&` and `|` commute
     */
    equals(other: AssertionTree | null | undefined): boolean;
  };

/** An assertion (`x > 3 & !on`): its tree, with its operations. */
export type Assertion<T extends AssertionTree = AssertionTree> = T &
  AssertionMembers;

/** An expression's members. */
export type ExpressionMembers = Written &
  Naming & {
    /** the data: the tree itself, as stored */
    readonly tree: ExpressionTree;
    /** its nodes, each before its operands */
    nodes(): ExpressionTree[];
    /** the calls it makes, outermost first */
    calls(): ExpressionCall[];
  };

/** An expression (`0.5 + 0.9 * previous(t)`): its tree, with its operations. */
export type Expression = ExpressionTree & ExpressionMembers;

/** A refList's members. */
export type RefListMembers = Written &
  Naming & {
    /** the data: the ids themselves */
    readonly ids: readonly string[];
  };

/** A refList (`G2, G5`): its ids, with their operations. */
export type RefList = string[] & RefListMembers;

/**
 * A pair of a pairList (`x:3`): its name, and its value as the list's value
 * type reads it (goal-controller#235: an `int` or a `number` list's a
 * number, a `text` list's, and one read without its config, a string).
 */
export type Pair<V extends PairValue = string> = { name: string; value: V };

/** What a pair's value is: a number, or a string. */
export type PairValue = string | number;

/** A pairList's members. */
export type PairListMembers<V extends PairValue = string> = Written & {
  /** the data: the pairs themselves */
  readonly pairs: readonly Pair<V>[];
  /** the value of the first pair of that name */
  get(name: string): V | undefined;
  /** its pairs' names, in order */
  names(): string[];
};

/** A pairList (`x:3, y:2`): its pairs, with their operations. */
export type PairList<V extends PairValue = string> = Pair<V>[] &
  PairListMembers<V>;

/** A notation's members. */
export type NotationMembers = Written &
  Naming & {
    /** the data: the tree itself, as stored */
    readonly tree: RtTree;
    /** its operand's ids through operators (a group's and a call's are their own) */
    operandIds(): string[];
    /** its execution detail in a dialect (`{ type, ids, modifiers }`), or null */
    execution<D extends WithNotation>(dialect: D): ExecutionDetailOf<D> | null;
    /** what it says in a dialect: constructs, standalone ones, modifiers, disabled operators */
    reading(dialect: WithNotation): NotationReading;
  };

/** An element line's notation (`G2;G3@2`): its tree, with its operations. */
export type Notation = RtTree & NotationMembers;

/** The data, with these members on it, not enumerable (once: a value already built is itself; frozen data, a copy). */
const BUILT = Symbol('members');

const withMembers = <T extends object, M extends object>(
  data: T,
  members: (data: T) => M,
): T & M => {
  if (BUILT in data) return data as T & M;
  // frozen data (stored, a store's state) gets its members on a copy
  if (!Object.isExtensible(data))
    return withMembers(
      (Array.isArray(data) ? [...data] : { ...data }) as T,
      members,
    );
  const built = { ...members(data), [BUILT]: true };
  for (const key of Reflect.ownKeys(built))
    Object.defineProperty(data, key, {
      value: built[key as keyof typeof built],
      enumerable: false,
      configurable: true,
      writable: true,
    });
  return data as T & M;
};

/** An assertion's tree with its operations. */
export const asAssertion = <T extends AssertionTree>(tree: T): Assertion<T> =>
  withMembers(tree, (data) => ({
    tree: data,
    text: () => assertionTextOf(data),
    variables: () => assertionVariablesOf(data),
    comparisons: () => assertionComparisons(data),
    expressions: () => assertionExpressionsOf(data),
    asReading: () => asAssertion(assertionReading(data)!),
    refs: () => assertionIds(data),
    equals: (other: AssertionTree | null | undefined) =>
      assertionEquals(data, other),
  }));

/** An expression's tree with its operations. */
export const asExpression = (tree: ExpressionTree): Expression =>
  withMembers(tree, (data) => ({
    tree: data,
    text: () => expressionTextOf(data),
    nodes: () => expressionNodesOf(data),
    calls: () => expressionCalls(data),
    refs: () => expressionIds(data),
  }));

/** A refList's ids with their operations. */
export const asRefList = (ids: string[]): RefList =>
  withMembers(ids, (data) => ({
    ids: data,
    text: () => data.join(', '),
    refs: () => [...data],
  }));

/** A pairList's pairs with their operations. */
export const asPairList = <V extends PairValue = string>(
  pairs: Pair<V>[],
): PairList<V> =>
  withMembers(pairs, (data) => ({
    pairs: data,
    text: () => pairListText(data),
    get: (name: string) => data.find((pair) => pair.name === name)?.value,
    names: () => data.map((pair) => pair.name),
  }));

/** A notation's tree with its operations. */
export const asNotation = (tree: RtTree): Notation =>
  withMembers(tree, (data) => ({
    tree: data,
    text: () => notationText(data),
    operandIds: () => notationOperandIds(data),
    refs: () => notationIds(data),
    execution: <D extends WithNotation>(dialect: D) =>
      notationExecution(dialect, data),
    reading: (dialect: WithNotation) => readNotation(dialect, data),
  }));
