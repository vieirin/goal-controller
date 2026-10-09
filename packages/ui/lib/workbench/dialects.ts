/**
 * The modelling dialects a model may be for (@goal-controller/dialect'
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
  fileMetamodelExtension,
  fileMetamodelOf,
  FILE_METAMODEL_KEY,
  isActorIn,
  ISTAR_2_0,
  metamodelOf,
  parsePistar,
  validateFileMetamodel,
  type AnyMetamodel,
  type IstarModel,
} from '@istar-ts/core';
import {
  dialectDefinition,
  metamodelExtensionOf,
  MODEL_NAMESPACE,
  withModelEntries,
  type AnyDialect,
  type DocumentNode,
  type DocumentTree,
  type ExtensionDefinition,
  type ModelExtension,
} from '@goal-controller/dialect';
import { istar4RationalAgents } from '@goal-controller/lib';

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

/** The metamodel a dialect's models are read with: iStar 2.0 with its kinds and links. */
const HOSTS = Object.fromEntries(
  Object.entries(DIALECTS).map(([mode, dialect]) => [
    mode,
    extendMetamodel(
      ISTAR_2_0,
      defineMetamodelExtension(metamodelExtensionOf(dialect)),
    ),
  ]),
) as Record<DialectMode, AnyMetamodel>;

/**
 * What a model adds to its dialect is kept in its file, in istar-ts's
 * `"metamodel"` block (FILE_METAMODEL_KEY): its own kinds and links, which
 * istar-ts reads, checks, draws and writes, and beside them its own
 * groupers, stereotypes and tagged values (ours; istar-ts keeps them).
 * This is the block a model text has, read without parsing it (none: an empty one).
 */
export const modelExtensionOf = (text: string): ModelExtension => {
  try {
    const value = JSON.parse(text)?.[FILE_METAMODEL_KEY];
    if (value && typeof value === 'object') return value;
  } catch {
    // none
  }
  return { name: MODEL_NAMESPACE };
};

/** A dialect as one model has it: with what the model adds. */
export type ModelDialect = {
  mode: DialectMode;
  /** what the model adds (the model's to edit) */
  model: ModelExtension;
  /** the dialect with it */
  extension: ExtensionDefinition;
  /** its definition: lines, stereotypes and tagged values */
  definition: AnyDialect;
};

/**
 * A dialect with what a model adds; throws why the model's groupers,
 * stereotypes or tagged values cannot be read with it (its kinds are
 * istar-ts's to check, when the model is read).
 */
export const modelDialect = (
  mode: DialectMode,
  model: ModelExtension,
): ModelDialect => {
  const extension = withModelEntries(DIALECTS[mode], model);
  return { mode, model, extension, definition: dialectDefinition(extension) };
};

/** Each dialect's own definition, without a model's additions. */
export const DIALECT_DEFINITIONS = {
  pistarext: modelDialect('pistarext', { name: MODEL_NAMESPACE }).definition,
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
 * adds, or iStar 2.0. Throws as istar-ts does when the model's kinds collide
 * with the dialect's.
 */
export const metamodelOfMode = (
  mode: string | null,
  text = '',
): AnyMetamodel => {
  if (!isDialectMode(mode)) return ISTAR_2_0;
  const block = JSON.parse(text || '{}')?.[FILE_METAMODEL_KEY];
  return block
    ? extendMetamodel(
        HOSTS[mode],
        fileMetamodelExtension(validateFileMetamodel(block)),
      )
    : HOSTS[mode];
};

/*
 * A model read with a dialect is typed as an iStar 2.0 one: the workbench's
 * helpers switch on iStar's kinds and pass any other through, and the model
 * keeps its metamodel (@istar-ts/core's metamodelOf), so it is written back
 * with the dialect's kinds.
 */

/**
 * Parses a piStar file with the metamodel of `mode` (by default, of the mode
 * the file records): a dialect's with the file's own block applied (istar-ts
 * remembers it, and writes it back); throws as `parsePistar` does, or why the
 * block's groupers, stereotypes or tagged values cannot be read.
 */
export const parseModel = (
  text: string,
  mode: string | null = recordedModeOf(text),
): IstarModel => {
  if (!isDialectMode(mode))
    return parsePistar(text, { metamodel: ISTAR_2_0 }) as unknown as IstarModel;
  const model = parsePistar(text, {
    metamodel: HOSTS[mode],
    fileMetamodel: true,
  });
  const block = fileMetamodelOf(model);
  if (block) withModelEntries(DIALECTS[mode], block as ModelExtension);
  return model as unknown as IstarModel;
};

/** An empty model for a mode (a dialect's may use its kinds). */
export const emptyModel = (mode: string | null = null): IstarModel =>
  createEmptyModel(undefined, {
    metamodel: isDialectMode(mode) ? HOSTS[mode] : ISTAR_2_0,
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
