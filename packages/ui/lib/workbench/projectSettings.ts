/**
 * A model's settings as the workbench uses them, read from and written to its
 * project's manifest through lib/project (the only code that knows where the
 * manifest is kept). The manifest's options are opaque to lib/project: they
 * are checked here against the options the model's engine reads, and any
 * other key is reported in Problems (Model group) and not used, never
 * dropped silently.
 */
import {
  ManifestError,
  modelSettingsOf,
  type ManifestSettings,
  withModelSettings,
  type EngineOptions,
} from '../project';
import { isOptionValue, type OptionDefinition } from '@goal-controller/dialect';
import { isTransformEngine, type TransformEngine } from '../types';
import { isModellingMode } from './frameworkModes';
import { ENGINE_LABEL, ENGINE_OPTIONS } from './engineDialects';
import type { ModelMode } from './pistar';
import {
  DEFAULT_OPTIONS,
  SOURCE,
  type GenerationOptions,
  type ModelSettings,
  type Problem,
} from './types';

/** The options a mode reads, as its engine declares them; none for piStar and the modelling dialects. */
const declaredOptions = (mode: string | null): readonly OptionDefinition[] =>
  isTransformEngine(mode) ? ENGINE_OPTIONS[mode] : [];

/** What an engine is given of the options; also what a manifest may hold for it. */
export const optionsFor = (
  engine: TransformEngine,
  options: GenerationOptions,
): Partial<GenerationOptions> =>
  Object.fromEntries(
    optionKeysOf(engine).map((key) => [key, options[key]]),
  ) as Partial<GenerationOptions>;

/** The options a mode reads: an engine's; none for piStar and the modelling dialects. */
export const optionKeysOf = (
  mode: string | null,
): (keyof GenerationOptions)[] =>
  declaredOptions(mode).map((option) => option.key as keyof GenerationOptions);

const modeLabel = (mode: string | null): string =>
  isTransformEngine(mode) ? ENGINE_LABEL[mode] : 'a model without an engine';

export type ModelOptions = {
  /** the options the model's manifest sets, among those its mode reads */
  options: Partial<GenerationOptions>;
  /** what the manifest holds that is not used, and why */
  problems: Problem[];
};

/**
 * The options a model's manifest sets for the mode it records. Text that
 * isn't JSON sets none (its JSON problem is reported elsewhere).
 */
export const readModelOptions = (text: string): ModelOptions => {
  let read: ManifestSettings;
  try {
    read = modelSettingsOf(text);
  } catch (error) {
    if (!(error instanceof ManifestError)) return { options: {}, problems: [] };
    return {
      options: {},
      problems: [
        {
          severity: 'error',
          source: SOURCE.settings,
          message: `${error.message}; the model's options are not used`,
        },
      ],
    };
  }
  return checkedOptions(read);
};

/**
 * A manifest's options for a mode, checked: the keys the mode's engine
 * reads, of their type; the others are reported and not used.
 */
export const checkedOptions = (
  read: Pick<ManifestSettings, 'mode' | 'options'>,
): ModelOptions => {
  const declared = declaredOptions(read.mode);
  const options: Partial<GenerationOptions> = {};
  const problems: Problem[] = [];
  for (const [key, value] of Object.entries(read.options)) {
    const option = declared.find((o) => o.key === key);
    if (!option) {
      problems.push({
        severity: 'warning',
        source: SOURCE.settings,
        message: `${modeLabel(read.mode)} has no option "${key}"; it is not used`,
      });
    } else if (!isOptionValue(option, value)) {
      problems.push({
        severity: 'warning',
        source: SOURCE.settings,
        message: `${JSON.stringify(value)} is not a value of "${key}"; it is not used`,
      });
    } else {
      Object.assign(options, { [key]: value });
    }
  }
  return { options, problems };
};

/**
 * The options an engine reads that are worth keeping: those that differ
 * from the defaults, and those that differ in `base` (what applies where
 * the manifest says nothing).
 */
export const optionsToKeep = (
  engine: TransformEngine,
  options: GenerationOptions,
  base: GenerationOptions = DEFAULT_OPTIONS,
): EngineOptions => {
  const kept: Record<string, string | number | boolean> = {};
  for (const key of optionKeysOf(engine))
    if (
      options[key] !== DEFAULT_OPTIONS[key] ||
      base[key] !== DEFAULT_OPTIONS[key]
    )
      kept[key] = options[key];
  return kept;
};

/**
 * The model text with an engine's options in its manifest: those that differ
 * from the defaults, and those that differ in `base` (what applies when the
 * model says nothing), so the model says what it is generated with. A model
 * whose options are all the defaults keeps no options (a bare model stays
 * bare). Throws on text that isn't JSON.
 */
export const withEngineOptions = (
  text: string,
  engine: TransformEngine,
  options: GenerationOptions,
  base: GenerationOptions = DEFAULT_OPTIONS,
): string =>
  withModelSettings(text, { options: optionsToKeep(engine, options, base) });

/**
 * The settings a model opens with: the mode its file records; options from
 * the settings kept with it in Recent (entries written before projects), over
 * the ones in use. The options its manifest sets apply over these
 * (readModelOptions).
 */
export const openingSettings = (
  recorded: ModelMode | null,
  stored: Partial<ModelSettings> | undefined,
  current: ModelSettings,
): ModelSettings => {
  const base = stored ? { ...current, ...stored } : current;
  return isTransformEngine(recorded)
    ? { ...base, pistar: false, dialect: undefined, engine: recorded }
    : {
        ...base,
        pistar: true,
        dialect: recorded && isModellingMode(recorded) ? recorded : undefined,
      };
};
