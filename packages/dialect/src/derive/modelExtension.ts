/**
 * What one model adds to its dialect, kept in the model file: istar-ts's
 * `"metamodel"` block (the model's own kinds and links, with how they are
 * drawn; istar-ts reads, checks and writes them), and beside them, in the same
 * block, the model's own groupers, stereotypes and tagged values (ours).
 * Read with the dialect, it is one ExtensionDefinition; what the model adds is
 * told apart (its entries are the model's to edit, the dialect's are not).
 * Nothing here knows a dialect.
 */
import {
  ISTAR_ACTOR_KINDS,
  ISTAR_LINK_KINDS,
  ISTAR_NODE_KINDS,
  defineExtension,
  type ExtensionDefinition,
  type LinkRulesDefinition,
  type StereotypeDefinition,
  type TaggedValueDefinition,
} from '../schema';
import { defined, kindLabel } from './extensions';

/** The namespace of a model's own kinds (`model.Mission`), and its block's name. */
export const MODEL_NAMESPACE = 'model';

/** A node or actor kind the model declares (istar-ts's `FileElementKind`, as far as it is read here). */
export type ModelElementKind = {
  kind: string;
  label?: string;
  category?: 'node' | 'actor';
  behavesLike?: string;
  pistarType?: string;
  size?: { width: number; height: number };
  /** drawn by istar-ts */
  shape?: { path: string; viewBox?: string };
  textBox?: { top: number; right: number; bottom: number; left: number };
};

/** A link kind the model declares (istar-ts's `FileLinkKind`, as far as it is read here). */
export type ModelLinkKind = {
  kind: string;
  label?: string;
  behavesLike?: string;
  rules?: LinkRulesDefinition;
  pistarType?: string;
  /** drawn by istar-ts: an SVG dash array, a marker path */
  line?: { dash?: string; marker?: string | false; markerFilled?: boolean };
};

/**
 * The file's `"metamodel"` block: istar-ts's (`name`, `elements`, `links`),
 * and the model's groupers, stereotypes and tagged values as extra keys (which
 * istar-ts keeps and writes back).
 */
export type ModelExtension = {
  name: string;
  elements?: readonly ModelElementKind[];
  links?: readonly ModelLinkKind[];
  groupers?: Readonly<Record<string, readonly string[]>>;
  stereotypes?: readonly StereotypeDefinition[];
  taggedValues?: readonly TaggedValueDefinition[];
};

/** Whether a model's extension adds nothing (then its file has no block). */
export const isEmptyModelExtension = (model: ModelExtension): boolean =>
  !model.elements?.length &&
  !model.links?.length &&
  !Object.keys(model.groupers ?? {}).length &&
  !model.stereotypes?.length &&
  !model.taggedValues?.length;

/**
 * Why a name a model would add is taken (by the dialect, iStar or the model),
 * or null. A kind's is its label: istar-ts rejects a kind or piStar type
 * already taken, not a second kind shown with the same name.
 */
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
 * A dialect with what a model adds: its kinds (as the dialect's are, their
 * drawing left to istar-ts), groupers, stereotypes and tagged values. Throws
 * why the model's groupers, stereotypes or tagged values cannot be read with
 * it: a name the dialect already has, or a kind or grouper nobody declares.
 * Its kinds are istar-ts's to check (a kind or piStar type taken).
 */
export const withModelEntries = (
  dialect: ExtensionDefinition,
  model: ModelExtension,
): ExtensionDefinition => {
  if (isEmptyModelExtension(model)) return dialect;
  const fail = (why: string) => {
    throw new Error(`the model's extension: ${why}`);
  };
  const names = [
    ...Object.keys(model.groupers ?? {}).map(
      (name) => ['grouper', name] as const,
    ),
    ...(model.stereotypes ?? []).map(
      ({ name }) => ['stereotype', name] as const,
    ),
    ...(model.taggedValues ?? []).map(
      ({ name }) => ['taggedValue', name] as const,
    ),
  ];
  for (const [category, name] of names) {
    const taken = takenName(dialect, category, name);
    if (taken) fail(taken);
  }
  const elements = (model.elements ?? []).map(
    ({ kind, label, category, behavesLike, pistarType, size }) =>
      defined({ kind, label, category, behavesLike, pistarType, size }),
  );
  const links = (model.links ?? []).map(
    ({ kind, label, behavesLike, rules, pistarType }) =>
      defined({ kind, label, behavesLike, rules, pistarType }),
  );
  // every name its entries use: the dialect's or its own
  defineExtension(
    {
      ...dialect,
      name: MODEL_NAMESPACE,
      elements,
      links,
      groupers: model.groupers ?? {},
      stereotypes: model.stereotypes ?? [],
      taggedValues: model.taggedValues ?? [],
    },
    dialect,
  );
  return {
    ...dialect,
    elements: [...dialect.elements, ...elements],
    links: [...dialect.links, ...links],
    groupers: { ...dialect.groupers, ...model.groupers },
    stereotypes: [...dialect.stereotypes, ...(model.stereotypes ?? [])],
    taggedValues: [...dialect.taggedValues, ...(model.taggedValues ?? [])],
  };
};
