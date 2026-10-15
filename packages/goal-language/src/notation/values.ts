/**
 * Whether a value is what its property's config says: of its predefined
 * type (read with the type's rule), within its options or bounds, naming
 * elements of the model of the kind it refers to.
 */
import type {
  DefinitionContext,
  ElementKind,
  FunctionDefinition,
  ValueConfig,
} from '@goal-controller/dialect';
import {
  assertionText,
  comparisonsOf,
  expressionNodes,
  parseCondition,
  parseValue,
  type AssertionTree,
  type ExpressionTree,
} from '../parse.js';
import { assertionVariables } from './goalNames.js';

const kindOf = (context: DefinitionContext | undefined, id: string) =>
  context?.elements[id]?.kind;

const intProblem = (
  text: string,
  { min, max }: { min?: number; max?: number },
): string | null => {
  const read = parseValue('int', text);
  if (read.errors.length) return `Not an integer: ${text}`;
  const n = parseInt(read.value ?? '', 10);
  if (min !== undefined && n < min) return `At least ${min}`;
  if (max !== undefined && n > max) return `At most ${max}`;
  return null;
};

/** The first boolean a condition compares with `!=` (`x != false`), as written, if any. */
const negatedOf = (tree: AssertionTree | null): string | null => {
  switch (tree?.kind) {
    case 'and':
    case 'or':
      return negatedOf(tree.left) ?? negatedOf(tree.right);
    case 'not':
    case 'paren':
      return negatedOf(tree.expr);
    case 'assign':
      return tree.negated ? `${tree.variable} != ${tree.value}` : null;
    default:
      return null;
  }
};

/** The first decimal a condition compares with (`x > 0.5`), if any. */
const decimalOf = (tree: AssertionTree | null): string | null => {
  switch (tree?.kind) {
    case 'and':
    case 'or':
      return decimalOf(tree.left) ?? decimalOf(tree.right);
    case 'not':
    case 'paren':
      return decimalOf(tree.expr);
    case 'compare':
      return tree.value.includes('.') ? tree.value : null;
    case 'comparison':
      for (const node of [tree.left, tree.right].flatMap(expressionNodes))
        if (node.kind === 'number' && node.value.includes('.'))
          return node.value;
      return null;
    default:
      return null;
  }
};

/** `1 argument`, `2 arguments`: what a function takes, in words. */
export const argumentsText = (n: number) =>
  `${n} argument${n === 1 ? '' : 's'}`;

/** The first call of an expression to a function not declared, or with another number of arguments. */
const callProblem = (
  tree: ExpressionTree,
  functions: readonly FunctionDefinition[],
): string | null => {
  for (const node of expressionNodes(tree)) {
    if (node.kind !== 'call') continue;
    const declared = functions.find((f) => f.name === node.name);
    if (!declared)
      return functions.length
        ? `${node.name} is not a function here (${functions.map((f) => f.name).join(', ')})`
        : `${node.name} is not a function here (there are none)`;
    if (declared.arity !== node.args.length)
      return `${node.name} takes ${argumentsText(declared.arity)}, not ${node.args.length}`;
  }
  return null;
};

/** The first id of an expression that is not an element of the kinds it resolves. */
const refProblem = (
  tree: ExpressionTree,
  kinds: readonly ElementKind[],
  context: DefinitionContext,
): string | null => {
  for (const node of expressionNodes(tree)) {
    if (node.kind !== 'ref') continue;
    const kind = kindOf(context, node.id);
    if (!kind) return `${node.id} is not an element of this model`;
    if (!(kinds as readonly string[]).includes(kind))
      return kinds.length
        ? `${node.id} is a ${kind}, not a ${kinds.join(' or ')}`
        : `${node.id} is a ${kind}: this value names no elements`;
  }
  return null;
};

/**
 * What is wrong with a value for its config (null when fine, and when unset).
 * Ids are checked against the context when there is one.
 */
