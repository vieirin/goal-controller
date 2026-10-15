/**
 * What a dialect is, as data: the elements it reads, which of the goal
 * language's operators it enables and the construct each one means, and the
 * value type of every property. It describes no syntax: the goal language
 * (`@goal-controller/goal-language`) is one fixed grammar, and a definition
 * only picks from what it offers. Nothing here knows any engine; checks are
 * named (the engine's library implements them).
 */

/** The iStar element kinds a model has (what an engine may read). */
export type ElementKind = 'goal' | 'task' | 'resource' | 'quality';

/** A kind an extension adds, by its id: namespaced (`<namespace>.<Kind>`). */
export type ExtensionKind = `${string}.${string}`;

/**
 * A kind a dialect's properties, references and lines may name: iStar's, or
 * one its extension adds (`DialectDefinition.extension`).
 */
export type DialectKind = ElementKind | ExtensionKind;

/** iStar refinement links: AND or OR. */
export type Relation = 'and' | 'or';

/**
 * The properties a line's declaration sets (`{int 0..100 = 80}`: its type,
 * bounds and initial value), in the goal language's order.
 */
export const DECLARATION_KEYS = [
  'type',
  'lowerBound',
  'upperBound',
  'initialValue',
] as const;

/** The properties a line's annotations set (`<<stereotype>> {tag = tagValue}`). */
export const ANNOTATION_KEYS = ['stereotype', 'tag', 'tagValue'] as const;

export type ElementDefinition = {
  /**
   * the id prefix its lines start with (`G`: `G1: Name`): one of the goal
   * language's (`G`, `T`, `R`, `AT`) for iStar's kinds; for an extension's,
   * one or two capitals of the dialect's own (`ExtensionIdPrefix`). Without
   * one, a definition's lines name no element (they are their elements', in
   * order).
   */
  prefix?: string;
  /** whether its line carries annotations (`<<action>> {type = duty}`) before the id */
  annotated?: boolean;
  /** whether its line declares its DECLARATION_KEYS (`{int 0..100 = 80}`) after the name */
  declares?: boolean;
  /** the fill the diagram draws it with when no colour is saved */
  fill: string;
};

/** The goal language's id prefixes (its catalog's ID_PREFIXES; its tests pin them). */
export type IstarIdPrefix = 'G' | 'T' | 'R' | 'AT';
export const ISTAR_ID_PREFIXES = [
  'G',
  'T',
  'R',
  'AT',
] as const satisfies readonly IstarIdPrefix[];

/**
 * An extension kind's id prefix (`E`: `E1: Wet soil`): one or two capitals,
 * none of the goal language's, nor `X` (an unknown element, `GX`) or `W` (a
 * cost, `[W = 0.1]`). The goal language reads it in the dialect that declares
 * it only.
 */
export const isExtensionIdPrefix = (prefix: string): boolean =>
  /^[A-Z]{1,2}$/.test(prefix) &&
  !(ISTAR_ID_PREFIXES as readonly string[]).includes(prefix) &&
  prefix !== 'X' &&
  prefix !== 'W';

/**
 * A property's value, or an operator's argument: one of the goal language's
 * predefined value types, with what this property allows of it.
 */
export type ValueConfig =
  /** `''` stands for "not set" (the property is removed) */
  /** `open`: values besides the options may be written (free text) */
  | { type: 'enum'; options: readonly EnumOption[]; open?: boolean }
  | { type: 'int'; min?: number; max?: number }
  | { type: 'number' }
  | { type: 'text' }
  | { type: 'bool' }
  /** a condition; its identifiers name elements of these kinds, or variables */
  | {
      type: 'assertion';
      resolves: readonly (DialectKind | 'variable')[];
      /**
       * the prefixes it starts with, one of them required (GODA's
       * `assertion trigger ctx = 1`); none: a prefix is an error. The goal
       * language's ASSERTION_PREFIXES.
       */
      prefixes?: readonly AssertionPrefix[];
      /** whether it compares with decimals (`x > 0.5`), not integers only */
      decimals?: boolean;
      /** whether a boolean may be compared with `!=` (`x != false`, CtxRegex.g4), not `=` only */
      booleanInequality?: boolean;
      /**
       * whether its variables are declared by their use, not by the
       * workbench (GODA: a condition's names are the context's
       * meta-variables, each its own `CTX_` parameter); needs `variable` in
       * `resolves`
       */
      declaresVariables?: boolean;
      /**
       * the functions its comparisons may call (`previous(x) < 18`); with
       * them (even none), a comparison's sides are expressions (`0.9 * x >=
       * 1`), not a name and a number only
       */
      functions?: readonly FunctionDefinition[];
    }
  /**
   * a numeric expression (`0.5 + 0.9 * previous(t)`): numbers, `+ - * /`,
   * parentheses, ids of elements of these kinds, variables (declared by
   * their use) and calls to these functions
   */
  | {
      type: 'expression';
      resolves?: readonly DialectKind[];
      functions?: readonly FunctionDefinition[];
    }
  /** ids of elements of a kind, comma-separated */
  | { type: 'refList'; kind: DialectKind }
  /** `name:value` pairs, comma-separated */
  | { type: 'pairList'; value: 'int' | 'number' | 'text' }
  | { type: 'annotatedName' }
  /** OCL as MutRoSe writes it: variables, `: Type`, `->select(...)`, `->forAll(...)` */
  | {
      type: 'ocl';
      /**
       * The properties whose values declare the names in scope (`name : Type`,
       * or names, comma-separated), on this element and its ancestors:
       * completion offers them.
       */
      declaredBy?: readonly string[];
      /** what completes a type (after `:`, in `Sequence(`): a project resource's symbols */
      candidates?: ResourceCandidates;
      /**
       * what completes after `name.`: the members of the symbol (in these
       * candidates) named by `name`'s type
       */
      memberCandidates?: ResourceCandidates;
    };

