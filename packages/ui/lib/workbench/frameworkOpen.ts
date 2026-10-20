/**
 * Opening a model file in its framework (goal-controller#171): the
 * framework is the model's by its content (`frameworkOfModel`: DSM3's own
 * files record none), a KAOS or NFR model that records no mode of its
 * framework opens in the framework's mode (recorded in the opened text, as
 * an example's folder mode is), and a model of another framework than the
 * open one's is refused unless the project is switched. Added to the project
 * instead (goal-controller#329), it keeps its own framework.
 */
import type { AnyDialect, Framework } from '@goal-controller/dialect';
import type { AnyModel } from '@goal-controller/lib';
import { updateElement } from '@istar-ts/core';
import { recordedFramework, type Manifest } from '../project';
import { parseModel } from './dialects';
import {
  FRAMEWORK_DIALECTS,
  isFrameworkMode,
  type FrameworkMode,
} from './frameworkModes';
import { FRAMEWORK_LABEL, frameworkOfModel } from './frameworks';
import {
  frameworkMismatch,
  frameworkOfMode,
  readModelMode,
  serializeModel,
  writeModelMode,
} from './pistar';

/** A framework's own mode (KAOS's `kaos`); none for iStar 2.0, whose models have many. */
export const frameworkModeOf = (framework: Framework): FrameworkMode | null =>
  (Object.keys(FRAMEWORK_DIALECTS) as FrameworkMode[]).find(
    (mode) => FRAMEWORK_DIALECTS[mode].framework === framework,
  ) ?? null;

/**
 * A model text as it opens: a framework's model that records no mode of its
 * framework gets the framework's mode (and the framework) recorded; any
 * other text is as it was.
 */
export const inItsFramework = (text: string): string => {
  const framework = frameworkOfModel(text);
  const mode = frameworkModeOf(framework);
  if (!mode) return text;
  const recorded = readModelMode(text);
  if (
    recorded &&
    isFrameworkMode(recorded) &&
    frameworkOfMode(recorded) === framework
  )
    return text;
  try {
    return writeModelMode(text, mode);
  } catch {
    // not a model: its problems are the file's to show
    return text;
  }
};

/**
 * Why a model can't open in place of the open one as it is (null: it can):
 * it is in another framework than the open model's own (its entry's, `open`;
 * conformity's message, `frameworkMismatch`). Opening it replaces the
 * project, which only an explicit confirmation does; adding it to the
 * project asks nothing (`addingMismatch`).
 */
export const openingMismatch = (
  text: string,
  open: Framework | undefined,
): string | null => {
  if (open === undefined) return null;
  const framework = frameworkOfModel(text);
  return framework === open
    ? null
    : frameworkMismatch(text, frameworkModeOf(framework) ?? 'pistar', open);
};

/**
 * A project model's framework (goal-controller#329): its entry's, else the
 * project's, when the manifest names one, else its content's. A project's
 * models may be of several frameworks.
 */
export const frameworkOfEntry = (
  manifest: Pick<Manifest, 'framework' | 'models'>,
  path: string | undefined,
  text: string,
): Framework =>
  manifest.models.find((model) => model.path === path)?.framework ??
  manifest.framework ??
  frameworkOfModel(text);

/**
 * Why a model can't be added to a project (null: it can, goal-controller#329):
 * it isn't in the framework it declares, the one it records or its recorded
 * mode's. Its framework is its own, by its content: a project's models may
 * be of several frameworks, so no other framework is refused.
 */
export const addingMismatch = (text: string): string | null => {
  const framework = frameworkOfModel(text);
  const declared = recordedFramework(text);
  if (declared !== null && declared !== framework)
    return `The model is in ${FRAMEWORK_LABEL[framework]}, and it records ${FRAMEWORK_LABEL[declared]}: nothing converts a model between frameworks`;
  const mode = readModelMode(text);
  return mode ? frameworkMismatch(text, mode) : null;
};

/** An element name's id, when it starts with one (`G4: …`): its prefix and number. */
const ID_OF_NAME = /^\s*([A-Z]+)(\d+)\s*:/;

/** The next id of a prefix in a model (`G4`), from 1: ids its elements' names start with. */
export const nextFrameworkId = (
  model: Pick<AnyModel, 'elements'>,
  prefix: string,
): string => {
  let max = 0;
  for (const element of model.elements.values()) {
    const match = ID_OF_NAME.exec(element.name);
    if (match?.[1] === prefix) max = Math.max(max, Number(match[2]));
  }
  return `${prefix}${max + 1}`;
};

/**
 * A framework model whose elements' names start with their kind's id
 * (DSM3's files have none, `G1: Reliability`), in the model's order, each
 * prefix numbered on from its highest; null when every listed element has
 * one already (or the text isn't a model). Its Notation lines then name
 * their elements.
 */
export const withFrameworkIds = (
  text: string,
  definition: Pick<AnyDialect, 'elements'>,
): string | null => {
  let model: AnyModel;
  try {
    model = parseModel(text);
  } catch {
    return null;
  }
  let changed = false;
  for (const element of model.elements.values()) {
    const prefix = definition.elements[element.kind]?.prefix;
    if (!prefix || ID_OF_NAME.test(element.name)) continue;
    model = updateElement(model, element.id, {
      name: `${nextFrameworkId(model, prefix)}: ${element.name.trim()}`,
    });
    changed = true;
  }
  return changed ? serializeModel(model, text) : null;
};
