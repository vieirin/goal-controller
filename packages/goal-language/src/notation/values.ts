/**
 * Whether a value is what its property's config says: of its predefined
 * type (read with the type's rule), within its options or bounds, naming
 * elements of the model of the kind it refers to.
 */
import type { DefinitionContext, ValueConfig } from '@goal-controller/dialect';
import { parseValue } from '../parse.js';
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
      const [error] = parseValue('assertion', text).errors;
      return error ? `Not a condition: ${error.message}` : null;
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
 * workbench's (a typo, or a variable the model doesn't use yet).
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
      : resolves.includes('variable') && context.variables.includes(name);
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