/**
 * A function an `expression` or an `assertion` may call (`previous(x)`), and
 * how many arguments it takes. The engine says what it means.
 */
export type FunctionDefinition = { name: string; arity: number };

/** A condition's prefix (the goal language's ASSERTION_PREFIXES; its tests pin them). */
export type AssertionPrefix = 'assertion condition' | 'assertion trigger';

/**
 * Where completion takes names from: a project resource's symbols of one
 * category (`{ resource: 'world', category: 'classes' }`), as its parser
 * lists them. Data only: the goal language reads the symbols, not the
 * resource.
 */
export type ResourceCandidates = { resource: string; category: string };

export type ValueType = ValueConfig['type'];

export type EnumOption = {
  value: string;
  label: string;
  /** what it means, where it is offered (an option menu's title) */
  help?: string;
};

/** What a postfix operator means: it modifies its operand, with an argument. */
export type ModifierDefinition = {
  argument: { name: string; value: ValueConfig; default: string };
  label: string;
  help: string;
  /** the constructs it changes anything in (the inspector offers it there) */
  appliesTo: readonly string[];
  /** the inspector button's title; `{<argument name>}` is its default */
  action: string;
};

export type ConstructDefinition = {
  label: string;
  help: string;
  /** the refinement links it needs, if any */
  relation?: Relation;
};

export type NotationDefinition = {
  /** what an operand is: an element of these kinds (by id), or `skip` if allowed */
  operand: { kinds: readonly DialectKind[]; skip?: boolean };
  /**
   * The goal language's operators this dialect enables, by symbol: binary and
   * prefix ones name a construct, postfix ones a modifier. Any other is an
   * error in this dialect. How tightly each binds is the language's.
   */
  operators: Readonly<Record<string, string>>;
  /** standalone symbols it enables (`[+]`), by symbol: the construct each one is */
  standalone?: Readonly<Record<string, string>>;
  /** what its postfix operators mean, by name */
  modifiers?: Readonly<Record<string, ModifierDefinition>>;
  /** by name, in the order editors list them */
  constructs: Readonly<Record<string, ConstructDefinition>>;
  /** what a goal without a notation does, by its links */
  defaultConstruct: Readonly<Record<Relation, string>>;
  /**
   * `'cost'`: a leaf's bracket holds its cost (`T1.1: Name [W = 0.1x]`,
   * GODA's CostRegex.g4), not a notation; a refined element's stays its
   * notation. Default: every bracket is a notation (a cost is an error).
   */
  leafBracket?: 'cost';
  /**
   * `'ignore'`: spaces inside a bracket are not read (`[D M(T1.1 2)]` is
   * `[DM(T1.12)]`, as GODA strips them before parsing). Default: a space is
   * part of a name, as RTRegex.g4 read it (`[G2; G3]` is an error).
   */
  whitespace?: 'ignore';
  /**
   * `'text'`: a name on a line with an id may hold any character (digits:
   * `T2.1: medical service 1`, `Collect SaO2 data`), as GODA's producer
   * splits a line at its colon and parses only its bracket. Default: a name
   * is RTRegex.g4's WORD (letters, spaces, `-`, `'`).
   */
  names?: 'text';
};

export type Condition =
  | 'always'
  | { when: { key: string; equals: string } }
  | { not: { when: { key: string; equals: string } } };

/** A value config that depends on another property. */
export type ConditionalValue = {
  when: { key: string; equals: string };
  matching: ValueConfig;
  otherwise: ValueConfig;
};

/**
 * A property, as an engine reads it. `C` is the names its `check` may take:
 * an engine's definition passes its registry's (`PropertyDefinition<keyof
 * typeof registry>`), so a misspelt check doesn't compile where it is written.
 */
export type PropertyDefinition<C extends string = string> = {
  key: string;
  value: ValueConfig | ConditionalValue;
  /** presentation only */
  input?: { placeholder?: string };
  /** whether the engine reads it, given the other properties (default: always) */
  applies?: Condition;
  /** shown as a row even when unset (the engine needs it) */
  required?: Condition;
  /** why it does not apply; `{key}` is that property's value, or `unset` */
  notApplying?: string;
  help: string;
  /** the engine check that rejects a bad value (by name, in the engine's registry) */
  check?: C;
  /** offered as an inspector field (default: true) */
  inspector?: boolean;
  /**
   * `'engine'`: an engine-owned language server serves this property's value
   * (its sub-language): the shared goal-language server and the local
   * support stay silent on the value (no value diagnostics, named check,
   * completion or hover); the property line is still read. See
   * goal-controller#24 and `packages/goal-language/docs/lsp.md`.
   */
  servedBy?: 'engine';
};

/** The mismatches between a notation and the structure the views report. */
export type ProblemKind =
  | 'notAChild'
  | 'missingFromNotation'
  | 'relationMismatch'
  /** a line naming an element the model does not have */
  | 'notInDiagram';

export type Severity = 'error' | 'warning' | 'info';

