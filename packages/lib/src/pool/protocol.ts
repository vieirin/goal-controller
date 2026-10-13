/**
 * The definition pool's protocol (goal-controller#82): what an engine
 * declares, and nothing else. An engine lists its files (a parser from a
 * closed set, and the file's schema), marks on the schema what the file
 * defines and what it refers to, names its kinds, and adds TypeScript
 * checks over the typed, resolved pool. The core reads the files, resolves
 * the names and serves every editor service from that; an engine never
 * parses, emits facts or resolves. README.md says it all in prose.
 */
import { check } from 'zod/mini';
import type { $ZodCheck, $ZodType } from 'zod/v4/core';
import type { AstNode, LangiumCoreServices } from 'langium';

/**
 * A kind of definition: `<namespace>.<name>` (`gm.task`). The namespace is
 * a word for people; any file of the engine may define any kind.
 */
export type Kind = string;

/**
 * Where a related value is, from the annotated one. Lists don't count as
 * levels; objects (and a Langium node) do.
 * - `'task_id'`: a key of the object the value is in;
 * - `'../task_id'`: a key of the object that one is in (one `../` a level);
 * - `'^task_id'`: the nearest enclosing object (this one first) that has the key;
 * - `scope.previous(path)`: in a list, the item before this one; for the
 *   first item, `path` (`a.b.c`: `b`'s previous is `a`, `c`'s is `b`).
 */
export type Path = string | { previous: Path };

/**
 * Where a reference's name is looked up. A closed set:
 * - global (no scope): among the definitions of its kinds without an owner;
 * - `owner`: among the members of what the value at `path` defines or
 *   resolves to, then the owner's owner's, then the global ones (unless
 *   the kind says `scope: 'owner'`);
 * - `through`: among the members of what is reached from the definition
 *   the value at `path` resolves to, by a link (`link(name)` declares one;
 *   `'type'` is built in: the definition its type names, `typeOf`).
 */
export type Scope = { owner: Path } | { through: string; path: Path };

export const scope = {
  owner: (path: Path): Scope => ({ owner: path }),
  through: (link: string, path: Path): Scope => ({ through: link, path }),
  previous: (first: Path): Path => ({ previous: first }),
};

/**
 * The part of a string that is the name, and where it starts in it (null:
 * none, it neither defines nor refers). `"Sequence(Room)"`: `Room`, at 9.
 */
export type NamePart = (
  text: string,
) => { text: string; offset: number } | null;

/** A definition's value, where it is (its every use, with `firstUse`). */
export type Occurrence = {
  /** the annotated value (a record's key: the key) */
  value: unknown;
  /** the object or record it is in */
  parent: unknown;
  /** as written: the value's text, or that of `parent`'s `key` */
  text(key?: string | number): string | undefined;
};

/**
 * A definition's type (#58): the text at a path (`'type'`), a literal,
 * or computed from its occurrences and its file's value, with no lookup.
 */
export type TypeSource =
  | Path
  | { literal: string }
  | ((occurrences: readonly Occurrence[], root: unknown) => string | undefined);

export type DefinesOptions = {
  type?: TypeSource;
  /** the definition it is a member of: what the value at the path defines or resolves to */
  owner?: Path;
  /** the part of the string that is the name (the whole string: none given) */
  name?: NamePart;
  /**
   * the first occurrence (of the kind, owner and name, in its document)
   * defines it, and the later ones refer to it: an XML class is defined by
   * its first tag, a variable by its first use
   */
  firstUse?: boolean;
};

/** What a reference that resolves to nothing is: a message of the engine's, or nothing the pool says. */
export type Unresolved<M extends string = string> =
  | false
  | { severity: Severity; message: M };

export type RefersToOptions<M extends string = string> = {
  /** the part of the string that is the name */
  name?: NamePart;
  /**
   * resolving to nothing: by default the pool's `unresolved-reference`
   * warning; a key of the engine's `messages` (with `name`, `kind`,
   * `owner` and `candidates` as args); or `false` when a check says it
   */
  unresolved?: Unresolved<M>;
};

export type Annotation =
  | ({ defines: Kind } & DefinesOptions)
  | ({ refersTo: readonly Kind[]; scope?: Scope } & RefersToOptions)
  | { link: string; from?: Path }
  | { written: Parser; part?: NamePart };

const annotations = new WeakMap<object, Annotation>();

/** What a check on a schema means to the pool (none: it's Zod's own). */
export const annotationOf = (zodCheck: object): Annotation | undefined =>
  annotations.get(zodCheck);

/** An annotation, as a check on a Zod schema (`.check(…)`) or in a Langium map. */
// any: it goes on a schema of any output (it accepts everything)
// oxlint-disable-next-line no-explicit-any
export type Annotated = $ZodCheck<any>;

const annotate = (annotation: Annotation): Annotated => {
  // a check that accepts everything: Zod carries it, the pool reads it
  const marker = check(() => {}) as Annotated;
  annotations.set(marker, annotation);
  return marker;
};

