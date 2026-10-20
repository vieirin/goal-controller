/**
 * The goal-modelling frameworks a model may be in (goal-controller#171):
 * each is read with one of istar-ts's root metamodels, iStar 2.0's, KAOS's
 * or the NFR Framework's. A dialect extends its framework's root; nothing
 * converts a model from one framework to another.
 */
import {
  createEmptyModel,
  defineMetamodelExtension,
  detectFramework,
  extendMetamodel,
  ISTAR_2_0,
  toPistar,
  type AnyMetamodel,
} from '@istar-ts/core';
import { KAOS_OBSTACLES } from '@istar-ts/dsm3-kaos/metamodel';
import { NFR } from '@istar-ts/dsm3-nfr/metamodel';
import {
  DEFAULT_FRAMEWORK,
  FRAMEWORKS,
  metamodelExtensionOf,
  type ExtensionDefinition,
  type Framework,
} from '@goal-controller/dialect';
import type { AnyModel } from '@goal-controller/lib';
import { recordedFramework, withModelSettings } from '../project';

/**
 * The root metamodel of each framework, as the workbench reads it: KAOS with
 * its obstacle analysis (istar-ts's `KAOS_OBSTACLES`, goal-controller#181),
 * which reads DSM3's files as KAOS does.
 */
export const FRAMEWORK_ROOTS: Readonly<Record<Framework, AnyMetamodel>> = {
  'istar-2.0': ISTAR_2_0,
  kaos: KAOS_OBSTACLES,
  nfr: NFR,
};

/** Shown to people. */
export const FRAMEWORK_LABEL: Readonly<Record<Framework, string>> = {
  'istar-2.0': 'iStar 2.0',
  kaos: 'KAOS',
  nfr: 'NFR Framework',
};

/**
 * The framework a model text is in: the one its content is written in
 * (istar-ts's detectFramework: its kinds' prefix, or its tool), else the one
 * it records, else iStar 2.0. Content wins over the record.
 */
export const frameworkOfModel = (text: string): Framework => {
  let detected: string | undefined;
  try {
    detected = detectFramework(
      text,
      FRAMEWORKS.map((framework) => FRAMEWORK_ROOTS[framework]),
    )?.framework;
  } catch {
    // not a model: what it records, if anything
  }
  return (
    FRAMEWORKS.find((framework) => framework === detected) ??
    recordedFramework(text) ??
    DEFAULT_FRAMEWORK
  );
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
export const emptyModelOf = (framework: Framework): AnyModel =>
  createEmptyModel(undefined, {
    metamodel: FRAMEWORK_ROOTS[framework],
  });

/**
 * A new, empty model file of a framework: its root's piStar text, recording
 * the framework when it isn't iStar 2.0 (an iStar one is as it always was).
 */
export const emptyModelText = (framework: Framework): string =>
  withModelSettings(
    `${toPistar(emptyModelOf(framework), { saveDate: '' })}\n`,
    { framework },
  );
