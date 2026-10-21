/**
 * What a dialect is, as data: the elements it reads, which of the goal
 * language's operators it enables and the construct each one means, and the
 * value type of every property. It describes no syntax: the goal language
 * (`@goal-controller/goal-language`) is one fixed grammar, and a definition
 * only picks from what it offers. Nothing here knows any engine; checks are
 * named (the engine's library implements them).
 */
import {
  KAOS_OBSTACLES,
  type KaosElementKind,
  type KaosLinkKind,
  type KaosObstacleElementKind,
  type KaosObstacleLinkKind,
} from '@istar-ts/dsm3-kaos/metamodel';
import {
  NFR,
  type NfrElementKind,
  type NfrLinkKind,
} from '@istar-ts/dsm3-nfr/metamodel';
import type { DistributionRange } from './distribution';

/** The iStar element kinds a model has (what an engine may read). */
export type ElementKind = 'goal' | 'task' | 'resource' | 'quality';

/** A kind an extension adds, by its id: namespaced (`<namespace>.<Kind>`). */
export type ExtensionKind = `${string}.${string}`;

/**
 * A kind a dialect's properties, references and lines may name: iStar's, or
 * one its extension adds (`DialectDefinition.extension`).
 */
export type DialectKind = ElementKind | ExtensionKind;

/**
 * The goal-modelling framework a dialect, a model and a project are in
 * (goal-controller#171): iStar 2.0, KAOS or the NFR Framework, each the
 * framework of one of istar-ts's root metamodels (`Metamodel.framework`).
 * A project's models are all of one; nothing converts between them.
 */
export type Framework = 'istar-2.0' | 'kaos' | 'nfr';
export const FRAMEWORKS = [
  'istar-2.0',
  'kaos',
  'nfr',
] as const satisfies readonly Framework[];
/** The framework of a dialect, model or project that names none. */
export const DEFAULT_FRAMEWORK: Framework = 'istar-2.0';

/**
 * The kinds of the frameworks besides iStar 2.0, read from the roots the
 * workbench reads their models with (istar-ts's `KAOS_OBSTACLES`, KAOS with
 * its obstacle analysis, goal-controller#181; `NFR`): the element kinds,
 * with the hub an n-ary link generates, and the link kinds, with its legs
 * and end. A dialect of one names these kinds, and no iStar kind.
 */
export const FRAMEWORK_KINDS: {
  readonly kaos: {
    readonly elements: readonly (KaosElementKind | KaosObstacleElementKind)[];
    readonly links: readonly (KaosLinkKind | KaosObstacleLinkKind)[];
  };
  readonly nfr: {
    readonly elements: readonly NfrElementKind[];
    readonly links: readonly NfrLinkKind[];
  };
} = {
  kaos: {
    elements: [...KAOS_OBSTACLES.elements.keys()],
    links: [...KAOS_OBSTACLES.links.keys()],
  },
  nfr: { elements: [...NFR.elements.keys()], links: [...NFR.links.keys()] },
};

/** An element kind of a framework besides iStar 2.0 (`kaos.Agent`). */
export type FrameworkElementKind<F extends keyof typeof FRAMEWORK_KINDS> =
  (typeof FRAMEWORK_KINDS)[F]['elements'][number];

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
   * one or two capitals of the dialect's own (`isExtensionIdPrefix`). Without
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