/** The value (a string, a record's key, a Langium node) defines a `kind`. */
export const defines = (kind: Kind, options: DefinesOptions = {}) =>
  annotate({ defines: kind, ...options });

/** The value is a name of one of `kinds`: the first that has it wins. */
export const refersTo = (
  kinds: Kind | readonly Kind[],
  where?: Scope,
  options: RefersToOptions = {},
) =>
  annotate({
    refersTo: typeof kinds === 'string' ? [kinds] : kinds,
    ...(where && { scope: where }),
    ...options,
  });

/**
 * On a reference (with its `refersTo`): links a definition to the
 * reference's target, by `name`. The definition is the value's object's (a
 * sibling's `defines`; else the nearest enclosing one), or the one at
 * `from`. `scope.through(name, …)` and `TypedPool.links` follow it.
 */
export const link = (name: string, options: { from?: Path } = {}) =>
  annotate({ link: name, ...options });

/**
 * The string is written in a Langium language (`langium(…)` with a start
 * rule): its nodes are read with their annotations, at their offsets in the
 * string (or in its `part`).
 */
export const written = (parser: Parser, options: { part?: NamePart } = {}) =>
  annotate({ written: parser, ...options });

// ---------------------------------------------------------------- parsers

declare const parserBrand: unique symbol;
/**
 * One of the core's parsers: `json`, `xml`, `yaml`, `goalModel` or
 * `langium(…)` (parsers.ts). An engine doesn't write one.
 */
export type Parser = { readonly [parserBrand]: true; readonly name: string };

/**
 * A language's AST types by name, as `langium generate` writes them
 * (`<Language>AstType` in its ast.ts). Untyped: any name, any property.
 */
export type UntypedAst = Record<string, AstNode & Record<string, unknown>>;

/** An AST type's own properties (not Langium's `$` ones). */
type PropertyOf<N> = Exclude<keyof N & string, `$${string}`>;

/**
 * How a Langium language is read, typed by its AST types (`A`, the
 * generated `<Language>AstType`) and the engine's kinds (`K`):
 * `langium<ToyAstType>(services, { start: 'Model', ... })`.
 */
export type LangiumOptions<
  K extends string = Kind,
  A extends object = UntypedAst,
> = {
  /**
   * the rule a text starts with (the grammar's entry rule: none given). It
   * is typed by the AST types' names, which the rules started from are.
   */
  start?: keyof A & string;
  /**
   * AST types as the pool's kinds: a node of a mapped type with a `name`
   * defines it (a member of the nearest enclosing definition); a
   * cross-reference (`[Type:ID]`) to a mapped type refers to it, looked up
   * from the nearest enclosing definition outwards
   */
  kinds?: { readonly [T in keyof A & string]?: K };
  /**
   * AST types that own the members written in them, as a definition does,
   * without being one (a quantifier's variables)
   */
  scopes?: readonly (keyof A & string)[];
  /**
   * what the grammar can't say: per AST type, per property, its
   * annotations (or, given the node, which ones apply)
   */
  annotate?: {
    readonly [T in keyof A & string]?: {
      readonly [P in PropertyOf<A[T]>]?:
        | readonly Annotated[]
        | ((node: A[T]) => readonly Annotated[]);
    };
  };
};

/** A Langium language's services (its generated module, injected), parser only. */
export type LangiumGrammar<A extends object = UntypedAst> =
  LangiumCoreServices & {
    /**
     * the AST types it parses (`<Language>AstType`), for the type checker
     * only: a language types its services so, and `langium(…)` infers them
     */
    readonly $ast?: A;
  };

// ---------------------------------------------------------------- files

export type FileDeclaration = {
  /** the document kind it is: a project-resource kind (`configuration`), or `model` */
  kind: string;
  /** files it also reads, by extension (with the dot) */
  extensions?: readonly string[];
  parser: Parser;
  /** what its value must be (Zod, classic or mini); none for a `langium` file */
  schema?: $ZodType;
};

export type DeclaredFile = Readonly<FileDeclaration> & {
  readonly declared: 'file';
};

// ---------------------------------------------------------------- checks

/** Where something is: offsets in a document (a goal-model field's: `model:<key>:<field>`). */
export type Location = { document: string; from: number; to: number };

export type Severity = 'error' | 'warning' | 'info';

/** A message's args: placed at `{name}` in its text, or given to its function. */
export type MessageArgs = Readonly<Record<string, string | number>>;

/**
 * What a check finds. `check` is a key of the engine's `messages` (the text
 * is its, with `args`). An engine without `messages` may give the text itself.
 */
export type Problem<M extends string = string> = Location & {
  severity: Severity;
  check: M;
  args?: MessageArgs;
};