/**
 * A notation engine's dialect, or a modelling dialect's (no engine reads it):
 * `K` are the element kinds it has (an engine's: iStar's intentional elements).
 */
export type DialectDefinition<K extends string = ElementKind> = {
  id: string;
  /** shown to people */
  name: string;
  /**
   * The kinds it adds to iStar 2.0 (`defineExtension`): its node kinds may
   * have properties (`properties`, by kind id), be named by references
   * (`assertion.resolves`, `refList.kind`, …) and be listed (`elements`, by
   * kind id, with a prefix of their own).
   */
  extension?: ExtensionDefinition;
  /**
   * The kinds the Notation view lists, each a line: iStar's, and those of
   * its extension's it lists (`'toy.Sensor': element('S', { fill })`).
   */
  elements: Readonly<Partial<Record<K, ElementDefinition>>>;
  /** the fill of a kind without its own */
  defaultFill: string;
  /** what its delimiters hold on an element's line (a dialect may have none) */
  notation?: NotationDefinition;
  /**
   * By kind: iStar's (`goal`), and its extension's node kinds
   * (`'grl.Indicator'`), which have none without an entry
   */
  properties: Readonly<Record<K, readonly PropertyDefinition[]>>;
  /** the order property lines are written in, for every listed kind alike */
  propertyLineOrder: readonly string[];
  /** how far each depth is indented in the Notation view (presentation only) */
  indent: string;
  /** `{construct}`, `{needs}`, `{relation}` in relationMismatch's message */
  problems: Readonly<
    Record<ProblemKind, { severity: Severity; message: string }>
  >;
  /** the files beside a model it reads, by kind (goal-controller#25) */
  projectResources?: Readonly<Record<string, ProjectResourceDefinition>>;
  /**
   * Where an id must be unique: in the whole model (`'model'`, the default),
   * or among the elements under the same goal (`'ancestorGoal'`: a task's id
   * is scoped by its nearest goal, GODA's `G3_T1_1` and `G4_T1_1`; goals stay
   * unique in the model).
   */
  idScope?: 'model' | 'ancestorGoal';
  /**
   * A Resource linked to nothing: `'ignore'` reads it and leaves it out, no
   * actor's root (GODA's TAS draws Resources beside the goals). By default it
   * is an element like any other, so its actor has two roots and the engines
   * reject the model (`Invalid number of roots, one allowed`).
   */
  unlinkedResources?: 'ignore';
  /**
   * An element whose text writes no id, in a dialect with ids: `'unlisted'`
   * gives it no Notation line, since it can't be named on one (TAS's
   * Resources). By default it is listed by its piStar id (`<uuid>: name`),
   * an unreadable line to give an id in place.
   */
  idlessElements?: 'unlisted';
  /**
   * Properties on links, by link kind: iStar's (`istar.ContributionLink`) or
   * one a dialect extension adds (`<namespace>.<Kind>`). Stored in the link's
   * `customProperties` in the piStar file, as an element's are; iStar's own
   * contribution value (`make`, `help`, …) is the link's `label`, not one of
   * these (goal-controller#107).
   */
  links?: Readonly<Record<string, readonly PropertyDefinition[]>>;
  /**
   * Whether the Notation view writes a link's properties, as a `link` line
   * under its source (`linkLinesOf`). By default a dialect with ids does,
   * naming the target by its id (`link G1 {weight = 50}`), and one without
   * doesn't. One without that turns it on names the target by its line's
   * text, quoted, and the n-th of several so named with `#n`
   * (`link "Low running cost" {weight = 50}`, `link "Heat"#2 {…}`).
   */
  linkLines?: boolean;
  /**
   * Properties on actors (iStar's actors, agents and roles, and an
   * extension's actor kinds; `kinds` narrows one), stored in the actor's
   * `customProperties` (goal-controller#107).
   */
  actors?: readonly ActorPropertyDefinition[];
  /**
   * The model shape the engine reads (goal-controller#125): how many actors,
   * and how many trees (root goals) each. Default: one actor with one tree,
   * as the PRISM engines read a model. A model outside it is a dialect
   * problem, reported before generation.
   */
  model?: ModelShape;
};

/** How many: exactly one, or any number. */
export type ShapeCount = 'one' | 'many';

/** The model shape an engine reads: its actors, and its trees (root goals) per actor. */
export type ModelShape = { actors: ShapeCount; treesPerActor: ShapeCount };

/** The shape an engine reads when its definition declares none. */
export const DEFAULT_MODEL_SHAPE: ModelShape = {
  actors: 'one',
  treesPerActor: 'one',
};

/**
 * The property-line key a link's properties are written with in the goal
 * language, under the link's source: `link G1 {weight = 50}` (goal-controller#107).
 * Reserved in a dialect that declares `links`.
 */
export const LINK_LINE_KEY = 'link';

/**
 * The property-line key an actor's properties are written with in the goal
 * language, at the top of the document: `actor "Ann" {importance = 50}`
 * (goal-controller#109). Reserved in a dialect that declares `actors`.
 */
export const ACTOR_LINE_KEY = 'actor';

/** Whether the Notation view writes link lines in a dialect (`linkLines`, by default whether it has ids). */
export const linkLinesOf = (
  definition: Pick<AnyDialect, 'elements'> &
    Partial<Pick<AnyDialect, 'links' | 'linkLines'>>,
): boolean =>
  !!definition.links && (definition.linkLines ?? hasIds(definition));

