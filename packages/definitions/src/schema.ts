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
  /** the id's prefix */
  prefix: string;
  /** what follows the prefix, as a regex source */
  idPattern: string;
  /** the element's line, with `{id}` and `{name}` */
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
  | { type: 'enum'; options: readonly EnumOption[] }
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

export type EngineDefinition = {
  id: string;
  /** shown to people */
  name: string;
  /** the grammar the engine's library reads texts with */
  grammar: string;
  /** the parser that reads it */
  parser: string;
  elements: Readonly<Partial<Record<ElementKind, ElementDefinition>>>;
  /** the fill of a kind without its own */
  defaultFill: string;
  notation: NotationDefinition;
  properties: Readonly<Record<ElementKind, readonly PropertyDefinition[]>>;
  /** a property's line under its element: key, separator, value */
  propertyLine: { separator: string; keyPattern: string };
  /** the order property lines are written in, for every operand kind alike */
  propertyLineOrder: readonly string[];
  /** how far each depth is indented in the Notation view (presentation only) */
  indent: string;
  /** `{construct}`, `{needs}`, `{relation}` in relationMismatch's message */
  problems: Readonly<
    Record<ProblemKind, { severity: Severity; message: string }>
  >;
  languages: Readonly<Record<string, LanguageDefinition>>;
};

/**
 * What the views check the text against: the elements and the workbench's
 * variables. A language server takes it as is.
 */
export type DefinitionContextElement = {
  kind: ElementKind;
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
export const defineEngine = <const D extends EngineDefinition>(
  definition: D,
): DeepReadonly<D> => {
  const fail = (why: string) => {
    throw new Error(`${definition.id}: ${why}`);
  };
  const { notation } = definition;
  const constructs = Object.keys(notation.constructs);
  for (const op of notation.operators) {
    const named = op.form === 'postfix' ? op.appliesTo : [op.construct];
    for (const c of named)
      if (!constructs.includes(c))
        fail(`operator ${op.symbol}: unknown construct ${c}`);
  }
  for (const c of Object.values(notation.defaultConstruct))
    if (!constructs.includes(c)) fail(`unknown default construct ${c}`);
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
  const elements = definition.elements as EngineDefinition['elements'];
  for (const [kind, element] of Object.entries(elements)) {
    const keys = definition.properties[kind as ElementKind].map((p) => p.key);
    for (const key of elementLineKeys(element))
      if (!keys.includes(key)) fail(`${kind} line declares unknown ${key}`);
  }
  const lineKeys = new Set(
    notation.operand.kinds.flatMap((kind) => {
      const onElementLine = elementLineKeys(elements[kind]);
      return definition.properties[kind]
        .map((p) => p.key)
        .filter((key) => !onElementLine.includes(key));
    }),
  );
  const order = new Set(definition.propertyLineOrder);
  if (
    order.size !== definition.propertyLineOrder.length ||
    order.size !== lineKeys.size ||
    [...lineKeys].some((key) => !order.has(key))
  )
    fail('propertyLineOrder must list each operand kind key once');
  return deepFreeze(definition) as DeepReadonly<D>;
};
