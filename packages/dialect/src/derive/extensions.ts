/**
 * What a dialect (an ExtensionDefinition) gives each consumer: the metamodel
 * extension a model is read with (`@istar-ts/core`'s `MetamodelExtension`, as
 * plain data), the stereotypes and tagged values each kind may carry, and an
 * engine definition whose element lines carry them as annotations. Nothing
 * here knows a dialect.
 */
import {
  ISTAR_ACTOR_KINDS,
  ISTAR_KIND_OF,
  ISTAR_NODE_KINDS,
  ANNOTATION_KEYS,
  defineDialect,
  type AnyDialect,
  type ConditionalValue,
  type ElementDefinition,
  type ExtensionDefinition,
  type ExtensionLinkDefinition,
  type LinkRulesDefinition,
  type NodeInfo,
  type PropertyDefinition,
  type ValueConfig,
} from '../schema';

/**
 * `@istar-ts/core`'s `MetamodelExtension`, structurally (this package has no
 * dependencies), its kinds `EK` and `LK` (an extension's own, as literals).
 * Presentation (`shape`, `textBox`, `line`) is left out: istar-ts draws a
 * dialect's own kinds from its `ExtensionDefinition` directly
 * (`pistarExtExtension`), not from this — see `extensionElementOf`/
 * `extensionLinkOf` for where `shape`/`line` do survive, for that caller.
 */
export type MetamodelExtensionData<
  EK extends string = string,
  LK extends string = string,
> = {
  name: string;
  elements: {
    kind: EK;
    label?: string;
    category?: 'node' | 'actor';
    behavesLike?: string;
    pistarType?: string;
    size?: { width: number; height: number };
    info?: NodeInfo;
    description?: string;
  }[];
  links: {
    kind: LK;
    label?: string;
    behavesLike?: string;
    rules?: LinkRulesDefinition;
    pistarType?: string;
    arity?: 'n';
    description?: string;
  }[];
};

/** The fields that are set, without the others (a metamodel extension has no undefined ones). */
export const defined = <T extends object>(value: T): T =>
  Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as T;

/**
 * A dialect's own shape (SVG path data) as a model's own file-format shape
 * (istar-ts's `KindShape`, as `ModelElementKind.shape` has it).
 */
export const fileShapeOf = (shape: string): FileShape => ({ path: shape });

/**
 * A model's own file-format shape (istar-ts's `KindShape`, as
 * `ModelElementKind.shape` has it) as a dialect's own shape (SVG path data):
 * its `path` (a model's own addition never sets a `viewBox`,
 * AddConstruct.tsx — there is none to carry across).
 */
export const shapeOfFile = ({ path }: FileShape): string => path;

/** istar-ts's own file-format shape of a kind (`KindShape`), as far as it is read here. */
export type FileShape = { path: string; viewBox?: string };

/**
 * The raw SVG dash array a dialect's line enum is drawn with, by
 * `@istar-ts/react`'s own `LINE_DASHES` (this package's own copy: it has no
 * dependency on `@istar-ts/react`).
 */
const DASH_OF = {
  continuous: undefined,
  dashed: '10,5',
  dotted: '1,3',
} as const satisfies Record<DialectLine['dash'], string | undefined>;

/** A dialect's own line (its dash/marker enum) as a model's own file-format line (istar-ts's `KindLine`). */
export const fileLineOf = (line: DialectLine): FileLine =>
  defined({
    dash: DASH_OF[line.dash],
    marker: line.marker,
    markerFilled: line.markerFilled,
  });

/**
 * A model's own file-format line (istar-ts's `KindLine`) as a dialect's own
 * line (its dash/marker enum): its raw dash array back to the enum it names
 * (no dash is `continuous`; a dash that isn't one of `@istar-ts/react`'s own
 * presets — written by hand in the file — reads as `dashed`, the closest
 * meaning); its marker (`false`, explicitly none) reads as none.
 */
export const lineOfFile = (line: FileLine): DialectLine => ({
  dash:
    (Object.keys(DASH_OF) as DialectLine['dash'][]).find(
      (dash) => DASH_OF[dash] === line.dash,
    ) ?? (line.dash ? 'dashed' : 'continuous'),
  ...(line.marker ? { marker: line.marker } : {}),
  ...(line.markerFilled !== undefined
    ? { markerFilled: line.markerFilled }
    : {}),
});

/** istar-ts's own file-format line of a link kind (`KindLine`), as far as it is read here. */
export type FileLine = {
  dash?: string;
  marker?: string | false;
  markerFilled?: boolean;
};

/** A dialect's own line (its dash/marker enum), `ExtensionLinkDefinition.line`'s. */
type DialectLine = NonNullable<ExtensionLinkDefinition['line']>;

