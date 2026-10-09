/**
 * The iStar dialects the workbench reads (@goal-controller/definitions'
 * extensions): every model is parsed with their kinds, so a model using them
 * opens (one that doesn't reads as plain iStar 2.0), and its elements' stereotypes
 * and tagged values are shown as their annotations. The engines read neither.
 */
import {
  createEmptyModel,
  defineMetamodelExtension,
  extendMetamodel,
  ISTAR_2_0,
  parsePistar,
  type AnyMetamodel,
  type IstarModel,
} from '@istar-ts/core';
import {
  annotationKeys,
  istar4RationalAgents,
  metamodelExtensionOf,
  withExtension,
  writeAnnotations,
  type EngineDefinition,
  type ExtensionDefinition,
} from '@goal-controller/definitions';

/** The dialects every model is read with. */
export const DIALECTS: readonly ExtensionDefinition[] = [istar4RationalAgents];

/** iStar 2.0 with every dialect's kinds and links. */
export const WORKBENCH_METAMODEL: AnyMetamodel = DIALECTS.reduce<AnyMetamodel>(
  (metamodel, dialect) =>
    extendMetamodel(
      metamodel,
      defineMetamodelExtension(metamodelExtensionOf(dialect)),
    ),
  ISTAR_2_0,
);

/*
 * A model read with the dialects is typed as an iStar 2.0 one: the workbench's
 * helpers switch on iStar's kinds and pass any other through, and the model
 * keeps its metamodel (@istar-ts/core's metamodelOf), so it is written back
 * with the dialects' kinds.
 */

/** Parses a piStar file with every dialect's kinds (throws as `parsePistar` does). */
export const parseModel = (text: string): IstarModel =>
  parsePistar(text, {
    metamodel: WORKBENCH_METAMODEL,
  }) as unknown as IstarModel;

/** An empty model that may use every dialect's kinds. */
export const emptyModel = (): IstarModel =>
  createEmptyModel(undefined, {
    metamodel: WORKBENCH_METAMODEL,
  }) as unknown as IstarModel;

/** An engine definition with the dialects' annotations, for its editors (the engine reads none). */
export const withDialects = (engine: EngineDefinition): EngineDefinition =>
  DIALECTS.reduce<EngineDefinition>(
    (definition, dialect) => withExtension(definition, dialect),
    engine,
  );

/** The properties the dialects' annotations set (`stereotype`, `tag`, `tagValue`), and by which. */
export const dialectOfKey = (key: string): ExtensionDefinition | undefined =>
  DIALECTS.find((dialect) =>
    Object.values(annotationKeys(dialect)).includes(key),
  );

/** What an element's label carries before its name: `<<goal-based>> {Id = G1}`, or null. */
export const labelAnnotations = (
  properties: Readonly<Record<string, string | undefined>> | undefined,
): string | null => {
  if (!properties) return null;
  for (const dialect of DIALECTS) {
    const { stereotype, taggedValue } = dialect.annotations;
    const written = writeAnnotations([stereotype, taggedValue], properties);
    if (written) return written;
  }
  return null;
};
