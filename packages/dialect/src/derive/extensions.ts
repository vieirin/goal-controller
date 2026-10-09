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
  declarationKeys,
  defineDialect,
  type AnyDialect,
  type ConditionalValue,
  type DeclarationDefinition,
  type ElementDefinition,
  type ExtensionDefinition,
  type LinkRulesDefinition,
  type PropertyDefinition,
  type ValueConfig,
} from '../schema';

/** `@istar-ts/core`'s `MetamodelExtension`, structurally (this package has no dependencies). */
export type MetamodelExtensionData = {
  name: string;
  elements: {
    kind: string;
    label?: string;
    category?: 'node' | 'actor';
    behavesLike?: string;
    pistarType?: string;
    size?: { width: number; height: number };
  }[];
  links: {
    kind: string;
    label?: string;
    behavesLike?: string;
    rules?: LinkRulesDefinition;
    pistarType?: string;
  }[];
};

/** The fields that are set, without the others (a metamodel extension has no undefined ones). */
export const defined = <T extends object>(value: T): T =>
  Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as T;

/** The metamodel extension a dialect's models are read with (presentation left out). */
export const metamodelExtensionOf = (
  extension: ExtensionDefinition,
): MetamodelExtensionData => ({
  name: extension.name,
  elements: extension.elements.map(
    ({ kind, label, category, behavesLike, pistarType, size }) =>
      defined({ kind, label, category, behavesLike, pistarType, size }),
  ),
  links: extension.links.map(
    ({ kind, label, behavesLike, rules, pistarType }) =>
      defined({ kind, label, behavesLike, rules, pistarType }),
  ),
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
export const annotationKeys = (extension: ExtensionDefinition) => {
  const [stereotype] = declarationKeys(extension.annotations.stereotype);
  const [tag, tagValue] = declarationKeys(extension.annotations.taggedValue);
  return { stereotype: stereotype!, tag: tag!, tagValue };
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

/**
 * The annotations any element (or link) carries, in line order: its stereotype,
 * then its tagged value. Every kind may carry both (a stereotype or tag its
 * profile does not list is written as typed); the profile lists the known ones.
 */
export const annotationsFor = (
  extension: ExtensionDefinition,
  _kind: string,
): DeclarationDefinition[] => {
  const { stereotype, taggedValue } = extension.annotations;
  return [stereotype, taggedValue];
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
const istarKindOf = (kind: string): string =>
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
      annotations: annotationsFor(extension, istarKindOf(kind)),
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
    line: '{name}',
    // anything but a line break: a name is the label as piStar shows it
    nameCharset: '.',
    fill: NODE_FILL,
  };
  const plain = {
    id: extension.name,
    name: extension.label,
    elements: Object.fromEntries(kinds.map((kind) => [kind, element])),
    defaultFill: NODE_FILL,
    properties: Object.fromEntries(kinds.map((kind) => [kind, []])),
    propertyLine: { separator: ' ', keyPattern: '[A-Za-z]+' },
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
    languages: {},
  } satisfies AnyDialect;
  return withExtension(plain, extension, {
    id: extension.name,
    name: extension.label,
  });
};
