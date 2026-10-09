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
   * the goal language's id prefix its lines start with (`G`: `G1: Name`);
   * without one, a definition's lines name no element (they are their
   * elements', in order)
   */
  prefix?: 'G' | 'T' | 'R';
  /** whether its line carries annotations (`<<action>> {type = duty}`) before the id */
  annotated?: boolean;
  /** whether its line declares its DECLARATION_KEYS (`{int 0..100 = 80}`) after the name */
  declares?: boolean;
  /** the fill the diagram draws it with when no colour is saved */
  fill: string;
};

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
  | { type: 'assertion'; resolves: readonly (ElementKind | 'variable')[] }
  /** ids of elements of a kind, comma-separated */
  | { type: 'refList'; kind: ElementKind }
  /** `name:value` pairs, comma-separated */
  | { type: 'pairList'; value: 'int' | 'number' | 'text' }
  | { type: 'annotatedName' };

export type ValueType = ValueConfig['type'];

export type EnumOption = { value: string; label: string };

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
  operand: { kinds: readonly ElementKind[]; skip?: boolean };
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
  elements: Readonly<Partial<Record<K, ElementDefinition>>>;
  /** the fill of a kind without its own */
  defaultFill: string;
  /** what its delimiters hold on an element's line (a dialect may have none) */
  notation?: NotationDefinition;
  properties: Readonly<Record<K, readonly PropertyDefinition[]>>;
  /** the order property lines are written in, for every listed kind alike */
  propertyLineOrder: readonly string[];
  /** how far each depth is indented in the Notation view (presentation only) */
  indent: string;
  /** `{construct}`, `{needs}`, `{relation}` in relationMismatch's message */
  problems: Readonly<
    Record<ProblemKind, { severity: Severity; message: string }>
  >;
};

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
};

/** What the document reads of a view node (goal-tree's `GoalViewNode` is one). */
export type DocumentNode = {
  iStarId: string;
  x?: number;
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
};

// ---------------------------------------------------------------------------
// type-level reads of a definition
// ---------------------------------------------------------------------------

/** The property keys a definition has for a kind (literal when declared const). */
export type PropertyKeyOf<
  D extends { properties: Record<ElementKind, readonly { key: string }[]> },
  K extends ElementKind,
> = D['properties'][K][number]['key'];

/** The check names a definition refers to. */
export type CheckNameOf<D extends { properties: object }> = CheckOfList<
  D['properties'][keyof D['properties']]
>;

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

/**
 * Type-checks and freezes a definition, and checks what the types cannot:
 * every name it uses (constructs, languages, condition keys, the keys an
 * element line declares) is one it declares, and the property-line order lists
 * each operand kind's key once (but those its element line writes).
 */
export const defineDialect = <const D extends AnyDialect>(
  definition: D,
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
  for (const [kind, list] of Object.entries(definition.properties)) {
    const keys = list.map((p) => p.key);
    if (new Set(keys).size !== keys.length)
      fail(`repeated ${kind} property key`);
    for (const property of list) {
      const value = property.value;
      for (const key of [property.applies, property.required, value].map(
        conditionKey,
      ))
        if (key !== null && !keys.includes(key))
          fail(`${kind}.${property.key} depends on unknown ${key}`);
    }
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
  const order = new Set(definition.propertyLineOrder);
  if (
    order.size !== definition.propertyLineOrder.length ||
    order.size !== lineKeys.size ||
    [...lineKeys].some((key) => !order.has(key))
  )
    fail('propertyLineOrder must list each listed kind key once');
  return deepFreeze(definition) as DeepReadonly<D>;
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