export const valueProblem = (
  value: ValueConfig,
  text: string,
  context?: DefinitionContext,
): string | null => {
  if (!text.trim()) return null;
  switch (value.type) {
    case 'int':
      return intProblem(text, value);
    case 'number':
      return parseValue('number', text).errors.length
        ? `Not a number: ${text}`
        : null;
    case 'bool':
      return parseValue('bool', text).errors.length
        ? `true or false, not ${text}`
        : null;
    case 'enum': {
      const options = value.options.map((o) => o.value).filter(Boolean);
      return value.open || options.includes(text.trim())
        ? null
        : `One of ${options.join(', ')}, not ${text.trim()}`;
    }
    case 'assertion': {
      const read = parseCondition(text);
      const [error] = read.errors;
      if (error) return `Not a condition: ${error.message}`;
      const { prefix, tree } = read.value;
      const prefixes: readonly string[] = value.prefixes ?? [];
      if (prefixes.length && (!prefix || !prefixes.includes(prefix)))
        return `Starts with ${prefixes.join(' or ')}`;
      if (!prefixes.length && prefix) return `No prefix: ${prefix} is not read`;
      if (prefix && !tree) return `A condition after ${prefix}`;
      // a comparison other than a name and a number, where the value declares functions
      const [comparison] = comparisonsOf(tree);
      if (comparison && !value.functions)
        return `A name is compared with a number here, not ${assertionText(comparison)}`;
      for (const { left, right } of comparisonsOf(tree)) {
        const problem =
          callProblem(left, value.functions ?? []) ??
          callProblem(right, value.functions ?? []);
        if (problem) return problem;
      }
      const decimal = !value.decimals && decimalOf(tree);
      if (decimal) return `Not an integer: ${decimal}`;
      const inequality = !value.booleanInequality && negatedOf(tree);
      return inequality
        ? `A boolean is compared with =, not != (${inequality})`
        : null;
    }
    case 'expression': {
      const read = parseValue('expression', text);
      const [error] = read.errors;
      if (error) return `Not an expression: ${error.message}`;
      if (!read.value) return null;
      return (
        callProblem(read.value, value.functions ?? []) ??
        (context ? refProblem(read.value, value.resolves ?? [], context) : null)
      );
    }
    case 'refList': {
      const read = parseValue('refList', text);
      if (read.errors.length) return 'Element ids, comma-separated (G2, G5)';
      if (!context) return null;
      for (const id of read.value) {
        const kind = kindOf(context, id);
        if (!kind) return `${id} is not an element of this model`;
        if (kind !== value.kind)
          return `${id} is a ${kind}, not a ${value.kind}`;
      }
      return null;
    }
    case 'pairList': {
      const read = parseValue('pairList', text);
      if (read.errors.length)
        return 'name:value pairs, comma-separated (x:3, y:2)';
      for (const pair of read.value) {
        const problem =
          value.value === 'int'
            ? intProblem(pair.value, {})
            : value.value === 'number' &&
                parseValue('number', pair.value).errors.length
              ? `Not a number: ${pair.value}`
              : null;
        if (problem) return `${pair.name}: ${problem}`;
      }
      return null;
    }
    case 'annotatedName': {
      const [error] = parseValue('annotatedName', text).errors;
      return error ? error.message : null;
    }
    case 'text':
      return null;
    case 'ocl': {
      // read leniently: only a character no OCL token matches is wrong
      const [error] = parseValue('ocl', text).errors;
      return error ? error.message : null;
    }
  }
};

/**
 * The names a condition compares that the model doesn't know: neither an
 * element of a kind it resolves nor, when it resolves variables, one of the
 * workbench's (a typo, or a variable the model doesn't use yet). A value
 * whose variables are declared by their use (`declaresVariables`) knows
 * every name that isn't an element's.
 */
export const unknownNames = (
  value: ValueConfig,
  text: string,
  context: DefinitionContext,
): string[] => {
  if (value.type !== 'assertion' || parseValue('assertion', text).errors.length)
    return [];
  const resolves: readonly string[] = value.resolves;
  const known = (name: string) => {
    const kind = kindOf(context, name);
    return kind
      ? resolves.includes(kind)
      : resolves.includes('variable') &&
          (!!value.declaresVariables || context.variables.includes(name));
  };
  return assertionVariables(text)
    .map((variable) => variable.name)
    .filter((name) => !known(name));
};

/** What an unknown name is not: `a resource of this model or a known variable`. */
export const unknownNameMessage = (
  value: Extract<ValueConfig, { type: 'assertion' }>,
  name: string,
): string => {
  const kinds = value.resolves.filter((kind) => kind !== 'variable');
  const element = kinds.length ? `a ${kinds.join(' or ')} of this model` : '';
  const variable = value.resolves.includes('variable')
    ? 'a known variable'
    : '';
  return `${name} is not ${[element, variable].filter(Boolean).join(' or ')}`;
};
