/**
 * Helpers that build a definition's pieces with their literal types, so a
 * definition names no schema type and writes no `as const satisfies`: each
 * returns exactly the object written by hand (`property.int('maxRetries',
 * { min: 0, help })` is `{ key: 'maxRetries', value: { type: 'int', min: 0 },
 * help }`), and `defineDialect` / `defineExtension` read it as before.
 * Sugar only: a definition written as literals still compiles.
 */
import {
  type ActorPropertyDefinition,
  type AssertionPrefix,
  type Condition,
  type ConditionalValue,
  type ConstructDefinition,
  type ElementDefinition,
  type DialectKind,
  type ExtensionElementDefinition,
  type ExtensionLinkDefinition,
  type FunctionDefinition,
  type MemberSource,
  type ISTAR_LINK_KINDS,
  type ModifierDefinition,
  type NotationDefinition,
  type ProblemKind,
  type ProjectResourceDefinition,
  type PropertyDefinition,
  type ResourceCandidates,
  type Severity,
} from './schema';

type Prettify<T> = { [K in keyof T]: T[K] } & {};

/** What every property takes besides its value: `C` is the names its check may take. */
export type PropertyOptions<C extends string = string> = {
  help: string;
  input?: { placeholder?: string };
  applies?: Condition;
  required?: Condition;
  notApplying?: string;
  check?: C;
  inspector?: boolean;
  servedBy?: 'engine';
  /** an actor property's actor kinds (`actors`) */
  kinds?: readonly string[];
};

/** `P`, with any key `Allowed` hasn't rejected (a misspelt option doesn't compile). */
type Exact<P, Allowed> = P & Record<Exclude<keyof P, keyof Allowed>, never>;

/** The property `property.<type>` builds: its key, its value, the rest of its options. */
type Built<
  K extends string,
  T extends string,
  P,
  V extends PropertyKey,
  Extra = unknown,
> = Prettify<
  {
    key: K;
    value: Prettify<{ type: T } & Extra & Pick<P, V & keyof P>>;
  } & Omit<P, V>
>;

/** An enum option as written: a value that is its own label, or `[value, label]`. */
export type EnumOptionInput = string | readonly [value: string, label: string];

type EnumOptionsOf<O extends readonly EnumOptionInput[]> = {
  -readonly [I in keyof O]: O[I] extends readonly [
    infer V extends string,
    infer L extends string,
  ]
    ? { value: V; label: L }
    : O[I] extends string
      ? { value: O[I]; label: O[I] }
      : never;
};

/** `{ key, value: { type, ...the value's options }, ...the rest }`, in the order written. */
const build = (
  key: string,
  type: string,
  options: Readonly<Record<string, unknown>>,
  valueKeys: readonly string[],
  extra: Readonly<Record<string, unknown>> = {},
): PropertyDefinition => {
  const value: Record<string, unknown> = { type, ...extra };
  const rest: Record<string, unknown> = {};
  for (const [name, option] of Object.entries(options))
    (valueKeys.includes(name) ? value : rest)[name] = option;
  return { key, value, ...rest } as PropertyDefinition;
};

type EnumOptions = { open?: boolean; caseInsensitive?: true };
const INT_KEYS = ['min', 'max'] as const;
const ASSERTION_KEYS = [
  'resolves',
  'prefixes',
  'decimals',
  'booleanInequality',
  'declaresVariables',
  'separator',
  'functions',
  'members',
] as const;
const EXPRESSION_KEYS = ['resolves', 'functions', 'members'] as const;
const OCL_KEYS = ['declaredBy', 'candidates', 'memberCandidates'] as const;

type IntOptions = { min?: number; max?: number };
type AssertionOptions = {
  resolves: readonly (DialectKind | 'variable')[];
  prefixes?: readonly AssertionPrefix[];
  decimals?: boolean;
  booleanInequality?: boolean;
  declaresVariables?: boolean;
  separator?: string;
  functions?: readonly FunctionDefinition[];
  members?: MemberSource;
};
type ExpressionOptions = {
  resolves?: readonly DialectKind[];
  functions?: readonly FunctionDefinition[];
  members?: MemberSource;
};
type OclOptions = {
  declaredBy?: readonly string[];
  candidates?: ResourceCandidates;
  memberCandidates?: ResourceCandidates;
};

