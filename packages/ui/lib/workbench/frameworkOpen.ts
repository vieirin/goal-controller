/**
 * Opening a model file in its framework (goal-controller#171): the
 * framework is the model's by its content (`frameworkOfModel`: DSM3's own
 * files record none), a KAOS or NFR model that records no mode of its
 * framework opens in the framework's mode (recorded in the opened text, as
 * an example's folder mode is), and a model of another framework than the
 * open project's is refused unless the project is switched.
 */
import type { AnyDialect, Framework } from '@goal-controller/dialect';
import type { AnyModel } from '@goal-controller/lib';
import { updateElement } from '@istar-ts/core';
import { parseModel } from './dialects';
import {
  FRAMEWORK_DIALECTS,
  isFrameworkMode,
  type FrameworkMode,
} from './frameworkModes';
import { frameworkOfModel } from './frameworks';
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
 * Why a model can't open in the open project as it is (null: it can): it
 * is in another framework (conformity's message, `frameworkMismatch`).
 * Opening it switches the project's framework, which only an explicit
 * confirmation does.
 */
export const openingMismatch = (
  text: string,
  project: Framework | undefined,
): string | null => {
  if (project === undefined) return null;
  const framework = frameworkOfModel(text);
  return framework === project
    ? null
    : frameworkMismatch(text, frameworkModeOf(framework) ?? 'pistar', project);
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
