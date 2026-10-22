/**
 * Whether a value is what its property's config says: of its predefined
 * type (read with the type's rule), within its options or bounds, naming
 * elements of the model of the kind it refers to.
 */
import {
  refListKinds,
  valueParts,
  actorPropertiesOf,
  enumOptionOf,
  linkPropertiesOf,
  probabilityOf,
  readDistribution,
  danglingName,
  valueOf,
  type AnyDialect,
  type DefinitionContext,
  type DefinitionContextElement,
  type DialectKind,
  type FormulaSymbols,
  type FunctionDefinition,
  type MemberSource,
  type PropertyDefinition,
  type ValueConfig,
} from '@goal-controller/dialect';
import {
  assertionExpressions,
  assertionText,
  expressionText,
  comparisonsOf,
  expressionNodes,
  parseCondition,
  parseValue,
  type AssertionTree,
  type ExpressionTree,
} from '../parse.js';
import { ltlTypeProblems, parseLtl, type SymbolTable } from '../ltl/index.js';
import { assertionVariables } from './goalNames.js';
import {
  contextElementOf,
  propertyIn,
  propertyOf,
  referenceParts,
  targetScopeOf,
} from './properties.js';

const kindOf = (context: DefinitionContext | undefined, id: string) =>
  context?.elements[id]?.kind;

/**
 * An inspector field's property (goal-controller#152): the property `key`
 * of an element, a link or an actor, by its id (an element's key, a link's
 * or an actor's piStar id), with what it is on and its value's config as its
 * properties make it. Null: nothing has such a property.
 */
export const fieldPropertyOf = (
  definition: Pick<AnyDialect, 'properties'> &
    Partial<Pick<AnyDialect, 'links' | 'actors'>>,
  context: DefinitionContext,
  id: string,
  key: string,
): {
  on: 'element' | 'link' | 'actor';
  kind: string;
  properties: Readonly<Record<string, string>>;
  property: PropertyDefinition;
  value: ValueConfig;
} | null => {
  const element = context.elements[id];
  const link = element ? undefined : context.links?.[id];
  const actor = element || link ? undefined : context.actors?.[id];
  const owner = element ?? link ?? actor;
  if (!owner) return null;
  const property = element
    ? propertyOf(definition, owner.kind, key)
    : propertyIn(
        link
          ? linkPropertiesOf(definition, owner.kind)
          : actorPropertiesOf(definition, owner.kind),
        key,
      );
  return property
    ? {
        on: element ? 'element' : link ? 'link' : 'actor',
        kind: owner.kind,
        properties: owner.properties,
        property,
        value: valueOf(property, owner.properties),
      }
    : null;
};

/**
 * A member's type, as its element's pair writes it (goal-controller#135):
 * `bool`, a number (`int`, `number`), or an enum's options (`low|high`).
 */
export type MemberType =
  | { type: 'bool' }
  | { type: 'number' }
  | { type: 'enum'; options: string[] };

const memberTypeOf = (written: string): MemberType =>
  written === 'bool'
    ? { type: 'bool' }
    : written === 'int' || written === 'number'
      ? { type: 'number' }
      : {
          type: 'enum',
          options: written
            .split('|')
            .map((option) => option.trim())
            .filter(Boolean),
        };

/** A member's type in words: `a bool`, `a number`, `one of low, high`. */
export const memberTypeText = (type: MemberType): string =>
  type.type === 'enum' ? `one of ${type.options.join(', ')}` : `a ${type.type}`;

/**
 * The members an element of the model has, by name, with their types: the
 * pairs of its `from` property (`clean:bool, level:number`). Null: it has
 * none written (or isn't an element of the model).
 */
export const membersOf = (
  context: DefinitionContext | undefined,
  ref: string,
  source: MemberSource | undefined,
): Map<string, MemberType> | null => {
  if (!source || source === 'any') return null;
  const text = context?.elements[ref]?.properties[source.from];
  if (text === undefined) return null;
  return new Map(
    parseValue('pairList', text).value.map(
      (pair) => [pair.name, memberTypeOf(pair.value)] as const,
    ),
  );
};

/**
 * The symbol table an `ltl` formula's type check draws on (goal-controller
 * #385): every element of `symbols.predicates`' kind, by id, with its
 * `arguments` pairList's arity; every element with `symbols.entities`'
 * `attributes` pairList set (reusing `membersOf`, not a second resolver),
 * by id, with its attribute names; every element of `symbols.relations`'
 * kind, by id. No `symbols`, or no context: every map empty, the open
 * world for every category.
 */