/** One constructor per value type, with `check` taking the names `C`. */
const builders = <C extends string>() => ({
  /**
   * `''` stands for "not set"; `open`: values besides the options may be
   * written; `caseInsensitive`: an option is read in any case, as its value
   */
  enum: <
    const K extends string,
    const O extends readonly EnumOptionInput[],
    const P extends PropertyOptions<C> & EnumOptions,
  >(
    key: K,
    options: O,
    rest: Exact<P, PropertyOptions<C> & EnumOptions>,
  ): Built<K, 'enum', P, keyof EnumOptions, { options: EnumOptionsOf<O> }> =>
    build(key, 'enum', rest, ['open', 'caseInsensitive'], {
      options: options.map((option) =>
        typeof option === 'string'
          ? { value: option, label: option }
          : { value: option[0], label: option[1] },
      ),
    }) as never,
  int: <
    const K extends string,
    const P extends PropertyOptions<C> & IntOptions,
  >(
    key: K,
    rest: Exact<P, PropertyOptions<C> & IntOptions>,
  ): Built<K, 'int', P, (typeof INT_KEYS)[number]> =>
    build(key, 'int', rest, INT_KEYS) as never,
  number: <const K extends string, const P extends PropertyOptions<C>>(
    key: K,
    rest: Exact<P, PropertyOptions<C>>,
  ): Built<K, 'number', P, never> => build(key, 'number', rest, []) as never,
  text: <const K extends string, const P extends PropertyOptions<C>>(
    key: K,
    rest: Exact<P, PropertyOptions<C>>,
  ): Built<K, 'text', P, never> => build(key, 'text', rest, []) as never,
  bool: <const K extends string, const P extends PropertyOptions<C>>(
    key: K,
    rest: Exact<P, PropertyOptions<C>>,
  ): Built<K, 'bool', P, never> => build(key, 'bool', rest, []) as never,
  annotatedName: <const K extends string, const P extends PropertyOptions<C>>(
    key: K,
    rest: Exact<P, PropertyOptions<C>>,
  ): Built<K, 'annotatedName', P, never> =>
    build(key, 'annotatedName', rest, []) as never,
  /** a condition; its identifiers name elements of the `resolves` kinds, or variables */
  assertion: <
    const K extends string,
    const P extends PropertyOptions<C> & AssertionOptions,
  >(
    key: K,
    rest: Exact<P, PropertyOptions<C> & AssertionOptions>,
  ): Built<K, 'assertion', P, (typeof ASSERTION_KEYS)[number]> =>
    build(key, 'assertion', rest, ASSERTION_KEYS) as never,
  /** a numeric expression: numbers, `+ - * /`, ids, variables, calls to `functions` */
  expression: <
    const K extends string,
    const P extends PropertyOptions<C> & ExpressionOptions,
  >(
    key: K,
    rest: Exact<P, PropertyOptions<C> & ExpressionOptions>,
  ): Built<K, 'expression', P, (typeof EXPRESSION_KEYS)[number]> =>
    build(key, 'expression', rest, EXPRESSION_KEYS) as never,
  /**
   * ids of elements of a kind (iStar's, or an extension's), or of one of
   * several kinds (goal-controller#270), comma-separated
   */
  refList: <
    const K extends string,
    const E extends DialectKind | readonly DialectKind[],
    const P extends PropertyOptions<C>,
  >(
    key: K,
    kind: E,
    rest: Exact<P, PropertyOptions<C>>,
  ): Built<
    K,
    'refList',
    P,
    never,
    E extends readonly DialectKind[] ? { kinds: E } : { kind: E }
  > =>
    build(
      key,
      'refList',
      rest,
      [],
      typeof kind === 'string' ? { kind } : { kinds: kind },
    ) as never,
  /** one element's id, of one of these kinds (an anchor goal) */
  reference: <
    const K extends string,
    const E extends readonly DialectKind[],
    const P extends PropertyOptions<C>,
  >(
    key: K,
    kinds: E,
    rest: Exact<P, PropertyOptions<C>>,
  ): Built<K, 'reference', P, never, { kinds: E }> =>
    build(key, 'reference', rest, [], { kinds }) as never,
  /** a sentence of a formal language, tagged with it (`ltl`); nothing checks it yet */
  formula: <
    const K extends string,
    const L extends string,
    const P extends PropertyOptions<C>,
  >(
    key: K,
    language: L,
    rest: Exact<P, PropertyOptions<C>>,
  ): Built<K, 'formula', P, never, { language: L }> =>
    build(key, 'formula', rest, [], { language }) as never,
  /** a probability in [0, 1]: `0.8`, `.8` or `80%`, kept as written */
  probability: <const K extends string, const P extends PropertyOptions<C>>(
    key: K,
    rest: Exact<P, PropertyOptions<C>>,
  ): Built<K, 'probability', P, never> =>
    build(key, 'probability', rest, []) as never,
  /** `name:value` pairs, comma-separated */
  pairList: <
    const K extends string,
    const V extends 'int' | 'number' | 'text',
    const P extends PropertyOptions<C>,
  >(
    key: K,
    value: V,
    rest: Exact<P, PropertyOptions<C>>,
  ): Built<K, 'pairList', P, never, { value: V }> =>
    build(key, 'pairList', rest, [], { value }) as never,
  /** OCL as MutRoSe writes it */
  ocl: <
    const K extends string,
    const P extends PropertyOptions<C> & OclOptions,
  >(
    key: K,
    rest: Exact<P, PropertyOptions<C> & OclOptions>,
  ): Built<K, 'ocl', P, (typeof OCL_KEYS)[number]> =>
    build(key, 'ocl', rest, OCL_KEYS) as never,
  /** a value config that depends on another property */
  conditional: <
    const K extends string,
    const V extends ConditionalValue,
    const P extends PropertyOptions<C>,
  >(
    key: K,
    value: V,
    rest: Exact<P, PropertyOptions<C>>,
  ): Prettify<{ key: K; value: V } & P> => ({ key, value, ...rest }) as never,
});

