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
  istar4RationalAgents,
  metamodelExtensionOf,
  type DocumentNode,
  type DocumentTree,
  type ExtensionDefinition,
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

/** Each dialect's own definition: its lines, stereotypes and tagged values (no notation). */
export const DIALECT_DEFINITIONS = {
  pistarext: dialectDefinition(istar4RationalAgents),
} satisfies Record<DialectMode, unknown>;

/** iStar 2.0 with a dialect's kinds and links. */
const DIALECT_METAMODELS: Record<DialectMode, AnyMetamodel> = {
  pistarext: extendMetamodel(
    ISTAR_2_0,
    defineMetamodelExtension(metamodelExtensionOf(istar4RationalAgents)),
  ),
};

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

/** The metamodel a mode reads models with: its dialect's, or iStar 2.0. */
export const metamodelOfMode = (mode: string | null): AnyMetamodel =>
  isDialectMode(mode) ? DIALECT_METAMODELS[mode] : ISTAR_2_0;

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
    metamodel: metamodelOfMode(mode),
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