/** A property on actors; `kinds`: only these actor kinds have it (default: every actor). */
export type ActorPropertyDefinition<C extends string = string> =
  PropertyDefinition<C> & { kinds?: readonly string[] };

// ---------------------------------------------------------------------------
// project resources: the files beside a model an engine reads (goal-controller#25)
// ---------------------------------------------------------------------------

/** What a project resource is written in: its editor's language and its parser's input. */
export type ProjectResourceFormat = 'xml' | 'hddl' | 'json' | 'pctl' | 'text';

export const PROJECT_RESOURCE_FORMATS: readonly ProjectResourceFormat[] = [
  'xml',
  'hddl',
  'json',
  'pctl',
  'text',
];

/**
 * A kind of project resource a dialect reads beside its models (MutRoSe's
 * world knowledge, Edge's property suites). The engine's library parses it;
 * the definition says only what it is and where a project keeps it.
 */
export type ProjectResourceDefinition = {
  /** shown to people: `World knowledge` */
  label: string;
  format: ProjectResourceFormat;
  /** a list of files (a folder of them), not one */
  many?: boolean;
  /** what it is to the engine, shown with it: `knowledge`, `domain` */
  role?: string;
  /**
   * where a new project keeps it, from the project's root: a file
   * (`knowledge/world_db.xml`), or a folder for a `many` kind (`props/`)
   */
  path: string;
  /** the file extensions it takes (`.xml`); default: any */
  accept?: readonly string[];
  help?: string;
};

/**
 * A name a project resource defines, as its parser lists it (a world class
 * with its attributes as members, an HDDL task with its parameters).
 */
export type ResourceSymbol = {
  name: string;
  detail?: string;
  members?: readonly { name: string; detail?: string }[];
};

/** A project resource's symbols, by category (`classes`, `locations`, `tasks`). */
export type ResourceSymbols = Readonly<
  Record<string, readonly ResourceSymbol[]>
>;

/**
 * A parsed project resource, as the views and the language servers get it:
 * its symbols (what completion and hover read) and the engine's own data
 * (what its checks and templates read; opaque to everyone else).
 */
export type ProjectResourceContext = {
  symbols: ResourceSymbols;
  data?: unknown;
};

/** The project-resource kinds a definition declares. */
export type ProjectResourceKindOf<D> = D extends {
  projectResources: infer R;
}
  ? keyof R & string
  : never;

/** A definition of any kinds: what the derived helpers read. */
export type AnyDialect = DialectDefinition<string>;

/** A definition with a notation (an engine's). */
export type WithNotation = { notation: NotationDefinition };

/** Whether a definition's lines name their elements (by id), or are theirs in order. */
export const hasIds = (definition: Pick<AnyDialect, 'elements'>): boolean =>
  Object.values(definition.elements).some(
    (element) => element?.prefix !== undefined,
  );

/**
 * What the views check the text against: the elements and the workbench's
 * variables. A language server takes it as is.
 */
export type DefinitionContextElement = {
  kind: string;
  /** its id as written, when its key isn't (a repeated scoped id: key `G3/T1.1`, id `T1.1`) */
  id?: string;
  /** its name, as a hover shows it (`G2: Reach lab`) */
  name?: string;
  /** ids of its operand children, in the notation's order */
  children: readonly string[];
  /** its custom properties, as stored */
  properties: Readonly<Record<string, string>>;
  relation?: Relation | null;
  construct?: string | null;
  /** its horizontal position in the diagram: an engine may order siblings by it */
  x?: number;
};

export type DefinitionContext = {
  elements: Readonly<Record<string, DefinitionContextElement>>;
  variables: readonly string[];
  /** a definition whose lines name no element: the elements its lines are, in order */
  order?: readonly string[];
  /**
   * and the elements whose names start with an id (`G1: Deliver`), by that
   * id: a line written with one is that element's, wherever it is
   */
  named?: Readonly<Record<string, string>>;
  /**
   * a definition without ids that writes link lines: its elements' keys by
   * their lines' text, each list in the document's order (a link line names
   * its target so, `"Heat"#2` the second)
   */
  names?: Readonly<Record<string, readonly string[]>>;
  /** the project's resources, parsed, by kind (none: the model alone) */
  projectResources?: Readonly<Record<string, ProjectResourceContext>>;
  /** the model's links, by piStar id, as checks read them (`readLink`, goal-controller#107) */
  links?: Readonly<Record<string, DefinitionContextLink>>;
  /** the model's actors, by piStar id, as checks read them (`readActor`, goal-controller#107) */
  actors?: Readonly<Record<string, DefinitionContextActor>>;
};

/** A link as a check reads it: its kind, its ends' keys (null: not an element the view lists) and properties. */
export type DefinitionContextLink = {
  kind: string;
  source: string | null;
  target: string | null;
  label?: string;
  properties: Readonly<Record<string, string>>;
  /** its ends as the model has them: piStar id and kind, any kind (an extension's too) */
  ends?: LinkEnds;
};

/** A link's ends in the model: each its piStar id and kind (null: the model lacks it). */
export type LinkEnds = {
  source: { iStarId: string; kind: string | null };
  target: { iStarId: string; kind: string | null };
};

/** An actor as a check reads it. */
export type DefinitionContextActor = {
  kind: string;
  name: string;
  properties: Readonly<Record<string, string>>;
  /** its elements' keys */
  elements: readonly string[];
};

