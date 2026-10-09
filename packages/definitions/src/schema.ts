/**
 * What an engine's dialect is, as data: the elements it reads and their line
 * syntax, the notation inside its delimiters, its sub-languages and every
 * property's argument config. Nothing here knows any engine: constructs,
 * operators, languages and declarations are whatever a definition declares.
 * A future generator reads the same structure the inspector and the Notation
 * view are built from, so everything is data except checks, which are named
 * (the engine's library implements them).
 */

/** The iStar element kinds a model has (what an engine may read). */
export type ElementKind = 'goal' | 'task' | 'resource' | 'quality';

/** iStar refinement links: AND or OR. */
export type Relation = 'and' | 'or';

export type ElementDefinition = {
  /** the id's prefix (a line with `{id}`) */
  prefix?: string;
  /** what follows the prefix, as a regex source (a line with `{id}`) */
  idPattern?: string;
  /**
   * the element's line, with `{name}` and, for a definition whose lines name
   * their element, `{id}` (without it, lines are their elements' in order)
   */
  line: string;
  /**
   * what this kind annotates its line with, before the id
   * (`<<action>> {type = duty}`): properties in their delimiters, read and
   * written like the declaration, each written only when its first property is set
   */
  annotations?: readonly DeclarationDefinition[];
  /**
   * the syntax of what this kind declares on its line, after the name (a
   * resource's `{int 0..100 = 80}`): the properties it sets, in its delimiters
   */
  declaration?: DeclarationDefinition;
  /** a regex character class source: the characters a name may use */
  nameCharset: string;
  /** the fill the diagram draws it with when no colour is saved */
  fill: string;
};

/** A property's argument, or an operator's: how its text is read. */
export type ValueConfig =
  /** `''` stands for "not set" (the property is removed) */
  /** `open`: values besides the options may be written (free text) */
  | { type: 'enum'; options: readonly EnumOption[]; open?: boolean }
  | { type: 'int'; min?: number; max?: number }
  | { type: 'number' }
  | { type: 'text' }
  | { type: 'bool' }
  /** written in one of the definition's `languages` */
  | { type: 'expression'; language: string }
  | { type: 'refList'; kind: ElementKind; separator: string }
  | {
      type: 'pairList';
      separator: string;
      pair: string;
      value: 'int' | 'number' | 'text';
    };

export type EnumOption = { value: string; label: string };

export type Operator =
  | {
      /** `a <symbol> b`, writing a construct */
      symbol: string;
      form: 'infix';
      construct: string;
      assoc: 'left' | 'right';
    }
  | {
      /** `a <symbol><argument>`: modifies its operand, no construct of its own */
      symbol: string;
      form: 'postfix';
      assoc: 'left';
      argument: { name: string; value: ValueConfig; default: string };
      label: string;
      help: string;
      /** the constructs it changes anything in (the inspector offers it there) */
      appliesTo: readonly string[];
      /** the inspector button's title; `{<argument name>}` is its default */
      action: string;
    }
  | {
      /** the symbol on its own is the whole notation */
      symbol: string;
      form: 'standalone';
      construct: string;
      assoc: 'none';
    };

export type ConstructDefinition = {
  label: string;
  help: string;
  /** the refinement links it needs, if any */
  relation?: Relation;
};

