/**
 * Opening a model file in its framework (goal-controller#171): the
 * framework is the model's by its content (`frameworkOfModel`: DSM3's own
 * files record none), a KAOS or NFR model that records no mode of its
 * framework opens in the framework's mode (recorded in the opened text, as
 * an example's folder mode is), and a model of another framework than the
 * open project's is refused unless the project is switched.
 */
import type { Framework } from '@goal-controller/dialect';
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