/** What the document reads of a view node (goal-tree's `GoalViewNode` is one). */
export type DocumentNode = {
  iStarId: string;
  x?: number;
  /** its id as written (`T1.1`); the tree keys it by its own key, which may be scoped (`G3/T1.1`) */
  id: string;
  kind: string;
  name: string;
  notation: string | null;
  properties: Readonly<Record<string, string>>;
  children: readonly string[];
  relation?: Relation | null;
  construct?: string | null;
};

/** What the document reads of a view (goal-tree's `GoalView` is one). */
export type DocumentTree = {
  nodes: ReadonlyMap<string, DocumentNode>;
  roots: readonly string[];
  /**
   * the model's links (goal-controller#107): a link of a kind the dialect
   * gives properties is written as a `link` line under its source (goal-tree's
   * `GoalView` has them)
   */
  links?: readonly DocumentLink[];
  /** the model's actors (goal-controller#107; goal-tree's `GoalView` has them) */
  actors?: readonly DocumentActor[];
};

/** What the document reads of an actor: its kind, name, properties and its elements' keys. */
export type DocumentActor = {
  iStarId: string;
  kind: string;
  name: string;
  properties: Readonly<Record<string, string>>;
  elements: readonly string[];
};

/** What the document reads of a link: its ends' keys in `nodes` (null: not listed), its properties. */
export type DocumentLink = {
  iStarId: string;
  kind: string;
  source: string | null;
  target: string | null;
  /** iStar's contribution value (`make`, `help`, …), when it has one */
  label?: string;
  properties: Readonly<Record<string, string>>;
  /** its ends as the model has them (goal-tree's view has them) */
  ends?: LinkEnds;
};

// ---------------------------------------------------------------------------
// type-level reads of a definition
// ---------------------------------------------------------------------------

/** The property keys a definition has for a kind (literal when declared const). */
export type PropertyKeyOf<
  D extends { properties: object },
  K extends keyof D['properties'],
> = D['properties'][K] extends readonly { key: infer P }[] ? P : never;

/** The property keys a definition has for a link kind (literal when declared const). */
export type LinkPropertyKeyOf<
  D extends { links?: Readonly<Record<string, readonly { key: string }[]>> },
  L extends keyof NonNullable<D['links']>,
> = NonNullable<D['links']>[L][number]['key'];

/** The property keys a definition has for actors (literal when declared const). */
export type ActorPropertyKeyOf<
  D extends { actors?: readonly { key: string }[] },
> = NonNullable<D['actors']>[number]['key'];

/** The check names a definition refers to: its elements', links' and actors' properties'. */
export type CheckNameOf<D extends { properties: object }> =
  | CheckOfList<D['properties'][keyof D['properties']]>
  | (D extends { links: infer L extends object }
      ? CheckOfList<L[keyof L]>
      : never)
  | (D extends { actors: infer A } ? CheckOfList<A> : never);

type CheckOfList<L> = L extends readonly (infer P)[]
  ? P extends { check: infer C extends string }
    ? C
    : never
  : never;

/** The constructs a definition declares. */
export type ConstructOf<D extends { notation: { constructs: object } }> =
  keyof D['notation']['constructs'] & string;

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
};

const conditionKey = (c: unknown): string | null =>
  c && typeof c === 'object'
    ? 'when' in c
      ? (c as { when: { key: string } }).when.key
      : 'not' in c
        ? (c as { not: { when: { key: string } } }).not.when.key
        : null
    : null;

/** The keys a kind writes on its element line (annotations and declaration), not on property lines. */
export const elementLineKeys = (
  element: ElementDefinition | undefined,
): string[] =>
  element
    ? [
        ...(element.annotated ? ANNOTATION_KEYS : []),
        ...(element.declares ? DECLARATION_KEYS : []),
      ]
    : [];

/** The actor kinds of iStar 2.0: an extension's kind that behaves like one is an actor. */
type IstarActorKind = (typeof ISTAR_ACTOR_KINDS)[number];

/** The node kinds an extension adds (an actor kind's properties are `actors`'). */
export type ExtensionNodeKindOf<E> = E extends {
  elements: readonly (infer X)[];
}
  ? X extends { category: 'actor' } | { behavesLike: IstarActorKind }
    ? never
    : X extends { kind: infer N extends string }
      ? N
      : never
  : never;

/** The kinds a definition may give properties: iStar's, those it lists, its extension's nodes. */
export type PropertyKindOf<D> =
  | ElementKind
  | (D extends { elements: infer L } ? keyof L & string : never)
  | (D extends { extension: infer E } ? ExtensionNodeKindOf<E> : never);

/**
 * A `properties` key that is none of its kinds, made `never` (it doesn't
 * compile); keys that aren't literal (a derived definition's) are checked at
 * run time only.
 */
type KnownPropertyKinds<D extends { properties: object }> =
  string extends keyof D['properties']
    ? unknown
    : {
        properties: {
          readonly [
            K in Exclude<keyof D['properties'], PropertyKindOf<D>>
          ]: never;
        };
      };

/**
 * Type-checks and freezes a definition, and checks what the types cannot:
 * every name it uses (constructs, languages, condition keys, the keys an
 * element line declares) is one it declares, and the property-line order lists
 * each operand kind's key once (but those its element line writes).
 */