const symbolTableOf = (
  symbols: FormulaSymbols | undefined,
  context: DefinitionContext | undefined,
): SymbolTable => {
  const predicateArity = new Map<string, number>();
  const attributesOf = new Map<string, ReadonlySet<string>>();
  const relations = new Set<string>();
  if (symbols && context)
    for (const [ref, element] of Object.entries(context.elements)) {
      if (symbols.predicates && element.kind === symbols.predicates.kind)
        predicateArity.set(
          ref,
          parseValue(
            'pairList',
            element.properties[symbols.predicates.arguments] ?? '',
          ).value.length,
        );
      if (symbols.relations && element.kind === symbols.relations.kind)
        relations.add(ref);
      if (symbols.entities) {
        const members = membersOf(context, ref, {
          from: symbols.entities.attributes,
        });
        if (members) attributesOf.set(ref, new Set(members.keys()));
      }
    }
  return { predicateArity, attributesOf, relations };
};

/** A member read: its reference (an id or a name) and its name. */
type MemberUse = { ref: string; member: string };

/**
 * A reference a member follows, as written: a name, or an id with its dots
 * (`room`, `T1.1`). The editors find `ref.` before a position with it.
 */
export const MEMBER_REF = '[A-Za-z_][A-Za-z0-9_]*(?:\\.[0-9]+)*';

/**
 * What is wrong with a member a value reads (`room.dirty`): the value reads
 * no members, the element's kind declares none, or the element has no
 * member of that name. A variable's members are declared by its use.
 */
const memberProblem = (
  value: { members?: MemberSource },
  { ref, member }: MemberUse,
  context: DefinitionContext | undefined,
  definition: Pick<AnyDialect, 'properties'> | undefined,
): string | null => {
  const source = value.members;
  if (!source) return `${ref}.${member}: this value reads no members`;
  if (source === 'any' || !context) return null;
  const element = context.elements[ref];
  if (!element) return null;
  if (
    definition &&
    !(definition.properties[element.kind] ?? []).some(
      (property) => property.key === source.from,
    )
  )
    return `${ref} is a ${element.kind}, which has no members`;
  const members = membersOf(context, ref, source) ?? new Map();
  return members.has(member)
    ? null
    : `${ref} has no member ${member} (${members.size ? `its members: ${[...members.keys()].join(', ')}` : 'it declares none'})`;
};

/**
 * What is wrong with the member a `reference` names (`sump.dirty`,
 * goal-controller#194), as with an assertion's (memberProblem): the named
 * element (`elementOf` finds it) declares none, or none of that name. Null
 * when it names no member, or no element (its name's problem,
 * `danglingName`).
 */
export const referenceMemberProblem = (
  value: Extract<ValueConfig, { type: 'reference' }>,
  text: string,
  elementOf: (
    ref: string,
  ) => Pick<DefinitionContextElement, 'kind' | 'properties'> | undefined,
  definition?: Pick<AnyDialect, 'properties'>,
): string | null => {
  const { ref, member } = referenceParts(value, text);
  const element = member === null ? undefined : elementOf(ref);
  if (member === null || !element) return null;
  const context: DefinitionContext = {
    elements: { [ref]: { ...element, children: [] } },
    variables: [],
  };
  return memberProblem(value, { ref, member }, context, definition);
};

/** A declared member's type, when its element has one of that name. */
const declaredType = (
  value: { members?: MemberSource },
  { ref, member }: MemberUse,
  context: DefinitionContext | undefined,
): MemberType | undefined =>
  membersOf(context, ref, value.members)?.get(member);

/** What is wrong with a member read as a number (in an expression, or compared). */
const numberMemberProblem = (
  value: { members?: MemberSource },
  use: MemberUse,
  context: DefinitionContext | undefined,
  definition: Pick<AnyDialect, 'properties'> | undefined,
): string | null => {
  const problem = memberProblem(value, use, context, definition);
  if (problem) return problem;
  const type = declaredType(value, use, context);
  return type && type.type !== 'number'
    ? `${use.ref}.${use.member} is ${memberTypeText(type)}, not a number`
    : null;
};

const numericProblem = (
  kind: 'int' | 'number',
  text: string,
  { min, max }: { min?: number; max?: number },
): string | null => {
  const read = parseValue(kind, text);
  if (read.errors.length)
    return kind === 'int' ? `Not an integer: ${text}` : `Not a number: ${text}`;
  const n = read.value ?? NaN;
  if (min !== undefined && n < min) return `At least ${min}`;
  if (max !== undefined && n > max) return `At most ${max}`;
  return null;
};

const intProblem = (
  text: string,
  bounds: { min?: number; max?: number },
): string | null => numericProblem('int', text, bounds);

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
    case 'call':
      for (const node of assertionExpressions(tree).flatMap(expressionNodes))
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

