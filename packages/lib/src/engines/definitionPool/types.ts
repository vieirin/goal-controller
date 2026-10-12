/**
 * A definition pool (goal-controller#59): one set of definitions and
 * references across a project's files, whatever their formats, served as
 * one language. The core knows no format and no dialect: an engine plugs in
 * providers, each speaking some documents, extracting their definitions and
 * references with ranges, and checking what spans them.
 */

/** A document of the project, as a provider reads it. */
export type PoolDocument = {
  /** a resource file's path; `model` for the goal model */
  id: string;
  /** a project-resource kind (`world`, `hddl`), or `model` */
  kind: string;
  /** a file's text */
  text?: string;
  /** the goal model's view (goal-tree's GoalView, a DocumentTree) */
  value?: unknown;
};

/**
 * Where something is: offsets in a document. A resource's document is its
 * path; the goal model's fields are each a document of their own,
 * `model:<element key>:<field>` (`id`, `name` or a property key), so a
 * location doesn't depend on any view of the model.
 */
export type PoolLocation = { document: string; from: number; to: number };

export type PoolDefinition = {
  /** unique in the pool: `${kind}:${owner ? owner + '/' : ''}${name, normalized}` */
  id: string;
  /** qualified by its provider: `hddl.task`, `world.class` */
  kind: string;
  /** as written */
  name: string;
  location: PoolLocation;
  /** the definition it belongs to (a class's attribute, a task's parameter) */
  owner?: string;
  /** its type, when it has one (`Sequence(Request)`, `Boolean`, `location`) */
  type?: string;
  /** a word on it, for hover and completion */
  detail?: string;
};

/**
 * Where a reference's name is looked up: among an owner's members, or among
 * the members of what another reference's target leads to (`through`:
 * `type`, the definition its type names; or a resolver the engine
 * registers). Without one, among the definitions without an owner.
 */
export type PoolScope =
  | { owner: string }
  | { via: PoolReference; through: string };

export type PoolReference = {
  /** the qualified kinds it may resolve to, in order */
  kinds: readonly string[];
  /** as written */
  name: string;
  location: PoolLocation;
  scope?: PoolScope;
  /**
   * resolving to nothing is reported elsewhere (a property check), not as
   * the pool's `unresolved-reference`
   */
  silent?: boolean;
};

export type PoolFacts = {
  definitions: PoolDefinition[];
  references: PoolReference[];
};

export type PoolDiagnostic = PoolLocation & {
  severity: 'error' | 'warning' | 'info';
  message: string;
  /** what found it: `unknown-hddl-task` */
  check: string;
};

export type PoolCompletion = {
  label: string;
  /** the qualified kind of what it inserts */
  kind: string;
  detail?: string;
  /** the range it replaces */
  from: number;
  to: number;
};

/** A text edit in a document (`renameEdits`). */
export type PoolEdit = PoolLocation & { text: string };

export type PoolKind = {
  /** shown to people: `HDDL task` */
  label: string;
  /** names compare lowercased (HDDL's) */
  caseInsensitive?: boolean;
  /**
   * `owner`: only among its owner's members (a task's parameter); `global`
   * (the default): among the definitions without an owner too
   */
  scope?: 'global' | 'owner';
};

/** What a provider reads of the pool, while it checks or completes. */
export type PoolLookup = {
  /** a definition by id */
  definition(id: string): PoolDefinition | undefined;
  /** the definitions of a qualified kind */
  definitionsOf(kind: string): readonly PoolDefinition[];
  /** a definition by kinds and name, among an owner's members (then the global ones) */
  find(
    kinds: readonly string[],
    name: string,
    owner?: string,
  ): PoolDefinition | undefined;
  /** what a reference resolves to */
  target(reference: PoolReference): PoolDefinition | undefined;
  /** the references that resolve to a definition */
  referencesTo(id: string): readonly PoolReference[];
  /** every reference, with the provider that made it */
  references(): readonly PoolReference[];
  /** the documents the pool was built from, by id */
  documents: ReadonlyMap<string, PoolDocument>;
  /** whether any document of a kind is present (`world`, `model`) */
  has(kind: string): boolean;
};

/** A plug-in: the documents it speaks, what it defines, what it refers to. */
export type PoolProvider = {
  /** its namespace: its kinds are `${id}.${kind}` */
  id: string;
  documents: {
    /** project-resource kinds (`hddl`) */
    resources?: readonly string[];
    /** file extensions (`.hddl`) */
    extensions?: readonly string[];
    /** the goal model */
    model?: boolean;
  };
  /** the kinds it defines, unqualified (`task`: `hddl.task`) */
  kinds: Readonly<Record<string, PoolKind>>;
  /** the qualified kinds it refers to (its own or other providers') */
  refers?: readonly string[];
  /** a document's definitions and references (cached by its text or value) */
  extract(document: PoolDocument): PoolFacts;
  /** what is wrong, reading the whole pool */
  checks?: (pool: PoolLookup) => PoolDiagnostic[];
  /** what may be written at an offset of one of its documents */
  complete?: (
    pool: PoolLookup,
    document: PoolDocument,
    offset: number,
  ) => PoolCompletion[];
  /**
   * the text a definition's new name is written as at a location (HDDL
   * keeps a parameter's `?`); null: it can't be renamed so
   */
  renameText?: (definition: PoolDefinition, newName: string) => string | null;
};

/** An engine's pool: its providers and the glue between them. */
export type PoolRegistration = {
  engine: string;
  providers: readonly PoolProvider[];
  /** checks that span providers (MutRoSe's cross-file checks) */
  checks?: (pool: PoolLookup) => PoolDiagnostic[];
  /** a scope's `through`, besides `type`: from a definition, the owner to look in */
  resolvers?: Readonly<
    Record<
      string,
      (definition: PoolDefinition, pool: PoolLookup) => string | undefined
    >
  >;
  /** the definition a type names (`Sequence(Room)` → `world.class:Room`), for `through: 'type'` */
  typeDefinition?: (type: string, pool: PoolLookup) => string | undefined;
};