export const defineDialect = <const D extends AnyDialect>(
  definition: D & KnownPropertyKinds<D>,
): DeepReadonly<D> => {
  const fail = (why: string) => {
    throw new Error(`${definition.id}: ${why}`);
  };
  const { notation } = definition;
  if (notation) {
    const constructs = Object.keys(notation.constructs);
    const modifiers = notation.modifiers ?? {};
    for (const [symbol, meaning] of Object.entries(notation.operators))
      if (!constructs.includes(meaning) && !(meaning in modifiers))
        fail(`operator ${symbol}: unknown construct ${meaning}`);
    for (const [symbol, construct] of Object.entries(notation.standalone ?? {}))
      if (!constructs.includes(construct))
        fail(`standalone ${symbol}: unknown construct ${construct}`);
    for (const [name, modifier] of Object.entries(modifiers)) {
      if (!Object.values(notation.operators).includes(name))
        fail(`modifier ${name}: no operator means it`);
      for (const c of modifier.appliesTo)
        if (!constructs.includes(c))
          fail(`modifier ${name}: unknown construct ${c}`);
    }
    for (const c of Object.values(notation.defaultConstruct))
      if (!constructs.includes(c)) fail(`unknown default construct ${c}`);
  }
  const elements = definition.elements as AnyDialect['elements'];
  const named = Object.values(elements).filter((e) => e?.prefix !== undefined);
  if (named.length && named.length !== Object.keys(elements).length)
    fail('either every element has an id prefix, or none has');
  const resources = definition.projectResources ?? {};
  // the kinds it may name: iStar's, and its extension's nodes
  const extensionKinds = extensionNodeKinds(definition.extension);
  const isKind = (kind: string) =>
    kind in ISTAR_KIND_OF || extensionKinds.includes(kind);
  for (const [kind, element] of Object.entries(elements)) {
    // a namespaced kind (not a modelling dialect's `istar.Goal`) is its extension's
    if (isExtensionKind(kind) && !extensionKinds.includes(kind))
      fail(`elements: ${kind} is not a node kind of its extension`);
    const prefix = element?.prefix;
    if (prefix === undefined) continue;
    if (!isExtensionKind(kind)) {
      if (!(ISTAR_ID_PREFIXES as readonly string[]).includes(prefix))
        fail(`${kind}: ${prefix} is not one of the goal language's prefixes`);
    } else if (!isExtensionIdPrefix(prefix))
      fail(
        `${kind}: its prefix is one or two capitals, none of G, T, R, AT, X, W (not ${prefix})`,
      );
    else if (
      Object.entries(elements).some(
        ([other, e]) => other !== kind && e?.prefix === prefix,
      )
    )
      fail(`${kind}: prefix ${prefix} is another kind's`);
  }
  for (const kind of Object.keys(definition.properties))
    if (!isKind(kind) && !(kind in elements))
      fail(
        `properties: ${kind} is neither an iStar kind nor a node kind of its extension`,
      );
  for (const kind of notation?.operand.kinds ?? [])
    if (!isKind(kind)) fail(`notation: operand kind ${kind} is unknown`);
  // a list of properties (an element kind's, a link kind's, the actors'): its
  // keys once, its conditions on its own keys, its completions from known files
  const checkList = (owner: string, list: readonly PropertyDefinition[]) => {
    const keys = list.map((p) => p.key);
    if (new Set(keys).size !== keys.length)
      fail(`repeated ${owner} property key`);
    for (const property of list) {
      const value = property.value;
      for (const key of [property.applies, property.required, value].map(
        conditionKey,
      ))
        if (key !== null && !keys.includes(key))
          fail(`${owner}.${property.key} depends on unknown ${key}`);
      const values =
        'when' in value ? [value.matching, value.otherwise] : [value];
      for (const config of values) {
        const functions =
          config.type === 'expression' || config.type === 'assertion'
            ? (config.functions ?? [])
            : [];
        const names = functions.map((f) => f.name);
        if (new Set(names).size !== names.length)
          fail(`${owner}.${property.key}: a function is declared twice`);
        for (const kind of referencedKinds(config))
          if (!isKind(kind))
            fail(`${owner}.${property.key} names unknown kind ${kind}`);
        if (config.type === 'ocl')
          for (const candidates of [config.candidates, config.memberCandidates])
            if (candidates && !(candidates.resource in resources))
              fail(
                `${owner}.${property.key} completes from unknown project resource ${candidates.resource}`,
              );
      }
    }
  };
  for (const [kind, list] of Object.entries(definition.properties))
    checkList(kind, list);
  // the keys link and actor lines are written with, where the dialect has them
  for (const [declared, key, what] of [
    [
      definition.links,
      LINK_LINE_KEY,
      `a link's properties are written with (it declares links)`,
    ],
    [
      definition.actors,
      ACTOR_LINE_KEY,
      `an actor's properties are written with (it declares actors)`,
    ],
  ] as const)
    if (declared)
      for (const [kind, list] of Object.entries(definition.properties))
        if (list.some((p) => p.key === key))
          fail(`${kind}.${key}: the key ${what}`);
  for (const [kind, list] of Object.entries(definition.links ?? {})) {
    if (!isLinkKind(kind)) fail(`links: unknown link kind ${kind}`);
    checkList(kind, list);
  }
  if (definition.actors) {
    checkList('actor', definition.actors);
    for (const property of definition.actors)
      for (const kind of property.kinds ?? [])
        if (!isActorKind(kind))
          fail(`actor.${property.key}: unknown actor kind ${kind}`);
  }
  const properties = definition.properties as AnyDialect['properties'];
  for (const [kind, element] of Object.entries(elements)) {
    const keys = (properties[kind] ?? []).map((p) => p.key);
    for (const key of elementLineKeys(element))
      if (!keys.includes(key)) fail(`${kind} line declares unknown ${key}`);
  }
  // property lines: under the listed kinds that declare nothing on their line
  const lineKeys = new Set(
    Object.entries(elements).flatMap(([kind, element]) => {
      if (!element || element.declares) return [];
      const onElementLine = elementLineKeys(element);
      return (properties[kind] ?? [])
        .map((p) => p.key)
        .filter((key) => !onElementLine.includes(key));
    }),
  );
  // without ids, a line is its element's by position: there are no property lines
  if (!named.length && lineKeys.size)
    fail('lines without ids write every property on the element line');
  for (const [kind, resource] of Object.entries(resources)) {
    if (!PROJECT_RESOURCE_FORMATS.includes(resource.format))
      fail(`project resource ${kind}: unknown format ${resource.format}`);
    if (
      !resource.path ||
      resource.path.startsWith('/') ||
      resource.path.split('/').includes('..')
    )
      fail(
        `project resource ${kind}: its path is relative to the project, inside it`,
      );
    if (Boolean(resource.many) !== resource.path.endsWith('/'))
      fail(
        `project resource ${kind}: ${resource.many ? 'a list of files is kept in a folder (its path ends with /)' : 'one file is kept at a file path'}`,
      );
    for (const extension of resource.accept ?? [])
      if (!extension.startsWith('.'))
        fail(`project resource ${kind}: ${extension} is not an extension`);
  }
  if (definition.model)
    for (const [part, count] of Object.entries(definition.model))
      if (count !== 'one' && count !== 'many')
        fail(`model.${part}: one or many, not ${String(count)}`);
  const order = new Set(definition.propertyLineOrder);
  if (
    order.size !== definition.propertyLineOrder.length ||
    order.size !== lineKeys.size ||
    [...lineKeys].some((key) => !order.has(key))
  )
    fail('propertyLineOrder must list each listed kind key once');
  return deepFreeze(definition) as unknown as DeepReadonly<D>;
};

