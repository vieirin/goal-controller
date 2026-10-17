/**
 * The goal-modelling frameworks a model may be in (goal-controller#171):
 * each is read with one of istar-ts's root metamodels, iStar 2.0's, KAOS's
 * or the NFR Framework's. A dialect extends its framework's root; nothing
 * converts a model from one framework to another.
 */
import {
  createEmptyModel,
  defineMetamodelExtension,
  extendMetamodel,
  ISTAR_2_0,
  toPistar,
  type AnyMetamodel,
  type IstarModel,
} from '@istar-ts/core';
import { KAOS } from '@istar-ts/dsm3-kaos';
import { NFR } from '@istar-ts/dsm3-nfr';
import {
  metamodelExtensionOf,
  type ExtensionDefinition,
  type Framework,
} from '@goal-controller/dialect';
import { withModelSettings } from '../project';

/** The root metamodel of each framework. */
export const FRAMEWORK_ROOTS: Readonly<Record<Framework, AnyMetamodel>> = {
  'istar-2.0': ISTAR_2_0,
  kaos: KAOS,
  nfr: NFR,
};

/** Shown to people. */
export const FRAMEWORK_LABEL: Readonly<Record<Framework, string>> = {
  'istar-2.0': 'iStar 2.0',
  kaos: 'KAOS',
  nfr: 'NFR Framework',
};

/**
 * The metamodel a framework's models are read with: its root, with the kinds
 * and links of a dialect's extension when it has one.
 */
export const hostFor = (
  framework: Framework,
  extension?: ExtensionDefinition,
): AnyMetamodel =>
  extension
    ? extendMetamodel(
        FRAMEWORK_ROOTS[framework],
        defineMetamodelExtension(metamodelExtensionOf(extension)),
      )
    : FRAMEWORK_ROOTS[framework];

/** An empty model of a framework, written with its root's tool and version. */
export const emptyModelOf = (framework: Framework): IstarModel =>
  createEmptyModel(undefined, {
    metamodel: FRAMEWORK_ROOTS[framework],
  }) as unknown as IstarModel;

/**
 * A new, empty model file of a framework: its root's piStar text, recording
 * the framework when it isn't iStar 2.0 (an iStar one is as it always was).
 */
export const emptyModelText = (framework: Framework): string =>
  withModelSettings(
    `${toPistar(emptyModelOf(framework), { saveDate: '' })}\n`,
    { framework },
  );