/**
 * The element an expression's operand names: an id (`G1`), or a name that is
 * an element's key (an extension's kind's, `E1`, which the expression
 * language reads as a name); null: a variable.
 */
export const elementOfOperand = (
  node: ExpressionTree,
  context: DefinitionContext | undefined,
): string | null =>
  node.kind === 'ref'
    ? node.id
    : node.kind === 'var' && kindOf(context, node.name)
      ? node.name
      : null;

/** The first id of an expression that is not an element of the kinds it resolves. */
const refProblem = (
  tree: ExpressionTree,
  kinds: readonly DialectKind[],
  context: DefinitionContext,
): string | null => {
  for (const node of expressionNodes(tree)) {
    // a member's element (`room.level`): of a kind the value resolves too
    const id =
      node.kind === 'member'
        ? kindOf(context, node.ref)
          ? node.ref
          : null
        : elementOfOperand(node, context);
    if (id === null) continue;
    const kind = kindOf(context, id);
    if (!kind) return `${id} is not an element of this model`;
    if (!(kinds as readonly string[]).includes(kind))
      return kinds.length
        ? `${id} is a ${kind}, not a ${kinds.join(' or ')}`
        : `${id} is a ${kind}: this value names no elements`;
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
  /**
   * its definition: whether a kind declares members (`members.from`), its
   * project resources' labels
   */
  definition?: Pick<AnyDialect, 'properties'> &
    Partial<Pick<AnyDialect, 'projectResources'>>,
): string | null => {
  if (!text.trim()) return null;
  // a list of conditions (goal-controller#232): the first part's problem
  if (value.type === 'assertion' && value.separator) {
    const one = { ...value, separator: undefined };
    for (const part of valueParts(value, text)) {
      const problem = valueProblem(one, part.text, context, definition);
      if (problem) return problem;
    }
    return null;
  }
  switch (value.type) {
    case 'int':
      return intProblem(text, value);
    case 'number':
      return numericProblem('number', text, value);
    case 'bool':
      return parseValue('bool', text).errors.length
        ? `true or false, not ${text}`
        : null;
    case 'enum': {
      const options = value.options.map((o) => o.value).filter(Boolean);
      if (!value.open)
        return enumOptionOf(value, text) !== undefined
          ? null
          : `One of ${options.join(', ')}, not ${text.trim()}`;
      // an open enum takes any value on one line
      return parseValue('enum', text).errors.length
        ? `One line, not ${JSON.stringify(text.trim())}`
        : null;
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
      // a comparison other than a name and a number, where the value
      // declares functions (a member and a number, or a member and a name,
      // `room.mode = low`, is a name's)
      const comparison = comparisonsOf(tree).find(
        (atom) => atom.kind === 'comparison' && !isMemberComparison(atom),
      );
      if (comparison && !value.functions)
        return `A name is compared with a number here, not ${assertionText(comparison)}`;
      for (const expression of assertionExpressions(tree)) {
        const problem = callProblem(expression, value.functions ?? []);
        if (problem) return problem;
      }
      const member = assertionMemberProblem(value, tree, context, definition);
      if (member) return member;
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
        (context
          ? refProblem(read.value, value.resolves ?? [], context)
          : null) ??
        expressionMemberProblem(value, read.value, context, definition)
      );
    }
    case 'refList': {
      const read = parseValue('refList', text);
      if (read.errors.length) return 'Element ids, comma-separated (G2, G5)';
      if (!context) return null;
      for (const id of read.value) {
        const kind = kindOf(context, id);
        if (!kind) return `${id} is not an element of this model`;
        const kinds: readonly string[] = refListKinds(value);
        if (!kinds.includes(kind))
          return `${id} is a ${kind}, not a ${kinds.join(' or ')}`;
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
    case 'nameList':
      return parseValue('nameList', text).errors.length
        ? 'Names, comma-separated (cost, roomTemperature)'
        : null;
    case 'annotatedName': {
      const [error] = parseValue('annotatedName', text).errors;
      return error ? error.message : null;
    }
    case 'reference': {
      // its name, and the member after it when it reads members (`sump.highWater`)
      const { ref: id } = referenceParts(value, text);
      // an imported model names an element by its piStar id, which no
      // grammar reads; any other element's is one id, as the grammar reads
      // a refList's
      if ('kinds' in value.target && context?.iStarIds?.[id] === undefined) {
        const read = parseValue('refList', id);
        if (read.errors.length || read.value.length !== 1)
          return `An element's id (G1), not ${id}`;
      }
      if (!context) return null;
      return (
        danglingName(
          value.target,
          id,
          targetScopeOf(context),
          definition?.projectResources,
        ) ??
        referenceMemberProblem(
          value,
          text,
          (ref) => contextElementOf(context, ref),
          definition,
        )
      );
    }
    case 'probability':
      return probabilityOf(text) === null
        ? `A probability in [0, 1] (0.8, .8 or 80%), not ${text.trim()}`
        : null;
    case 'distribution': {
      const read = readDistribution(text, value);
      return 'error' in read ? read.error : null;
    }
    case 'text':
      return null;
    case 'formula': {
      if (value.language !== 'ltl') return null;
      const { value: formula, errors } = parseLtl(text);
      if (errors.length) return errors[0]!.message;
      if (!formula) return null;
      return (
        ltlTypeProblems(formula, symbolTableOf(value.symbols, context))[0] ??
        null
      );
    }
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
  if (value.type === 'assertion' && value.separator) {
    const one = { ...value, separator: undefined };
    return [
      ...new Set(
        valueParts(value, text).flatMap((part) =>
          unknownNames(one, part.text, context),
        ),
      ),
    ];
  }
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

/** `room.level < 3`, `room.mode = low`: a member compared with a number or a name. */
const isMemberComparison = (
  atom: Extract<AssertionTree, { kind: 'comparison' }>,
): boolean =>
  atom.left.kind === 'member' &&
  (atom.right.kind === 'number' || atom.right.kind === 'var');

/**
 * The first member an expression reads that is wrong (unknown, on a kind
 * without members) or isn't a number (an expression is one).
 */
const expressionMemberProblem = (
  value: { members?: MemberSource },
  tree: ExpressionTree,
  context: DefinitionContext | undefined,
  definition: Pick<AnyDialect, 'properties'> | undefined,
): string | null => {
  for (const node of expressionNodes(tree)) {
    const problem =
      node.kind === 'member' &&
      numberMemberProblem(value, node, context, definition);
    if (problem) return problem;
  }
  return null;
};

/**
 * The first member a condition reads that is wrong, or read as what it
 * isn't: a member alone or set (`room.clean`, `room.clean = true`) is a
 * bool; one compared with a number is a number; one compared with a name,
 * by `=` or `!=`, is an enum and the name one of its options.
 */
const assertionMemberProblem = (
  value: { members?: MemberSource },
  tree: AssertionTree | null,
  context: DefinitionContext | undefined,
  definition: Pick<AnyDialect, 'properties'> | undefined,
): string | null => {
  const text = (use: MemberUse) => `${use.ref}.${use.member}`;
  const asBool = (use: MemberUse): string | null => {
    const problem = memberProblem(value, use, context, definition);
    if (problem) return problem;
    const type = declaredType(value, use, context);
    return type && type.type !== 'bool'
      ? `${text(use)} is ${memberTypeText(type)}: compare it${type.type === 'enum' ? ' with = and one of them' : ' with a number'}`
      : null;
  };
  const walk = (node: AssertionTree | null): string | null => {
    switch (node?.kind) {
      case 'and':
      case 'or':
        return walk(node.left) ?? walk(node.right);
      case 'not':
      case 'paren':
        return walk(node.expr);
      case 'member':
        return asBool(node);
      case 'assign':
        return node.member
          ? asBool({ ref: node.variable, member: node.member })
          : null;
      case 'comparison': {
        if (isMemberComparison(node) && node.left.kind === 'member') {
          const use = node.left;
          const problem = memberProblem(value, use, context, definition);
          if (problem) return problem;
          const type = declaredType(value, use, context);
          if (type?.type === 'enum') {
            if (node.operator !== '=' && node.operator !== '!=')
              return `${text(use)} is ${memberTypeText(type)}: compare it with = or !=`;
            if (
              node.right.kind !== 'var' ||
              !type.options.includes(node.right.name)
            )
              return `${text(use)} is ${memberTypeText(type)}, not ${expressionText(node.right)}`;
            return null;
          }
          if (type?.type === 'bool')
            return `${text(use)} is a bool: write ${text(use)}, or ${text(use)} = true`;
          if (type?.type === 'number' && node.right.kind !== 'number')
            // a number member compared with a variable: a number variable
            return null;
        }
        for (const side of [node.left, node.right])
          for (const part of expressionNodes(side)) {
            const problem =
              part.kind === 'member' &&
              part !== node.left &&
              numberMemberProblem(value, part, context, definition);
            if (problem) return problem;
          }
        return null;
      }
      case 'call':
        for (const part of node.args.flatMap(expressionNodes)) {
          if (part.kind !== 'member') continue;
          const problem = memberProblem(value, part, context, definition);
          if (problem) return problem;
        }
        return null;
      default:
        return null;
    }
  };
  return walk(tree);
};
