/**
 * The modelling dialects a model may be for (@goal-controller/definitions'
 * extensions), like an engine: chosen explicitly and recorded in the file.
 * Only a model recorded for a dialect is read with its kinds; any other is
 * plain iStar 2.0, so a dialect's kinds fail to load in the engines' modes.
 * No engine reads a dialect: it has no generation.
 */
import {
  childrenOf,
  createEmptyModel,
  defineMetamodelExtension,
  extendMetamodel,
  isActorIn,
  ISTAR_2_0,
  metamodelOf,
  parsePistar,
  type AnyMetamodel,
  type IstarModel,
} from '@istar-ts/core';
import {
  dialectDefinition,
  isEmptyModelExtension,
  istar4RationalAgents,
  metamodelExtensionOf,
  withModelExtension,
  type AnyDefinition,
  type DocumentNode,
  type DocumentTree,
  type ExtensionDefinition,
  type ModelExtension,
} from '@goal-controller/definitions';

/** The dialects, by the mode a model records for them. */
export const DIALECTS = {
  pistarext: istar4RationalAgents,
} as const satisfies Record<string, ExtensionDefinition>;

export type DialectMode = keyof typeof DIALECTS;

export const DIALECT_LABEL: Record<DialectMode, string> = {
  pistarext: 'piStar-ext',
};

export const isDialectMode = (mode: unknown): mode is DialectMode =>
  typeof mode === 'string' && mode in DIALECTS;

/**
 * What a model adds to its dialect (its own kinds, links, groupers,
 * stereotypes and tagged values) is kept in the file, under this key: piStar
 * keeps unknown keys, and so does @istar-ts/core.
 */
export const MODEL_EXTENSION_KEY = 'modelExtension';

/** What a model text adds to its dialect, read without parsing it (none: `{}`). */
export const modelExtensionOf = (text: string): ModelExtension => {
  try {
    const value = JSON.parse(text)?.[MODEL_EXTENSION_KEY];
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
};

/** A model text with what it adds to its dialect (none: the key goes), its formatting kept. */
export const writeModelExtension = (
  text: string,
  model: ModelExtension,
): string => {
  const json = JSON.parse(text);
  if (isEmptyModelExtension(model)) delete json[MODEL_EXTENSION_KEY];
  else json[MODEL_EXTENSION_KEY] = model;
  const indent = /\n([ \t]+)"/.exec(text)?.[1] ?? '  ';
  return JSON.stringify(json, null, indent) + (text.endsWith('\n') ? '\n' : '');
};

/** A dialect as one model has it: with what the model adds. */
export type ModelDialect = {
  mode: DialectMode;
  /** what the model adds (the model's to edit) */
  model: ModelExtension;
  /** the dialect with it */
  extension: ExtensionDefinition;
  /** its definition: lines, stereotypes and tagged values */
  definition: AnyDefinition;
  /** iStar 2.0 with its kinds and links */
  metamodel: AnyMetamodel;
};

const dialects = new Map<string, ModelDialect>();

/**
 * A dialect with what a model text adds; throws why the text's additions
 * cannot be read with it (a name the dialect has, an unknown kind). Kept by
 * dialect and additions, so a model's edits reuse it.
 */
export const modelDialect = (mode: DialectMode, text: string): ModelDialect => {
  const model = modelExtensionOf(text);
  const key = `${mode}|${JSON.stringify(model)}`;
  const known = dialects.get(key);
  if (known) return known;
  const extension = withModelExtension(DIALECTS[mode], model);
  const read: ModelDialect = {
    mode,
    model,
    extension,
    definition: dialectDefinition(extension),
    metamodel: extendMetamodel(
      ISTAR_2_0,
      defineMetamodelExtension(metamodelExtensionOf(extension)),
    ),
  };
  dialects.set(key, read);
  return read;
};

/** Each dialect's own definition, without a model's additions. */
export const DIALECT_DEFINITIONS = {
  pistarext: modelDialect('pistarext', '').definition,
} satisfies Record<DialectMode, unknown>;

/**
 * The model's mode is kept in the diagram's custom properties (piStar keeps
 * them, so the file stays a plain piStar model).
 */
export const MODE_PROPERTY = 'engine';

/** The mode a model text records, read without parsing it (its kinds depend on it). */
export const recordedModeOf = (text: string): string | null => {
  try {
    const value = JSON.parse(text)?.diagram?.customProperties?.[MODE_PROPERTY];
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
};

/**
 * The metamodel a mode reads a model with: its dialect's with what the model
 * adds, or iStar 2.0.
 */
export const metamodelOfMode = (
  mode: string | null,
  text = '',
): AnyMetamodel =>
  isDialectMode(mode) ? modelDialect(mode, text).metamodel : ISTAR_2_0;

/*
 * A model read with a dialect is typed as an iStar 2.0 one: the workbench's
 * helpers switch on iStar's kinds and pass any other through, and the model
 * keeps its metamodel (@istar-ts/core's metamodelOf), so it is written back
 * with the dialect's kinds.
 */

/**
 * Parses a piStar file with the metamodel of `mode` (by default, of the mode
 * the file records); throws as `parsePistar` does.
 */
export const parseModel = (
  text: string,
  mode: string | null = recordedModeOf(text),
): IstarModel =>
  parsePistar(text, {
    metamodel: metamodelOfMode(mode, text),
  }) as unknown as IstarModel;

/** An empty model for a mode (a dialect's may use its kinds). */
export const emptyModel = (mode: string | null = null): IstarModel =>
  createEmptyModel(undefined, {
    metamodel: metamodelOfMode(mode),
  }) as unknown as IstarModel;

/** The dialect that reads a model its recorded mode cannot (its kinds are the dialect's), if any. */
export const dialectThatReads = (text: string): DialectMode | null => {
  for (const mode of Object.keys(DIALECTS) as DialectMode[]) {
    try {
      parseModel(text, mode);
      return mode;
    } catch {
      // not this one
    }
  }
  return null;
};

/**
 * A model as a dialect's document reads it: every actor and element by its piStar
 * id (a dialect's names carry no ids), each actor's elements under it, then the
 * elements outside any actor.
 */
export const dialectTree = (model: IstarModel): DocumentTree => {
  const isActor = isActorIn(metamodelOf(model));
  const nodes = new Map<string, DocumentNode>();
  const roots: string[] = [];
  for (const element of model.elements.values()) {
    const actor = isActor(element);
    nodes.set(element.id, {
      iStarId: element.id,
      id: element.id,
      kind: element.kind,
      name: element.name,
      notation: null,
      properties: { ...element.customProperties },
      children: actor ? childrenOf(model, element.id).map((e) => e.id) : [],
    });
    if (actor || !('parent' in element) || !element.parent)
      roots.push(element.id);
  }
  return { nodes, roots };
};