/**
 * An element kind's fields resolved the same way whichever kind declares it
 * (a dialect's own or a model's own addition, modelExtension.ts), undefined
 * ones dropped: its `shape` is a dialect's own SVG path string throughout
 * (`ExtensionElementDefinition`'s), a model's own addition's `fileShapeOf`'d
 * before it gets here (modelExtension.ts).
 */
export const extensionElementOf = <
  T extends {
    kind: string;
    label?: string;
    category?: 'node' | 'actor';
    behavesLike?: string;
    pistarType?: string;
    size?: { width: number; height: number };
    info?: NodeInfo;
    shape?: string;
    textBox?: { top: number; right: number; bottom: number; left: number };
    description?: string;
  },
>({
  kind,
  label,
  category,
  behavesLike,
  pistarType,
  size,
  info,
  shape,
  textBox,
  description,
}: T) =>
  defined({
    kind,
    label,
    category,
    behavesLike,
    pistarType,
    size,
    info,
    shape,
    textBox,
    description,
  });

/**
 * A link kind's fields resolved the same way whichever kind declares it (a
 * dialect's own or a model's own addition, modelExtension.ts), undefined
 * ones dropped: its `line` is a dialect's own dash/marker enum throughout
 * (`ExtensionLinkDefinition`'s), a model's own addition's `lineOfFile`'d
 * before it gets here; an n-ary kind's generated `arity` is each caller's
 * own to add.
 */
export const extensionLinkOf = <
  T extends {
    kind: string;
    label?: string;
    behavesLike?: string;
    rules?: LinkRulesDefinition;
    pistarType?: string;
    line?: DialectLine;
    description?: string;
  },
>({
  kind,
  label,
  behavesLike,
  rules,
  pistarType,
  line,
  description,
}: T) =>
  defined({ kind, label, behavesLike, rules, pistarType, line, description });

/** The metamodel extension a dialect's models are read with (presentation left out), its kinds' literal types kept. */
export const metamodelExtensionOf = <
  const E extends Pick<ExtensionDefinition, 'name' | 'elements' | 'links'>,
>(
  extension: E,
): MetamodelExtensionData<
  E['elements'][number]['kind'],
  E['links'][number]['kind']
> => ({
  name: extension.name,
  elements: extension.elements.map((element) => {
    const {
      textBox: _textBox,
      shape: _shape,
      ...rest
    } = extensionElementOf(element);
    return rest;
  }),
  links: extension.links.map((link) => {
    const { line: _line, ...rest } = extensionLinkOf(link);
    return defined({ ...rest, arity: link.arity });
  }),
});

/** Whether a stereotype or tagged value applies to a kind (named, or in a named grouper). */
const appliesTo = (
  extension: ExtensionDefinition,
  targets: readonly string[],
  kind: string,
): boolean =>
  targets.some(
    (target) =>
      target === kind || (extension.groupers[target] ?? []).includes(kind),
  );

/** A tagged value whose values are listed: the others are free text. */
export type ListedTag = { name: string; values: readonly string[] };

/** The stereotypes and tagged values an element of a kind may carry (the default tags first). */
export const profileOf = (
  extension: ExtensionDefinition,
  kind: string,
): { stereotypes: string[]; tags: (string | ListedTag)[] } => ({
  stereotypes: extension.stereotypes
    .filter((s) => appliesTo(extension, s.appliesTo, kind))
    .map((s) => s.name),
  tags: [
    ...extension.defaultTags,
    ...extension.taggedValues
      .filter((t) => appliesTo(extension, t.appliesTo, kind))
      .map((t) => (t.values ? { name: t.name, values: t.values } : t.name)),
  ],
});

const options = (values: readonly string[]) => [
  { value: '', label: 'none' },
  ...values.map((value) => ({ value, label: value })),
];

/** The property keys a dialect's annotations set: the stereotype, a tag's name and value. */
export const annotationKeys = (_extension?: ExtensionDefinition) => {
  const [stereotype, tag, tagValue] = ANNOTATION_KEYS;
  return { stereotype, tag, tagValue };
};

/**
 * The properties a kind's profile adds: its stereotype (when it has any), and
 * its tagged value's name and value, whose config is listed for a listed tag.
 */
export const profileProperties = (
  extension: ExtensionDefinition,
  kind: string,
): PropertyDefinition[] => {
  const { stereotypes, tags } = profileOf(extension, kind);
  const keys = annotationKeys(extension);
  const listed = tags.filter(
    (tag): tag is ListedTag => typeof tag !== 'string',
  );
  // a conditional value has one condition: one listed tag per kind
  if (listed.length > 1)
    throw new Error(
      `${extension.name}: one listed tagged value per kind (${kind})`,
    );
  const text: ValueConfig = { type: 'text' };
  const [tag] = listed;
  // a stereotype or tag the profile does not list may be written too (open)
  return [
    {
      key: keys.stereotype,
      value: { type: 'enum', options: options(stereotypes), open: true },
      help: 'its stereotype, written <<stereotype>> before it',
    },
    {
      key: keys.tag,
      value: {
        type: 'enum',
        options: options(tags.map((t) => (typeof t === 'string' ? t : t.name))),
        open: true,
      },
      help: 'its tagged value, written {tag = value} before it',
    },
    ...(keys.tagValue
      ? [
          {
            key: keys.tagValue,
            value: tag
              ? ({
                  when: { key: keys.tag, equals: tag.name },
                  matching: { type: 'enum', options: options(tag.values) },
                  otherwise: text,
                } satisfies ConditionalValue)
              : text,
            help: 'the tagged value’s value',
          },
        ]
      : []),
  ];
};