// ---------------------------------------------------------------------------
// extensions: what a dialect adds to iStar 2.0, for any engine
// ---------------------------------------------------------------------------

/** iStar 2.0's kinds, as models write them (`@istar-ts/core`'s; the tests pin them). */
export const ISTAR_ACTOR_KINDS = [
  'istar.Actor',
  'istar.Agent',
  'istar.Role',
] as const;
export const ISTAR_NODE_KINDS = [
  'istar.Goal',
  'istar.Quality',
  'istar.Resource',
  'istar.Task',
] as const;
export const ISTAR_LINK_KINDS = [
  'istar.IsALink',
  'istar.ParticipatesInLink',
  'istar.DependencyLink',
  'istar.AndRefinementLink',
  'istar.OrRefinementLink',
  'istar.NeededByLink',
  'istar.QualificationLink',
  'istar.ContributionLink',
] as const;

/** A kind an extension adds: namespaced, not iStar's own (`<namespace>.<Kind>`). */
export const isExtensionKind = (kind: string): kind is ExtensionKind =>
  /^[A-Za-z][\w-]*\.[A-Za-z]\w*$/.test(kind) && !kind.startsWith('istar.');

/** The node kinds an extension adds (not its actor kinds), in its order. */
export const extensionNodeKinds = (
  extension: Pick<ExtensionDefinition, 'elements'> | undefined,
): string[] =>
  (extension?.elements ?? [])
    .filter(
      (element) =>
        element.category !== 'actor' &&
        !(ISTAR_ACTOR_KINDS as readonly (string | undefined)[]).includes(
          element.behavesLike,
        ),
    )
    .map((element) => element.kind);

/** The kinds a value names its elements by (an assertion's, an expression's, a refList's). */
export const referencedKinds = (config: ValueConfig): readonly string[] =>
  config.type === 'assertion'
    ? config.resolves.filter((kind) => kind !== 'variable')
    : config.type === 'expression'
      ? (config.resolves ?? [])
      : config.type === 'refList'
        ? [config.kind]
        : [];

/**
 * A link kind a dialect may give properties: iStar's, or an extension's (a
 * dialect doesn't name its extension, so any namespaced kind; the extension
 * checks its own, defineExtension).
 */
export const isLinkKind = (kind: string): boolean =>
  (ISTAR_LINK_KINDS as readonly string[]).includes(kind) ||
  isExtensionKind(kind);

/** An actor kind: iStar's actor, agent or role, or an extension's. */
export const isActorKind = (kind: string): boolean =>
  (ISTAR_ACTOR_KINDS as readonly string[]).includes(kind) ||
  isExtensionKind(kind);

/** The iStar kind each element kind an engine reads is drawn as. */
export const ISTAR_KIND_OF = {
  goal: 'istar.Goal',
  task: 'istar.Task',
  resource: 'istar.Resource',
  quality: 'istar.Quality',
} as const satisfies Record<ElementKind, string>;