/** The id prefixes iStar's kinds take: the goal language's (its catalog's ID_PREFIXES is this list). */
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
  /**
   * `caseInsensitive`: an option is matched in any case (`FALSE` is
   * `false`) and read as the option's value, as written in `options`
   */
  | {
      type: 'enum';
      options: readonly EnumOption[];
      open?: boolean;
      caseInsensitive?: true;
    }
  | { type: 'int'; min?: number; max?: number }
  | { type: 'number'; min?: number; max?: number }
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
       * a list of conditions, separated by it (goal-controller#232: GODA's
       * `%` between its contexts, `addFulfillmentConditions`), each one as
       * the rest of this config reads it; blank parts are none
       */
      separator?: string;
      /**
       * the functions its comparisons may call (`previous(x) < 18`); with
       * them (even none), a comparison's sides are expressions (`0.9 * x >=
       * 1`), not a name and a number only
       */
      functions?: readonly FunctionDefinition[];
      /**
       * what a reference's members are (`room.clean`, goal-controller#135):
       * the keys of the referenced element's `from` property (a pairList,
       * each pair's value the member's type: `bool`, `int`, `number`, or
       * its options, `low|high`), or `'any'` name. None: a member is an
       * error.
       */
      members?: MemberSource;
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
      /**
       * what a reference's members are (`room.clean`, goal-controller#135):
       * the keys of the referenced element's `from` property (a pairList,
       * each pair's value the member's type: `bool`, `int`, `number`, or
       * its options, `low|high`), or `'any'` name. None: a member is an
       * error.
       */
      members?: MemberSource;
    }
  /** ids of elements of a kind, comma-separated */
  /** ids of elements of a kind, or of one of several kinds (goal-controller#270) */
  | { type: 'refList'; kind: DialectKind }
  | { type: 'refList'; kinds: readonly DialectKind[] }
  /**
   * one element's id, of one of these kinds (a resolution's anchor goal):
   * an id the model lacks, or another kind's, is a problem
   */
  | { type: 'reference'; kinds: readonly DialectKind[] }
  /**
   * a sentence of a formal language, tagged with it (`ltl`: KAOS's
   * `FormalSpec`): read as text, which nothing checks yet
   */
  | { type: 'formula'; language: string }
  /**
   * a probability, in [0, 1]: a decimal (`0.8`, `.8`) or a percentage
   * (`80%`), kept as written
   */
  | { type: 'probability' }
  /**
   * a probability distribution in its text forms (`beta[2, 3]`,
   * `pert[1%, 2%, 5%]`, `(2.4%, 2.7%, 3%)` quantiles; ./distribution),
   * kept as written; with `point`, a single value too (the degenerate
   * case); over probabilities (default) or the reals (goal-controller#190)
   */
  | { type: 'distribution'; point?: boolean; range?: DistributionRange }
  /** `name:value` pairs, comma-separated */
  | { type: 'pairList'; value: 'int' | 'number' | 'text' }
  /**
   * names, comma-separated (`cost, roomTemperature`, goal-controller#286):
   * what each names (an element's identifier, a variable) is the dialect's
   * checks' to say
   */
  | { type: 'nameList' }
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
 * Where the members of a reference in an `assertion` or an `expression` come
 * from (`room.clean`, goal-controller#135): the referenced element's
 * pairList property `from` (each pair a member and its type), or any name
 * (`'any'`: its members are declared elsewhere).
 */
export type MemberSource = { from: string } | 'any';

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

/**
 * A `probability` value as a number: a decimal (`0.8`, `.8`, `1`) or a
 * percentage (`80%`, `20.00%`, as KAOSTools writes them); null when it is
 * neither, or outside [0, 1].
 */
export const probabilityOf = (text: string): number | null => {
  const read = /^\s*([0-9]+(?:\.[0-9]*)?|\.[0-9]+)\s*(%?)\s*$/.exec(text);
  if (!read) return null;
  const value = Number(read[1]) / (read[2] ? 100 : 1);
  return value <= 1 ? value : null;
};

export type EnumOption = {
  value: string;
  label: string;
  /** what it means, where it is offered (an option menu's title) */
  help?: string;
};

/**
 * The option a text is of an enum (trimmed; in any case where it is
 * `caseInsensitive`): its value as `options` writes it, or undefined.
 */
export const enumOptionOf = (
  config: Pick<
    Extract<ValueConfig, { type: 'enum' }>,
    'options' | 'caseInsensitive'
  >,
  text: string,
): string | undefined => {
  const written = text.trim();
  const same = config.caseInsensitive
    ? (value: string) => value.toLowerCase() === written.toLowerCase()
    : (value: string) => value === written;
  return config.options.find((option) => same(option.value))?.value;
};

/**
 * A value's parts, each with where it starts in the text: an assertion
 * with a `separator` is one per non-blank part between them, any other
 * value one, the whole text (goal-controller#232).
 */
export const valueParts = (
  config: ValueConfig,
  text: string,
): { text: string; offset: number }[] => {
  const separator = config.type === 'assertion' ? config.separator : undefined;
  if (!separator) return [{ text, offset: 0 }];
  const parts: { text: string; offset: number }[] = [];
  let offset = 0;
  for (const part of text.split(separator)) {
    if (part.trim()) parts.push({ text: part, offset });
    offset += part.length + separator.length;
  }
  return parts;
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
   * keyed by a project resource's names (goal-controller#190, D2): besides
   * its own value (`Probability`), one per name of that resource kind,
   * `Probability[e1]` on disk (`keyedKeyOf`), each of its value type; the
   * inspector shows a row per name. The kind is one of the dialect's
   * `projectResources`. `{ names: 'written' }` (goal-controller#193): keyed
   * by any name the model writes (`QualityVariable[ResponseTime]`, a goal's
   * own quality variables), which no resource lists.
   */
  keyed?: string | KeyedByWritten;
  /**
   * `'engine'`: an engine-owned language server serves this property's value
   * (its sub-language): the shared goal-language server and the local
   * support stay silent on the value (no value diagnostics, named check,
   * completion or hover); the property line is still read. See
   * goal-controller#24 and `packages/goal-language/docs/lsp.md`.
   */
  servedBy?: 'engine';
};

/** A keyed property's names: any the model writes, none listed (goal-controller#193). */
export type KeyedByWritten = { names: 'written' };

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
   * The framework whose models it reads (default `istar-2.0`): its kinds are
   * that framework's root metamodel's, and iStar's rules (the `G`/`T`/`R`/`AT`
   * prefixes, the goal/task/resource/quality kinds, actors) hold in iStar's
   * only (goal-controller#171).
   */
  framework?: Framework;
  /**
   * A non-iStar framework's links that refine, by link kind, and how
   * (goal-controller#171): NFR's `nfr.AndRefinementLink` is an AND. An n-ary
   * kind (KAOS's `kaos.RefinementLink`, drawn as a hub with legs) refines its
   * end's target with its legs' sources. iStar's refinements are its own
   * And/Or links, and a dialect of iStar names none.
   */
  refinements?: Readonly<Record<string, Relation>>;
  /**
   * The labels a non-iStar framework's link kinds take, by link kind: the
   * values its changeable label is picked from (NFR's contributions, `++` …
   * `unknown`). iStar's contribution value is istar-ts's (`make`, `help`, …).
   */
  linkLabels?: Readonly<Record<string, readonly string[]>>;
  /**
   * A non-iStar framework's link kinds whose target is a leaf: an element
   * no refinement refines (goal-controller#181: a KAOS obstacle obstructs a
   * leaf goal). A link onto a refined element is a Problem.
   */
  leafTargets?: readonly string[];
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
   * (`'toy.Sensor'`), which have none without an entry
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
   * Its own file formats, by id (goal-controller#143): a model's file in
   * another tool's format, kept 1:1 with the piStar model. Read, it is the
   * model; the model written, it follows.
   */
  nativeFiles?: Readonly<Record<string, NativeFileDefinition>>;
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

// ---------------------------------------------------------------------------
// native files: a dialect's own file formats, 1:1 with the model (goal-controller#143)
// ---------------------------------------------------------------------------

/** What a native file is written in: its tab's highlighting, and the helpers its reader starts from. */
export type NativeFileFormat = 'xmi' | 'xml' | 'json' | 'text';

export const NATIVE_FILE_FORMATS: readonly NativeFileFormat[] = [
  'xmi',
  'xml',
  'json',
  'text',
];

/** What a native format's schema is, and the formats each kind describes. */
export const NATIVE_SCHEMA_KINDS = {
  ecore: ['xmi'],
  xsd: ['xml', 'xmi'],
  'json-schema': ['json'],
  langium: ['text'],
} as const satisfies Record<string, readonly NativeFileFormat[]>;

export type NativeSchemaKind = keyof typeof NATIVE_SCHEMA_KINDS;

/** The extensions a piStar model is opened by (the workbench's model files), which no native file takes. */
export const PISTAR_EXTENSIONS: readonly string[] = ['.json', '.txt'];

/** What reading or writing a native file found: what was read differently, left out, or can't be. */
export type NativeDiagnostic = {
  severity: Severity;
  message: string;
  /** where in the text, when it is one part's */
  from?: number;
  to?: number;
};

/** What a model's dialect needs beside the model: its engine, its resources' files and its options. */
export type DialectRecord = {
  /** the engine the model records (`diagram.customProperties.engine`) */
  engine: string;
  /** each project resource kind's files, by path in the project */
  projectResources: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** the engine's options the source sets (a project's manifest keeps them) */
  options?: Readonly<Record<string, boolean | number | string>>;
};

/** A piStar model, as JSON (its text: `JSON.stringify(model, null, 2)`). */
export type PistarJson = Record<string, unknown>;

/**
 * A native file read (the shape importers had, packages/dialect/docs/importers.md):
 * the piStar model, what its dialect needs beside it, and what was read
 * differently or left out; no model, with errors, when the text isn't one.
 */
export type NativeReadResult =
  | {
      model: PistarJson;
      dialectRecord: DialectRecord;
      diagnostics: NativeDiagnostic[];
    }
  | { model: null; dialectRecord: null; diagnostics: NativeDiagnostic[] };

/** A model written: its text; none, with the diagnostics saying why, when this model can't be. */
export type NativeWriteResult =
  | { text: string; diagnostics: NativeDiagnostic[] }
  | { text: null; diagnostics: NativeDiagnostic[] };

/** What a reader and a writer are given beside the text or the model. */
export type NativeFileContext = {
  /** the model's name: the file's, without its extension */
  modelName: string;
  /** the project's resources' files, by kind, then path in the project */
  projectResources?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** the engine's options the project sets */
  options?: Readonly<Record<string, boolean | number | string>>;
};

/** How a part of a textual native file is highlighted. */
export type NativeHighlightKind =
  | 'keyword'
  | 'definition'
  | 'reference'
  | 'name'
  | 'string'
  | 'number'
  | 'comment'
  | 'punctuation';

export type NativeHighlight = {
  from: number;
  to: number;
  kind: NativeHighlightKind;
};

/** A word completion offers in a textual native file. */
export type NativeCompletion = { label: string; kind: 'keyword' | 'name' };

/**
 * A textual format's language, for its tab (lib's `defineLanguage` makes
 * one from a Langium grammar): its highlighting, and its completions.
 */
export type NativeLanguage = {
  /** its id (the grammar's), unique among the languages a workbench loads */
  id: string;
  highlight: (text: string) => readonly NativeHighlight[];
  complete?: (text: string, offset: number) => readonly NativeCompletion[];
};

/**
 * One of a dialect's own file formats (another tool's EMF XMI, an
 * XSD-described XML, a text with its grammar): a model's file kept 1:1 with its piStar
 * model. Its reader is the model's importer; with a writer, the file
 * follows the model as it is edited.
 */
export type NativeFileDefinition = {
  /** shown to people: the format's name */
  label: string;
  /** the extensions it is opened by, lower case, with their dot (`.xmi`) */
  extensions: readonly string[];
  format: NativeFileFormat;
  /**
   * The format's own description, committed with the engine (its path from
   * the engine's folder), which the metamodel export copies: an Ecore
   * metamodel, an XSD, a JSON Schema, or the Langium grammar it is read with.
   */
  schema?: { kind: NativeSchemaKind; path: string };
  /** its text as the model; no model, with errors, when it isn't one */
  read: (text: string, context: NativeFileContext) => NativeReadResult;
  /** the model as its text; none, with why, when this model can't be written */
  write?: (model: PistarJson, context: NativeFileContext) => NativeWriteResult;
  /**
   * the form two texts are compared in, byte for byte (attribute order,
   * whitespace, generated ids): a format without one compares as written
   */
  canonical?: (text: string) => string;
  /**
   * What the format can't carry, as piStar paths (`*` any key or index:
   * `actors.*.nodes.*.x`, `display`): a model written and read back equals
   * it but for these, and a native file is in sync with a model it reads to
   * but for these.
   */
  lossy?: readonly string[];
  /** a textual format's language: its tab's highlighting and completions */
  language?: NativeLanguage;
};

/** A lossy path: keys, indices or `*`, dot-separated. */
const LOSSY_PATH = /^(?:\*|[^.*\s]+)(?:\.(?:\*|[^.*\s]+))*$/;

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
  /**
   * the elements' keys by their piStar ids, where the dialect has
   * `reference` values (goal-controller#181): a reference may name an
   * element by either
   */
  iStarIds?: Readonly<Record<string, string>>;
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
  /**
   * whether its text gave it an id (`T1: …`): its `id` may equal its piStar
   * id either way. None: told by `id !== iStarId`, as before (#158)
   */
  hasId?: boolean;
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
  /**
   * the dependums, by key (goal-controller#152): no line of their own, but a
   * dependency's link line names one (goal-tree's `GoalView` has them)
   */
  dependums?: ReadonlyMap<string, DocumentNode>;
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

/** The hubs of an extension's n-ary links (`<kind>Hub`). */
export type ExtensionHubKindOf<E> = E extends {
  links: readonly (infer X)[];
}
  ? X extends { kind: infer N extends string; arity: 'n' }
    ? `${N}Hub`
    : never
  : never;

/** The kinds a definition may give properties: iStar's, those it lists, its extension's nodes and hubs. */
export type PropertyKindOf<D> =
  | ElementKind
  | (D extends { elements: infer L } ? keyof L & string : never)
  | (D extends { extension: infer E }
      ? ExtensionNodeKindOf<E> | ExtensionHubKindOf<E>
      : never)
  | (D extends { framework: infer F extends keyof typeof FRAMEWORK_KINDS }
      ? FrameworkElementKind<F>
      : never);

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
 * A dialect's native files, as the types can't check them: each id a name,
 * its extensions its own, its schema one its format has (inside the
 * engine's folder), its functions functions, its lossy paths paths.
 */
const checkNativeFiles = (
  files: Readonly<Record<string, NativeFileDefinition>>,
  fail: (why: string) => never,
) => {
  const taken = new Map<string, string>();
  for (const [id, file] of Object.entries(files)) {
    const where = `native file ${id}`;
    if (!/^[A-Za-z][\w-]*$/.test(id)) fail(`${where}: its id is a name`);
    if (!file.label) fail(`${where}: no label`);
    if (!NATIVE_FILE_FORMATS.includes(file.format))
      fail(`${where}: unknown format ${String(file.format)}`);
    if (!file.extensions.length) fail(`${where}: no extension`);
    for (const extension of file.extensions) {
      if (!/^\.[a-z0-9][a-z0-9.+_-]*$/.test(extension))
        fail(
          `${where}: ${extension} is not an extension (lower case, with its dot)`,
        );
      if (PISTAR_EXTENSIONS.includes(extension))
        fail(`${where}: ${extension} opens a piStar model`);
      const other = taken.get(extension);
      if (other) fail(`${where}: ${extension} is native file ${other}’s too`);
      taken.set(extension, id);
    }
    if (file.schema) {
      const formats = NATIVE_SCHEMA_KINDS[file.schema.kind] as
        | readonly NativeFileFormat[]
        | undefined;
      if (!formats) fail(`${where}: unknown schema kind ${file.schema.kind}`);
      else if (!formats.includes(file.format))
        fail(
          `${where}: a ${file.schema.kind} schema describes ${formats.join(' or ')}, not ${file.format}`,
        );
      const { path } = file.schema;
      if (
        !path ||
        path.startsWith('/') ||
        path.endsWith('/') ||
        path.split('/').includes('..')
      )
        fail(`${where}: its schema is a file in the engine’s folder`);
    }
    for (const name of ['read', 'write', 'canonical'] as const)
      if (
        (name === 'read' || file[name] !== undefined) &&
        typeof file[name] !== 'function'
      )
        fail(`${where}: ${name} is a function`);
    if (file.language && file.format !== 'text')
      fail(`${where}: a language is a text format's, not ${file.format}'s`);
    if (file.language && typeof file.language.highlight !== 'function')
      fail(`${where}: its language highlights`);
    const lossy = file.lossy ?? [];
    for (const path of lossy)
      if (!LOSSY_PATH.test(path))
        fail(`${where}: lossy ${path} is not a piStar path`);
    if (new Set(lossy).size !== lossy.length) fail(`${where}: lossy repeats`);
  }
};

/**
 * The kinds a dialect of a framework besides iStar 2.0 may name: its root's,
 * and its extension's (goal-controller#181), its n-ary links' hubs, legs and
 * ends included. Throws why the extension isn't one of the framework's
 * (`defineExtension`'s checks, against the root's kinds).
 */
const frameworkKinds = (
  framework: Exclude<Framework, 'istar-2.0'>,
  extension: ExtensionDefinition | undefined,
): { elements: readonly string[]; links: readonly string[] } => {
  const root = FRAMEWORK_KINDS[framework];
  if (!extension) return root;
  defineExtension(extension, undefined, framework);
  return {
    elements: [
      ...root.elements,
      ...extensionNodeKinds(extension),
      ...extensionHubKinds(extension),
    ],
    links: [...root.links, ...extensionLinkKinds(extension)],
  };
};

/**
 * A dialect of a framework besides iStar 2.0 (goal-controller#171), as
 * iStar's rules don't check it: its elements are its root's node kinds or its
 * extension's, each prefix one or two capitals (not `X` nor `W`; kinds may
 * share one, as KAOS's goals share `G`); it has no actors or bracket
 * notation, which are iStar's.
 */
const checkFrameworkDialect = (
  definition: AnyDialect,
  framework: string,
  own: { elements: readonly string[] },
  fail: (why: string) => never,
) => {
  for (const [field, given] of [
    ['actors', definition.actors],
    ['notation', definition.notation],
  ] as const)
    if (given) fail(`${field}: a ${framework} dialect has none (iStar's only)`);
  for (const [kind, element] of Object.entries(definition.elements)) {
    if (!(own.elements as readonly string[]).includes(kind))
      fail(`elements: ${kind} is not a node kind of ${framework}`);
    const prefix = element?.prefix;
    if (
      prefix !== undefined &&
      (!/^[A-Z]{1,2}$/.test(prefix) || prefix === 'X' || prefix === 'W')
    )
      fail(
        `${kind}: its prefix is one or two capitals, neither X nor W (not ${prefix})`,
      );
  }
};

/**
 * A dialect's refinements, link labels and leaf targets (goal-controller#171,
 * #181): a non-iStar framework's, each naming one of its link kinds (its
 * root's or its extension's, `linkKinds`), a relation, and labels once each.
 */
const checkFrameworkLinks = (
  definition: Pick<
    AnyDialect,
    'framework' | 'refinements' | 'linkLabels' | 'leafTargets'
  >,
  linkKinds: readonly string[],
  fail: (why: string) => never,
) => {
  const framework = definition.framework ?? DEFAULT_FRAMEWORK;
  for (const [field, entries] of [
    ['refinements', definition.refinements],
    ['linkLabels', definition.linkLabels],
  ] as const) {
    if (!entries) continue;
    if (framework === 'istar-2.0') fail(`${field}: iStar's links are its own`);
    for (const kind of Object.keys(entries))
      if (!linkKinds.includes(kind))
        fail(`${field}: ${kind} is not a link kind of ${framework}`);
  }
  if (definition.leafTargets) {
    if (framework === 'istar-2.0')
      fail(`leafTargets: iStar's links are its own`);
    for (const kind of definition.leafTargets)
      if (!linkKinds.includes(kind))
        fail(`leafTargets: ${kind} is not a link kind of ${framework}`);
  }
  for (const [kind, relation] of Object.entries(definition.refinements ?? {}))
    if (relation !== 'and' && relation !== 'or')
      fail(`refinements: ${kind} is an and or an or, not ${String(relation)}`);
  for (const [kind, labels] of Object.entries(definition.linkLabels ?? {}))
    if (!labels.length || new Set(labels).size !== labels.length)
      fail(`linkLabels: ${kind}'s labels are some, each once`);
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
  // another framework's dialect: its root's kinds, none of iStar's rules
  const framework = definition.framework ?? DEFAULT_FRAMEWORK;
  if (!(FRAMEWORKS as readonly string[]).includes(framework))
    fail(`unknown framework ${String(framework)}`);
  let own: { elements: readonly string[]; links: readonly string[] } | null =
    null;
  if (framework !== 'istar-2.0') {
    try {
      own = frameworkKinds(framework, definition.extension);
    } catch (error) {
      fail(`extension: ${(error as Error).message}`);
    }
    checkFrameworkDialect(definition, framework, own!, fail);
  }
  // the kinds it may name: iStar's, and its extension's nodes and hubs
  const extensionKinds = [
    ...extensionNodeKinds(definition.extension),
    ...extensionHubKinds(definition.extension),
  ];
  const isKind = (kind: string) =>
    own
      ? own.elements.includes(kind)
      : kind in ISTAR_KIND_OF || extensionKinds.includes(kind);
  for (const [kind, element] of Object.entries(own ? {} : elements)) {
    // a namespaced kind (not a modelling dialect's `istar.Goal`) is its extension's
    if (isExtensionKind(kind) && !extensionKinds.includes(kind))
      fail(`elements: ${kind} is not a node kind of its extension`);
    const prefix = element?.prefix;
    if (prefix === undefined) continue;
    if (!isExtensionKind(kind)) {
      if (!(ISTAR_ID_PREFIXES as readonly string[]).includes(prefix))
        fail(`${kind}: ${prefix} is not one of the goal language’s prefixes`);
    } else if (!isExtensionIdPrefix(prefix))
      fail(
        `${kind}: its prefix is one or two capitals, none of G, T, R, AT, X, W (not ${prefix})`,
      );
    else if (
      Object.entries(elements).some(
        ([other, e]) => other !== kind && e?.prefix === prefix,
      )
    )
      fail(`${kind}: prefix ${prefix} is another kind’s`);
  }
  for (const kind of Object.keys(definition.properties))
    if (!isKind(kind) && !(kind in elements))
      fail(
        own
          ? `properties: ${kind} is not a node kind of ${framework}`
          : `properties: ${kind} is neither an iStar kind nor a node kind of its extension`,
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
      if (typeof property.keyed === 'string' && !(property.keyed in resources))
        fail(
          `${owner}.${property.key} is keyed by unknown project resource ${property.keyed}`,
        );
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
        // members from a property: a pairList some kind it resolves declares
        const members =
          (config.type === 'assertion' || config.type === 'expression') &&
          config.members;
        if (
          members &&
          members !== 'any' &&
          !referencedKinds(config).some((kind) =>
            (
              (definition.properties as AnyDialect['properties'])[kind] ?? []
            ).some(
              (p) =>
                p.key === members.from &&
                !('when' in p.value) &&
                p.value.type === 'pairList',
            ),
          )
        )
          fail(
            `${owner}.${property.key}: its members are from ${members.from}, a pairList none of the kinds it resolves declares`,
          );
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
    if (own ? !own.links.includes(kind) : !isLinkKind(kind))
      fail(
        `links: unknown link kind ${kind}${own ? ` (not one of ${framework}'s)` : ''}`,
      );
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
  checkNativeFiles(definition.nativeFiles ?? {}, fail);
  checkFrameworkLinks(definition, own?.links ?? [], fail);
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

/** The hubs istar-ts generates for an extension's n-ary links (`<kind>Hub`). */
export const extensionHubKinds = (
  extension: Pick<ExtensionDefinition, 'links'> | undefined,
): string[] =>
  (extension?.links ?? [])
    .filter((link) => link.arity === 'n')
    .map((link) => `${link.kind}Hub`);

/**
 * The link kinds an extension's models have: its own, and for an n-ary one
 * the legs and the end istar-ts generates (`<kind>Start`, `<kind>End`).
 */
export const extensionLinkKinds = (
  extension: Pick<ExtensionDefinition, 'links'> | undefined,
): string[] =>
  (extension?.links ?? []).flatMap((link) =>
    link.arity === 'n'
      ? [link.kind, `${link.kind}Start`, `${link.kind}End`]
      : [link.kind],
  );

/** The kinds a refList's ids name: its one `kind`, or its `kinds`. */
export const refListKinds = (
  config: Extract<ValueConfig, { type: 'refList' }>,
): readonly DialectKind[] => ('kinds' in config ? config.kinds : [config.kind]);

/** The kinds a value names its elements by (an assertion's, an expression's, a refList's). */
export const referencedKinds = (config: ValueConfig): readonly string[] =>
  config.type === 'assertion'
    ? config.resolves.filter((kind) => kind !== 'variable')
    : config.type === 'expression'
      ? (config.resolves ?? [])
      : config.type === 'refList'
        ? refListKinds(config)
        : config.type === 'reference'
          ? config.kinds
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
  /**
   * `'n'`: an n-ary link, drawn as a hub with legs (KAOS's refinement):
   * istar-ts generates its hub, leg and end kinds (`<kind>Hub`,
   * `<kind>Start`, `<kind>End`), which a dialect's `properties` (the hub)
   * and `links` (the legs and the end) may name
   */
  arity?: 'n';
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
 * one its framework's root (iStar 2.0 by default; KAOS's or NFR's,
 * goal-controller#181), `base` (the dialect it extends, if any) or it
 * declares. The root's namespace is the root's (`kaos.`), as istar-ts's
 * `extendMetamodel` reserves it.
 */
export const defineExtension = <const E extends ExtensionDefinition>(
  extension: E,
  base?: ExtensionDefinition,
  framework: Framework = DEFAULT_FRAMEWORK,
): DeepReadonly<E> => {
  const fail = (why: string) => {
    throw new Error(`${extension.name}: ${why}`);
  };
  const root =
    framework === 'istar-2.0'
      ? {
          elements: [...ISTAR_ACTOR_KINDS, ...ISTAR_NODE_KINDS],
          links: ISTAR_LINK_KINDS,
        }
      : FRAMEWORK_KINDS[framework];
  if (
    framework !== 'istar-2.0' &&
    root.elements.some((kind) => kind.startsWith(`${extension.name}.`))
  )
    fail(`its namespace is ${framework}'s root's`);
  const own = [...extension.elements, ...extension.links].map((k) => k.kind);
  for (const kind of own)
    if (!kind.startsWith(`${extension.name}.`))
      fail(`${kind} is not in the ${extension.name} namespace`);
  const elementKinds = [
    ...root.elements,
    ...(base?.elements ?? []).map((e) => e.kind),
    ...extension.elements.map((e) => e.kind),
  ] as string[];
  const linkKinds = [
    ...root.links,
    ...extensionLinkKinds(base),
    ...extensionLinkKinds(extension),
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