type Located<M extends string> = {
  location: Location;
  /** the file kind it is in, and the document */
  file: string;
  /**
   * the document it was read from (`model`); `location.document` is where
   * its name is written (`model:<key>:<field>`)
   */
  document: string;
  /** where it is in its document's typed value */
  path: readonly (string | number)[];
  /** the typed value annotated (a string; an object; a Langium node) */
  value: unknown;
  /** the object (or Langium node) it is in */
  parent: unknown;
  /** a problem at its name */
  problem(severity: Severity, check: M, args?: MessageArgs): Problem<M>;
};

/** A definition as a check reads it. */
export type Definition<
  K extends string = Kind,
  M extends string = string,
> = Located<M> & {
  kind: K;
  name: string;
  /** the definition it is a member of */
  owner?: Definition<K, M>;
  type?: string;
};

/** A reference as a check reads it. */
export type Reference<
  K extends string = Kind,
  M extends string = string,
> = Located<M> & {
  kinds: readonly K[];
  name: string;
  /** what it resolves to */
  target?: Definition<K, M>;
  /** the definition of its object (as `link`'s) */
  owner?: Definition<K, M>;
};

/**
 * The resolved pool, as an engine's checks read it: typed by the engine's
 * kinds (`K`) and its messages' keys (`M`).
 */
export type TypedPool<
  K extends string = Kind,
  M extends string = string,
  L extends string = string,
> = {
  /** every definition of a kind */
  definitions(kind: K): readonly Definition<K, M>[];
  /** every reference to one of these kinds (none given: all) */
  references(kinds?: K | readonly K[]): readonly Reference<K, M>[];
  /** the references that resolve to a definition */
  referencesTo(definition: Definition<K, M>): readonly Reference<K, M>[];
  /** where a definition's links of a name lead */
  links(
    name: L,
    definition: Definition<K, M> | undefined,
  ): readonly Definition<K, M>[];
  /** the definition a definition's type names (`typeOf`) */
  typeOf(definition: Definition<K, M>): Definition<K, M> | undefined;
  /** a definition by kinds and name: in an owner (and its owners), then globally */
  find(
    kinds: K | readonly K[],
    name: string,
    owner?: Definition<K, M>,
  ): Definition<K, M> | undefined;
  /** whether the project has a document of this file kind */
  has(file: string): boolean;
  /** the typed values of a file kind's documents (what their schema accepted) */
  values(file: string): readonly { document: string; value: unknown }[];
  /** where a path of a document's typed value is written */
  locate(
    document: string,
    path: readonly (string | number)[],
  ): Location | undefined;
  /** a problem anywhere */
  problem(
    location: Location,
    severity: Severity,
    check: M,
    args?: MessageArgs,
  ): Problem<M>;
};

export type Check<
  K extends string = Kind,
  M extends string = string,
  L extends string = string,
> = (pool: TypedPool<K, M, L>) => readonly Problem<M>[];

// ---------------------------------------------------------------- engines

export type KindDeclaration<K extends string = Kind> = {
  /** shown to people (`location type`) */
  label: string;
  /** names compare lowercased */
  caseInsensitive?: boolean;
  /** `owner`: only among its owner's members, never globally */
  scope?: 'global' | 'owner';
  /** a definition nothing refers to is a warning */
  reportUnused?: boolean;
  /**
   * renaming: the text a new name is written as (null: not a name of this
   * kind; a format may keep a sigil, `?x`), or `false`: it isn't renamed here
   */
  rename?: false | ((newName: string) => string | null);
  /**
   * the definition a type of this kind's definitions names (`scope.through('type', …)`):
   * among `kinds`, by the type's `name` (null: it names none, `Integer`)
   */
  typeOf?: {
    kinds: readonly K[];
    name?: (type: string) => string | null;
  };
};

/** A message: a text with `{arg}`s, or a function of the args. */
export type Message = string | ((args: MessageArgs) => string);

/**
 * An engine: its files, its kinds (`K`, their names) and its checks'
 * messages (`M`, their keys). Both are inferred from the declaration, and
 * the checks are typed by them.
 */
export type EngineDeclaration<
  K extends string = Kind,
  M extends string = string,
  L extends string = string,
> = {
  files: readonly DeclaredFile[];
  kinds: Readonly<Record<K, KindDeclaration<NoInfer<K>>>>;
  checks?: readonly Check<NoInfer<K>, NoInfer<M>, NoInfer<L>>[];
  /** the text of each check's problems, by the check's key */
  messages?: Readonly<Record<M, Message>>;
  /** the links its files declare (`link(name)`): none given, any name */
  links?: readonly L[];
};

export type DeclaredEngine<
  K extends string = Kind,
  M extends string = string,
  L extends string = string,
> = Readonly<EngineDeclaration<K, M, L>> & {
  readonly declared: 'engine';
};

export const defineFile = (declaration: FileDeclaration): DeclaredFile => ({
  ...declaration,
  declared: 'file',
});

export const defineEngine = <
  K extends string,
  M extends string = string,
  L extends string = string,
>(
  declaration: EngineDeclaration<K, M, L>,
): DeclaredEngine<K, M, L> => ({ ...declaration, declared: 'engine' });