/** A kind a dialect adds: a node or an actor, namespaced (`<dialect>.<Kind>`). */
export type ExtensionElementDefinition = {
  kind: string;
  /** default: the part after the namespace */
  label?: string;
  /** required unless it behaves like a kind (then it is that kind's) */
  category?: 'node' | 'actor';
  /** the kind whose link rules it follows (`istar.Task`) */
  behavesLike?: string;
  /** the `type` a piStar file saves it with, when not its name (e.g. `istar.<Name>`) */
  pistarType?: string;
  size?: { width: number; height: number };
  /** SVG path data it is drawn with (presentation only; default: a dashed box with its «label») */
  shape?: string;
  /**
   * where its label goes, as fractions of its box cut from each side
   * (presentation only; e.g. a shape's arrow tip is no place for text)
   */
  textBox?: { top: number; right: number; bottom: number; left: number };
};

/** Which kinds a new link may join: kind names, or the categories `node`, `actor`, `*`. */
export type LinkRulesDefinition = {
  sources: readonly string[];
  targets: readonly string[];
  /** default: true (the iStar 2.0 Guide's node links) */
  sameActor?: boolean;
  allowDependum?: boolean;
  allowSelf?: boolean;
  /** at most one link of this kind (`kind`, the default) or of any kind between two elements */
  unique?: 'kind' | 'any' | false;
};

/** A link kind a dialect adds: it behaves like an iStar link, or has rules of its own. */
export type ExtensionLinkDefinition = {
  kind: string;
  label?: string;
  behavesLike?: string;
  rules?: LinkRulesDefinition;
  pistarType?: string;
  /** how it is drawn (presentation only): its dash and target marker (SVG path data) */
  line?: {
    dash: 'continuous' | 'dashed' | 'dotted';
    marker?: string;
    markerFilled?: boolean;
  };
};

/** A stereotype or tagged value, on kinds or groupers (by name). */
export type StereotypeDefinition = {
  name: string;
  appliesTo: readonly string[];
};
export type TaggedValueDefinition = {
  name: string;
  appliesTo: readonly string[];
  /** its values, when they are listed (others are free text) */
  values?: readonly string[];
};

/**
 * A dialect of iStar, for any engine: the kinds and links it adds (a metamodel
 * extension, with how they are drawn), named sets of kinds (groupers), and the
 * stereotypes and tagged values elements may carry, written as the goal
 * language's annotations (`<<stereotype>> {tag = value}`) on the lines of the
 * kinds an engine reads.
 */
export type ExtensionDefinition = {
  /** the namespace of its kinds */
  name: string;
  label: string;
  elements: readonly ExtensionElementDefinition[];
  links: readonly ExtensionLinkDefinition[];
  /** a grouper: a name for a set of kinds (iStar's or the dialect's) */
  groupers: Readonly<Record<string, readonly string[]>>;
  stereotypes: readonly StereotypeDefinition[];
  taggedValues: readonly TaggedValueDefinition[];
  /** tagged values every element may carry (free text) */
  defaultTags: readonly string[];
};

const CATEGORIES = ['node', 'actor', '*'];

/**
 * Type-checks and freezes a dialect, and checks what the types cannot: its
 * kinds are in its namespace, and every kind, grouper and link end it names is
 * one iStar 2.0, `base` (the dialect it extends, if any) or it declares.
 */
export const defineExtension = <const E extends ExtensionDefinition>(
  extension: E,
  base?: ExtensionDefinition,
): DeepReadonly<E> => {
  const fail = (why: string) => {
    throw new Error(`${extension.name}: ${why}`);
  };
  const own = [...extension.elements, ...extension.links].map((k) => k.kind);
  for (const kind of own)
    if (!kind.startsWith(`${extension.name}.`))
      fail(`${kind} is not in the ${extension.name} namespace`);
  const elementKinds = [
    ...ISTAR_ACTOR_KINDS,
    ...ISTAR_NODE_KINDS,
    ...(base?.elements ?? []).map((e) => e.kind),
    ...extension.elements.map((e) => e.kind),
  ] as string[];
  const linkKinds = [
    ...ISTAR_LINK_KINDS,
    ...(base?.links ?? []).map((l) => l.kind),
    ...extension.links.map((l) => l.kind),
  ] as string[];
  const groupers = { ...base?.groupers, ...extension.groupers };
  for (const element of extension.elements) {
    if (element.behavesLike && !elementKinds.includes(element.behavesLike))
      fail(`${element.kind} behaves like unknown ${element.behavesLike}`);
    if (!element.behavesLike && !element.category)
      fail(`${element.kind} needs a category or a kind it behaves like`);
  }
  for (const link of extension.links) {
    if (!link.behavesLike === !link.rules)
      fail(`${link.kind} needs rules or a kind it behaves like, not both`);
    if (link.behavesLike && !linkKinds.includes(link.behavesLike))
      fail(`${link.kind} behaves like unknown ${link.behavesLike}`);
    for (const end of [
      ...(link.rules?.sources ?? []),
      ...(link.rules?.targets ?? []),
    ])
      if (!elementKinds.includes(end) && !CATEGORIES.includes(end))
        fail(`${link.kind} joins unknown ${end}`);
  }
  for (const [grouper, kinds] of Object.entries(extension.groupers))
    for (const kind of kinds)
      if (!elementKinds.includes(kind) && !linkKinds.includes(kind))
        fail(`grouper ${grouper} names unknown ${kind}`);
  for (const { name, appliesTo } of [
    ...extension.stereotypes,
    ...extension.taggedValues,
  ])
    for (const target of appliesTo)
      if (
        !(target in groupers) &&
        !elementKinds.includes(target) &&
        !linkKinds.includes(target)
      )
        fail(`${name} applies to unknown ${target}`);
  return deepFreeze(extension) as DeepReadonly<E>;
};