export type NotationDefinition = {
  delimiters: readonly [string, string];
  /** what an operand is: an element id of these kinds, or a keyword */
  operand: { kinds: readonly ElementKind[]; keywords: readonly string[] };
  /** tightest → loosest */
  operators: readonly Operator[];
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

export type PropertyDefinition = {
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
  check?: string;
  /** offered as an inspector field (default: true) */
  inspector?: boolean;
};

/**
 * A declaration's syntax, as a sequence: a property's value, a literal, or an
 * optional group (written only when all its properties are set). A literal is
 * written as is; read with any whitespace around it (a blank literal: some).
 */
export type DeclarationPart =
  | { key: string; pattern: string }
  | { literal: string }
  | { optional: readonly DeclarationPart[] };

export type DeclarationDefinition = {
  delimiters: readonly [string, string];
  parts: readonly DeclarationPart[];
};

/** A sub-language property values are written in. */
export type LanguageDefinition = {
  /** tightest → loosest */
  operators: readonly { symbol: string; form: 'infix' | 'prefix' }[];
  parens: readonly [string, string];
  comparators: readonly string[];
  /** literal kinds, as regex sources */
  literals: Readonly<Record<string, string>>;
  keywords: readonly string[];
  identifier: string;
  /** what an identifier may name: elements of these kinds, or variables */
  resolves: readonly (ElementKind | 'variable')[];
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
export type EngineDefinition<K extends string = ElementKind> = {
  id: string;
  /** shown to people */
  name: string;
  /** the grammar the engine's library reads texts with (none without an engine) */
  grammar?: string;
  /** the parser that reads it */
  parser?: string;
  elements: Readonly<Partial<Record<K, ElementDefinition>>>;
  /** the fill of a kind without its own */
  defaultFill: string;
  /** what its delimiters hold on an element's line (a dialect may have none) */
  notation?: NotationDefinition;
  properties: Readonly<Record<K, readonly PropertyDefinition[]>>;
  /** a property's line under its element: key, separator, value */
  propertyLine: { separator: string; keyPattern: string };
  /** the order property lines are written in, for every listed kind alike */
  propertyLineOrder: readonly string[];
  /** how far each depth is indented in the Notation view (presentation only) */
  indent: string;
  /** `{construct}`, `{needs}`, `{relation}` in relationMismatch's message */
  problems: Readonly<
    Record<ProblemKind, { severity: Severity; message: string }>
  >;
  languages: Readonly<Record<string, LanguageDefinition>>;
};

/** A definition of any kinds: what the derived helpers read. */
export type AnyDefinition = EngineDefinition<string>;

/** A definition with a notation (an engine's). */
export type WithNotation = { notation: NotationDefinition };

/** Whether a definition's lines name their elements (`{id}`), or are theirs in order. */
export const hasIds = (definition: Pick<AnyDefinition, 'elements'>): boolean =>
  Object.values(definition.elements).some((element) =>
    element?.line.includes('{id}'),
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
};

export type DefinitionContext = {
  elements: Readonly<Record<string, DefinitionContextElement>>;
  variables: readonly string[];
  /** a definition whose lines name no element: the elements its lines are, in order */
  order?: readonly string[];
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

/** The properties a declaration's parts set, in order. */
export const declarationKeys = (
  declaration: DeclarationDefinition,
): string[] => {
  const keys = (parts: readonly DeclarationPart[]): string[] =>
    parts.flatMap((part) =>
      'key' in part
        ? [part.key]
        : 'optional' in part
          ? keys(part.optional)
          : [],
    );
  return keys(declaration.parts);
};

/** The keys a kind writes on its element line (annotations and declaration), not on property lines. */
export const elementLineKeys = (
  element: ElementDefinition | undefined,
): string[] =>
  element
    ? [
        ...(element.annotations ?? []),
        ...(element.declaration ? [element.declaration] : []),
      ].flatMap(declarationKeys)
    : [];

/**
 * Type-checks and freezes a definition, and checks what the types cannot:
 * every name it uses (constructs, languages, condition keys, the keys an
 * element line declares) is one it declares, and the property-line order lists
 * each operand kind's key once (but those its element line writes).
 */
export const defineEngine = <const D extends AnyDefinition>(
  definition: D,
): DeepReadonly<D> => {
  const fail = (why: string) => {
    throw new Error(`${definition.id}: ${why}`);
  };
  const { notation } = definition;
  if (notation) {
    const constructs = Object.keys(notation.constructs);
    for (const op of notation.operators) {
      const named = op.form === 'postfix' ? op.appliesTo : [op.construct];
      for (const c of named)
        if (!constructs.includes(c))
          fail(`operator ${op.symbol}: unknown construct ${c}`);
    }
    for (const c of Object.values(notation.defaultConstruct))
      if (!constructs.includes(c)) fail(`unknown default construct ${c}`);
  }
  const elements = definition.elements as AnyDefinition['elements'];
  const named = Object.values(elements).filter((e) => e?.line.includes('{id}'));
  if (named.length && named.length !== Object.keys(elements).length)
    fail('either every element line has an {id}, or none has');
  for (const element of named)
    if (element?.prefix === undefined || element.idPattern === undefined)
      fail('an element line with an {id} needs its prefix and idPattern');
  for (const [kind, list] of Object.entries(definition.properties)) {
    const keys = list.map((p) => p.key);
    if (new Set(keys).size !== keys.length)
      fail(`repeated ${kind} property key`);
    for (const property of list) {
      const value = property.value;
      const values =
        'when' in value ? [value.matching, value.otherwise] : [value];
      for (const v of values)
        if (v.type === 'expression' && !(v.language in definition.languages))
          fail(`${kind}.${property.key}: unknown language ${v.language}`);
      for (const key of [property.applies, property.required, value].map(
        conditionKey,
      ))
        if (key !== null && !keys.includes(key))
          fail(`${kind}.${property.key} depends on unknown ${key}`);
    }
  }
  const properties = definition.properties as AnyDefinition['properties'];
  for (const [kind, element] of Object.entries(elements)) {
    const keys = (properties[kind] ?? []).map((p) => p.key);
    for (const key of elementLineKeys(element))
      if (!keys.includes(key)) fail(`${kind} line declares unknown ${key}`);
  }
  // property lines: under the listed kinds that declare nothing on their line
  const lineKeys = new Set(
    Object.entries(elements).flatMap(([kind, element]) => {
      if (!element || element.declaration) return [];
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

/** A kind a dialect adds: a node or an actor, namespaced (`rationalAgents.Planning`). */
export type ExtensionElementDefinition = {
  kind: string;
  /** default: the part after the namespace */
  label?: string;
  /** required unless it behaves like a kind (then it is that kind's) */
  category?: 'node' | 'actor';
  /** the kind whose link rules it follows (`istar.Task`) */
  behavesLike?: string;
  /** the `type` it is saved with, when not its name (piStar-ext saves `istar.<Name>`) */
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
 * stereotypes and tagged values elements may carry, written as annotations on
 * the lines of the kinds an engine reads.
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
  /**
   * how an element line writes them: the stereotype's annotation sets one
   * property, the tagged value's its name and value
   */
  annotations: {
    stereotype: DeclarationDefinition;
    taggedValue: DeclarationDefinition;
  };
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
  const { stereotype, taggedValue } = extension.annotations;
  if (declarationKeys(stereotype).length !== 1)
    fail('a stereotype annotation sets one property');
  if (![1, 2].includes(declarationKeys(taggedValue).length))
    fail('a tagged value annotation sets its name, and its value');
  return deepFreeze(extension) as DeepReadonly<E>;
};