/** One of a dialect's declared sets, as its editors list them. */
export type CatalogEntry = { name: string; appliesTo: string[] };
export type CatalogCategory = {
  id: 'stereotypes' | 'taggedValues' | 'groupers';
  label: string;
  entries: CatalogEntry[];
};

/** A kind's name as people read it: `istar.Task` → `Task`, `<dialect>.Plan` → `Plan`. */
export const kindLabel = (kind: string): string => kind.replace(/^[^.]+\./, '');

/**
 * What a dialect declares, by category (its stereotypes, tagged values and
 * groupers), each entry with the kinds or groupers it applies to.
 */
export const extensionCatalog = (
  extension: ExtensionDefinition,
): CatalogCategory[] => [
  {
    id: 'stereotypes',
    label: 'Stereotype',
    entries: extension.stereotypes.map(({ name, appliesTo }) => ({
      name,
      appliesTo: appliesTo.map(kindLabel),
    })),
  },
  {
    id: 'taggedValues',
    label: 'Tagged Value',
    entries: extension.taggedValues.map(({ name, appliesTo }) => ({
      name,
      appliesTo: appliesTo.map(kindLabel),
    })),
  },
  {
    id: 'groupers',
    label: 'Grouper',
    entries: Object.entries(extension.groupers).map(([name, kinds]) => ({
      name,
      appliesTo: kinds.map(kindLabel),
    })),
  },
];

/** The iStar kind a definition's kind is (an engine's `task` is `istar.Task`). */
export const istarKindOf = (kind: string): string =>
  (ISTAR_KIND_OF as Record<string, string>)[kind] ?? kind;

/**
 * A definition with a dialect's stereotypes and tagged values: each kind it
 * has gets its profile's properties, and annotations writing them on its line.
 */
export const withExtension = (
  base: AnyDialect,
  extension: ExtensionDefinition,
  named: Pick<AnyDialect, 'id' | 'name'> = {
    id: `${base.id}+${extension.name}`,
    name: `${base.name} + ${extension.label}`,
  },
) => {
  const elements: Record<string, unknown> = { ...base.elements };
  const properties: Record<string, readonly PropertyDefinition[]> = {
    ...base.properties,
  };
  for (const [kind, element] of Object.entries(base.elements)) {
    if (!element) continue;
    const added = profileProperties(extension, istarKindOf(kind));
    elements[kind] = {
      ...element,
      annotated: true,
    };
    properties[kind] = [...(base.properties[kind] ?? []), ...added];
  }
  return defineDialect({
    ...base,
    ...named,
    elements,
    properties,
  } as AnyDialect);
};

/** The fill of a piStar node without its own colour (an actor's boundary has none). */
const NODE_FILL = '#CDFECD';

/**
 * A dialect's own definition, for no engine: every iStar kind and the
 * dialect's, each a line `{name}` with its stereotype and tagged value before
 * it (lines are their elements' in order; no notation, no ids, no property
 * lines). The dialect's `name` is its id.
 */
export const dialectDefinition = (extension: ExtensionDefinition) => {
  const kinds = [
    ...ISTAR_ACTOR_KINDS,
    ...ISTAR_NODE_KINDS,
    ...extension.elements.map((element) => element.kind),
  ];
  const element: ElementDefinition = {
    fill: NODE_FILL,
  };
  const plain = {
    id: extension.name,
    name: extension.label,
    extension,
    elements: Object.fromEntries(kinds.map((kind) => [kind, element])),
    defaultFill: NODE_FILL,
    properties: Object.fromEntries(kinds.map((kind) => [kind, []])),
    propertyLineOrder: [],
    indent: '  ',
    // the notation's problems are never reported: it has no notation
    problems: {
      notAChild: { severity: 'error', message: 'Not a child' },
      missingFromNotation: { severity: 'warning', message: 'Missing' },
      relationMismatch: { severity: 'error', message: 'Relation mismatch' },
      notInDiagram: {
        severity: 'error',
        message: 'Add this element in the diagram',
      },
    },
  } satisfies AnyDialect;
  return withExtension(plain, extension, {
    id: extension.name,
    name: extension.label,
  });
};
