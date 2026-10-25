/**
 * The modelling dialects a model may be for (@goal-controller/dialect'
 * extensions), like an engine: chosen explicitly and recorded in the file.
 * Only a model recorded for a dialect is read with its kinds; any other is
 * its framework's root (iStar 2.0 unless it records another,
 * goal-controller#171), so a dialect's kinds fail to load in the engines'
 * modes. No engine reads a dialect: it has no generation.
 */
import {
  childrenOf,
  createEmptyModel,
  extendMetamodel,
  fileMetamodelExtension,
  fileMetamodelOf,
  FILE_METAMODEL_KEY,
  isActorIn,
  metamodelOf,
  parsePistar,
  validateFileMetamodel,
  type AnyMetamodel,
} from '@istar-ts/core';
import type { ActionGuard } from '@istar-ts/actions';
import {
  DEFAULT_FRAMEWORK,
  dialectDefinition,
  MODEL_NAMESPACE,
  withModelEntries,
  type AnyDialect,
  type DocumentNode,
  type DocumentTree,
  type ExtensionDefinition,
  type Framework,
  type ModelExtension,
} from '@goal-controller/dialect';
import { istar4RationalAgents, type AnyModel } from '@goal-controller/lib';
// the mode a model records: read by the project module, the one place that knows where
import { recordedMode } from '../project';
import { ENGINE_FILE_KINDS } from './engineDialects';
import { FRAMEWORK_ROOTS, frameworkOfModel, hostFor } from './frameworks';

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
    hostFor('istar-2.0', dialect),
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

/**
 * Rejects an `istar.setFileMetamodel` whose block piStar-ext's dialect refuses (a
 * stereotype, tagged value or grouper name already taken; goal-controller#411):
 * the check `writeModelExtension` used to run before rewriting the text, now the
 * host rule for that operation.
 */
export const pistarExtMetamodelGuard: ActionGuard<string, string> = (
  operation,
) => {
  if (operation.kind !== 'istar.setFileMetamodel' || !operation.block) return;
  try {
    withModelEntries(DIALECTS.pistarext, operation.block as ModelExtension);
  } catch (error) {
    return [
      {
        elementId: '',
        severity: 'error',
        message: error instanceof Error ? error.message : String(error),
        source: 'pistarext',
      },
    ];
  }
};

/** Each dialect's own definition, without a model's additions. */
export const DIALECT_DEFINITIONS = {
  pistarext: modelDialect('pistarext', { name: MODEL_NAMESPACE }).definition,
} satisfies Record<DialectMode, unknown>;

/**
 * The metamodel a mode reads a model with: its dialect's with what the model
 * adds, or its framework's root (by default, the text's: frameworkOfModel),
 * with what a model of a framework besides iStar 2.0 declares (its
 * dialect's own kinds, goal-controller#194: KAOS's operations). Throws as
 * istar-ts does when the model's kinds collide with the dialect's.
 */
export const metamodelOfMode = (
  mode: string | null,
  text = '',
  framework: Framework = frameworkOfModel(text),
): AnyMetamodel => {
  const block = JSON.parse(text || '{}')?.[FILE_METAMODEL_KEY];
  const host = isDialectMode(mode)
    ? HOSTS[mode]
    : framework !== DEFAULT_FRAMEWORK && FRAMEWORK_ROOTS[framework];
  if (!host) return FRAMEWORK_ROOTS[framework];
  return block
    ? extendMetamodel(
        host,
        fileMetamodelExtension(validateFileMetamodel(block)),
      )
    : host;
};

/**
 * Whether a model read in a mode applies its file's `"metamodel"` block: an
 * engine's whose models declare its kinds (`fileKinds`), and any model of a
 * framework besides iStar 2.0, whose dialect's own kinds its importer
 * declares there (goal-controller#194).
 */
export const declaresKinds = (mode: string | null, framework: Framework) =>
  (mode !== null && mode in ENGINE_FILE_KINDS) ||
  framework !== DEFAULT_FRAMEWORK;

/*
 * A model read with a dialect is typed as an iStar 2.0 one: the workbench's
 * helpers switch on iStar's kinds and pass any other through, and the model
 * keeps its metamodel (@istar-ts/core's metamodelOf), so it is written back
 * with the dialect's kinds.
 */

/**
 * Parses a piStar file with the metamodel of `mode` (by default, of the mode
 * the file records): a dialect's with the file's own block applied (istar-ts
 * remembers it, and writes it back), or the root of `framework` (by default,
 * the file's: what its content is written in, else what it records); throws as `parsePistar` does, or why the
 * block's groupers, stereotypes or tagged values cannot be read.
 */
export const parseModel = (
  text: string,
  mode: string | null = recordedMode(text),
  framework: Framework = frameworkOfModel(text),
): AnyModel => {
  if (!isDialectMode(mode))
    return parsePistar(text, {
      metamodel: FRAMEWORK_ROOTS[framework],
      // an engine whose models declare kinds of their own, or a framework's
      // model its dialect's (goal-controller#194): their block applied
      fileMetamodel: declaresKinds(mode, framework),
    });
  const model = parsePistar(text, {
    metamodel: HOSTS[mode],
    fileMetamodel: true,
  });
  const block = fileMetamodelOf(model);
  if (block) withModelEntries(DIALECTS[mode], block as ModelExtension);
  return model;
};

/** An empty model for a mode (a dialect's may use its kinds), in a framework. */
export const emptyModel = (
  mode: string | null = null,
  framework: Framework = DEFAULT_FRAMEWORK,
): AnyModel =>
  createEmptyModel(undefined, {
    metamodel: isDialectMode(mode) ? HOSTS[mode] : FRAMEWORK_ROOTS[framework],
  });

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
export const dialectTree = (model: AnyModel): DocumentTree => {
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
