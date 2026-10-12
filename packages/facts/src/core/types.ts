/**
 * The plug-in surface (agreed with #59's design, so the two differ in how
 * they evaluate, not in how an engine plugs a file kind in): a provider
 * speaks some documents, extracts definitions and references with their
 * locations, and may add rules. The core knows no format and no dialect.
 */
import type { Value } from '../datalog/syntax';

/** A document of a project: a resource's file (`text`), or the goal model (`value`). */
export type PoolDocument = {
  /** a resource's path; a goal model's field: `model:<elementKey>:<field>` */
  id: string;
  /** a project-resource kind (`world`, `hddl`), or `model` */
  kind: string;
  text?: string;
  value?: unknown;
};

/** Where a name is written: offsets in its document's text. */
export type PoolLocation = { document: string; from: number; to: number };

export type PoolDefinition = {
  /** unique in the pool: `${kind}:${owner ? owner + '/' : ''}${name}` by convention */
  id: string;
  /** qualified by its provider: `hddl.task` */
  kind: string;
  /** as written */
  name: string;
  location: PoolLocation;
  /** the definition it is a member of (an HDDL task's parameter, a class's attribute) */
  owner?: string;
  /** what it holds: `Sequence(Request)`, `boolean`, `location` */
  type?: string;
  detail?: string;
};

/** Where a reference's name is looked up, when not globally. */
export type PoolScope =
  /** among a definition's members */
  | { owner: string }
  /**
   * among what another reference leads to: `type`, the members of the class
   * its target's type names (a collection unwrapped); any other name, a
   * resolver the engine registers (as rules deriving `through(Name, X, O)`)
   */
  | { via: PoolReference; through: string };

export type PoolReference = {
  /** the kinds it may resolve to: a subtask is `['hddl.task', 'hddl.action']` */
  kinds: readonly string[];
  name: string;
  location: PoolLocation;
  scope?: PoolScope;
  /** a name the provider's relations call it by (unique in its document) */
  id?: string;
};

/** A provider's own relation: values, or a definition's or reference's id. */
export type PoolRelation = readonly [
  relation: string,
  ...values: (Value | PoolRef)[],
];
/** A reference's `id`, as a relation names it. */
export type PoolRef = { ref: string };
export const ref = (id: string): PoolRef => ({ ref: id });

export type PoolFacts = {
  definitions: PoolDefinition[];
  references: PoolReference[];
  /** namespaced by the provider: `['hddl.super', typeId, ref('r1')]` */
  relations?: PoolRelation[];
};

export type KindDefinition = {
  label: string;
  /** names compare lower-cased (HDDL) */
  caseInsensitive?: boolean;
  /**
   * how a reference to it resolves: by name in the whole pool (`global`),
   * among its scope's owner's members (`owner`), or by the provider's rules
   * (`rules`); `optional`: by the provider's rules, and unresolved is no
   * problem (a world value that may name an instance)
   */
  scope?: 'global' | 'owner' | 'rules' | 'optional';
};

export type PoolProvider = {
  /** its namespace: its kinds and relations are `${id}.…` */
  id: string;
  /** what it speaks: resource kinds, file extensions, the goal model */
  documents: {
    resources?: readonly string[];
    extensions?: readonly string[];
    model?: boolean;
  };
  /** the kinds it defines (unqualified here; `${id}.${kind}` in the pool) */
  kinds: Readonly<Record<string, KindDefinition>>;
  /** the qualified kinds it refers to (its own or other providers') */
  refers?: readonly string[];
  extract(document: PoolDocument): PoolFacts;
  /** documents memoized one by one (the goal model, field by field) */
  split?(document: PoolDocument): PoolDocument[];
  /** its rules (Datalog), over any provider's relations: #59's `checks` slot */
  rules?: string;
  /** a diagnostic code's message: `{name}` the name at its location, `{arg}` its argument */
  messages?: Readonly<Record<string, string>>;
  /** the text a rename writes for a definition (HDDL keeps the `?`); null: not renamable */
  renameText?(definition: PoolDefinition, newName: string): string | null;
};

/** The rules an engine adds across its providers (its cross-file checks). */
export type PoolGlue = {
  id: string;
  rules?: string;
  messages?: Readonly<Record<string, string>>;
};

export type PoolDiagnostic = {
  location: PoolLocation;
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
};

export type PoolEdit = {
  document: string;
  from: number;
  to: number;
  text: string;
};
