/**
 * What one model adds to its dialect, kept in the model file: its own kinds
 * and links (with how they are drawn), groupers, stereotypes and tagged
 * values. Read with the dialect, it is one ExtensionDefinition; what the model
 * adds is told apart (its entries are the model's to edit, the dialect's are
 * not). Nothing here knows a dialect.
 */
import {
  ISTAR_ACTOR_KINDS,
  ISTAR_LINK_KINDS,
  ISTAR_NODE_KINDS,
  defineExtension,
  type ExtensionDefinition,
  type ExtensionElementDefinition,
  type ExtensionLinkDefinition,
  type LinkRulesDefinition,
  type StereotypeDefinition,
  type TaggedValueDefinition,
} from '../schema';
import { kindLabel } from './extensions';

/** The namespace of a model's own kinds (`model.Mission`). */
export const MODEL_NAMESPACE = 'model';

export type ModelExtension = {
  elements?: readonly ExtensionElementDefinition[];
  links?: readonly ExtensionLinkDefinition[];
  groupers?: Readonly<Record<string, readonly string[]>>;
  stereotypes?: readonly StereotypeDefinition[];
  taggedValues?: readonly TaggedValueDefinition[];
};

/** Whether a model's extension adds nothing. */
export const isEmptyModelExtension = (model: ModelExtension): boolean =>
  !model.elements?.length &&
  !model.links?.length &&
  !Object.keys(model.groupers ?? {}).length &&
  !model.stereotypes?.length &&
  !model.taggedValues?.length;

/** Why a name a model would add is taken (by the dialect, iStar or the model), or null. */
export const takenName = (
  extension: ExtensionDefinition,
  category: 'kind' | 'grouper' | 'stereotype' | 'taggedValue',
  name: string,
): string | null => {
  const lower = name.trim().toLowerCase();
  const kinds = [
    ...ISTAR_ACTOR_KINDS,
    ...ISTAR_NODE_KINDS,
    ...ISTAR_LINK_KINDS,
    ...extension.elements.map((e) => e.kind),
    ...extension.links.map((l) => l.kind),
  ];
  const own = {
    kind: kinds.map(kindLabel),
    grouper: Object.keys(extension.groupers),
    stereotype: extension.stereotypes.map((s) => s.name),
    taggedValue: [
      ...extension.defaultTags,
      ...extension.taggedValues.map((t) => t.name),
    ],
  }[category];
  return own.some((taken) => taken.toLowerCase() === lower)
    ? `${name.trim()} is already a ${category === 'taggedValue' ? 'tagged value' : category}`
    : null;
};

/**
 * A dialect with what a model adds. Throws why the model's part cannot be read
 * with it: a kind outside the model's namespace, a name the dialect already has
 * (a kind, its piStar type, a grouper, a stereotype or tagged value), or a
 * kind, grouper or link end neither declares.
 */
export const withModelExtension = (
  dialect: ExtensionDefinition,
  model: ModelExtension,
): ExtensionDefinition => {
  if (isEmptyModelExtension(model)) return dialect;
  const fail = (why: string) => {
    throw new Error(`the model's extension: ${why}`);
  };
  const pistarTypes = new Set(
    [...dialect.elements, ...dialect.links].map((k) => k.pistarType ?? k.kind),
  );
  for (const kind of [...(model.elements ?? []), ...(model.links ?? [])]) {
    const taken = takenName(dialect, 'kind', kindLabel(kind.kind));
    if (taken) fail(taken);
    if (kind.pistarType && pistarTypes.has(kind.pistarType))
      fail(`${kind.pistarType} is already a ${dialect.label} kind`);
  }
  for (const grouper of Object.keys(model.groupers ?? {})) {
    const taken = takenName(dialect, 'grouper', grouper);
    if (taken) fail(taken);
  }
  for (const { name } of model.stereotypes ?? []) {
    const taken = takenName(dialect, 'stereotype', name);
    if (taken) fail(taken);
  }
  for (const { name } of model.taggedValues ?? []) {
    const taken = takenName(dialect, 'taggedValue', name);
    if (taken) fail(taken);
  }
  // its namespace, and every name it uses: the dialect's or its own
  defineExtension(
    {
      ...dialect,
      name: MODEL_NAMESPACE,
      elements: model.elements ?? [],
      links: model.links ?? [],
      groupers: model.groupers ?? {},
      stereotypes: model.stereotypes ?? [],
      taggedValues: model.taggedValues ?? [],
    },
    dialect,
  );
  return {
    ...dialect,
    elements: [...dialect.elements, ...(model.elements ?? [])],
    links: [...dialect.links, ...(model.links ?? [])],
    groupers: { ...dialect.groupers, ...model.groupers },
    stereotypes: [...dialect.stereotypes, ...(model.stereotypes ?? [])],
    taggedValues: [...dialect.taggedValues, ...(model.taggedValues ?? [])],
  };
};

/** The part of a dialect-with-model a model added (to read the dialect's apart). */
export const modelExtensionKinds = (model: ModelExtension): Set<string> =>
  new Set([
    ...(model.elements ?? []).map((e) => e.kind),
    ...(model.links ?? []).map((l) => l.kind),
  ]);

/**
 * A new node kind, as a modeller adds one: named, drawn with SVG path data,
 * saved in piStar files as `istar.<Name>`, a node that goes inside actors, at
 * a node's size.
 */
export const newNodeKind = (
  name: string,
  shape: string | undefined,
): ExtensionElementDefinition => ({
  kind: `${MODEL_NAMESPACE}.${name}`,
  label: name,
  category: 'node',
  pistarType: `istar.${name}`,
  size: { width: 90, height: 55 },
  ...(shape?.trim() ? { shape: shape.trim() } : {}),
});

/** A new link kind, as a modeller adds one: its ends, line and marker. */
export const newLinkKind = (
  name: string,
  rules: Pick<LinkRulesDefinition, 'sources' | 'targets'>,
  line: NonNullable<ExtensionLinkDefinition['line']>,
): ExtensionLinkDefinition => ({
  kind: `${MODEL_NAMESPACE}.${name}`,
  label: name,
  pistarType: `istar.${name}`,
  rules,
  line,
});