/**
 * A property, by its value type: `property.int('maxRetries', { min: 0, help,
 * check })`. `property.for<CheckName>()` is the same with `check` taking only
 * an engine's check names (a misspelt one doesn't compile where it is written).
 */
export const property = {
  ...builders<string>(),
  for: <C extends string>() => builders<C>(),
};

/**
 * An element kind: `element('G', { fill })`, `element({ fill })` for a
 * dialect without ids; `declares`, `annotated` as ElementDefinition has them.
 */
export function element<
  const P extends NonNullable<ElementDefinition['prefix']>,
  const O extends Omit<ElementDefinition, 'prefix'>,
>(
  prefix: P,
  options: Exact<O, Omit<ElementDefinition, 'prefix'>>,
): Prettify<{ prefix: P } & O>;
export function element<const O extends Omit<ElementDefinition, 'prefix'>>(
  options: Exact<O, Omit<ElementDefinition, 'prefix'>>,
): O;
export function element(
  prefixOrOptions: string | Omit<ElementDefinition, 'prefix'>,
  options?: Omit<ElementDefinition, 'prefix'>,
): ElementDefinition {
  return typeof prefixOrOptions === 'string'
    ? ({ prefix: prefixOrOptions, ...options } as ElementDefinition)
    : prefixOrOptions;
}

/**
 * The goal language's operator symbols a notation may enable, by form (its
 * catalog's INFIX_SYMBOLS, PREFIX_SYMBOLS, POSTFIX_SYMBOLS, CALLS and
 * STANDALONE_SYMBOLS; its tests pin them): what `notation()` completes.
 */
export const NOTATION_SYMBOLS = {
  infix: ['^', '|', '?', '+', '&', '#', '~', ';', '->', ','],
  prefix: ['!'],
  postfix: ['@'],
  calls: ['FALLBACK', 'DM'],
  standalone: ['+', '*', '?', '#'],
} as const;

type SymbolsOf<F extends keyof typeof NOTATION_SYMBOLS> =
  (typeof NOTATION_SYMBOLS)[F][number];
/** A symbol a notation's `operators` may map to a construct (or, postfix, a modifier). */
export type NotationOperatorSymbol = SymbolsOf<
  'infix' | 'prefix' | 'postfix' | 'calls'
>;
/** A symbol a notation's `standalone` may map to a construct. */
export type NotationStandaloneSymbol = SymbolsOf<'standalone'>;

/** A notation as `notation()` takes it: its operators by the catalog's symbols. */
export type NotationInput = Omit<
  NotationDefinition,
  'operators' | 'standalone'
> & {
  operators: { readonly [S in NotationOperatorSymbol]?: string };
  standalone?: { readonly [S in NotationStandaloneSymbol]?: string };
};

/** A dialect's notation, its operator symbols completed from the goal language's catalog. */
export const notation = <const N extends NotationInput>(
  definition: Exact<N, NotationInput>,
): N => definition;

/** Constructs, by name, in the order editors list them. */
export const constructs = <
  const C extends Readonly<Record<string, ConstructDefinition>>,
>(
  definitions: C,
): C => definitions;

/** What a postfix operator means. */
export const modifier = <const M extends ModifierDefinition>(
  definition: Exact<M, ModifierDefinition>,
): M => definition;

/** How serious each notation/structure mismatch is, and its message. */
export const problems = <
  const P extends Readonly<
    Record<ProblemKind, { severity: Severity; message: string }>
  >,
>(
  definitions: P,
): P => definitions;

/** The files beside a model a dialect reads, by kind. */
export const projectResources = <
  const R extends Readonly<Record<string, ProjectResourceDefinition>>,
>(
  definitions: R,
): R => definitions;

type LinkKind = (typeof ISTAR_LINK_KINDS)[number] | `${string}.${string}`;

/** Properties on links, by link kind (iStar's completed, or an extension's). */
export const links = <
  const L extends {
    readonly [K in LinkKind]?: readonly PropertyDefinition[];
  },
>(
  definitions: L,
): L => definitions;

/** Properties on actors. */
export const actors = <const A extends readonly ActorPropertyDefinition[]>(
  definitions: A,
): A => definitions;

/** A kind an extension adds: `extensionKind('grl.Belief', { category: 'node', … })`. */
export const extensionKind = <
  const K extends string,
  const O extends Omit<ExtensionElementDefinition, 'kind'>,
>(
  kind: K,
  options: Exact<O, Omit<ExtensionElementDefinition, 'kind'>>,
): Prettify<{ kind: K } & O> => ({ kind, ...options }) as never;

/** A link kind an extension adds: `extensionLink('grl.BeliefLink', { rules, … })`. */
export const extensionLink = <
  const K extends string,
  const O extends Omit<ExtensionLinkDefinition, 'kind'>,
>(
  kind: K,
  options: Exact<O, Omit<ExtensionLinkDefinition, 'kind'>>,
): Prettify<{ kind: K } & O> => ({ kind, ...options }) as never;
