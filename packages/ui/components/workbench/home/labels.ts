import { isTransformEngine, type TransformEngine } from '@/lib/types';
import {
  MODELLING_LABEL,
  isModellingMode,
  type ModellingMode,
} from '@/lib/workbench/frameworkModes';
import { ENGINE_LABEL } from '@/lib/workbench/engineDialects';
import type { ModelSettings } from '@/lib/workbench/types';

/** What a model is for: its engine, a modelling dialect, or piStar for free modelling. */
export const modelKindLabel = (settings: ModelSettings): string =>
  settings.pistar
    ? settings.dialect
      ? MODELLING_LABEL[settings.dialect]
      : 'piStar'
    : ENGINE_LABEL[settings.engine];

/** An engine's or a modelling dialect's name, as the workbench shows it. */
export const modeLabel = (
  mode: TransformEngine | ModellingMode | undefined,
): string | undefined =>
  mode === undefined
    ? undefined
    : isModellingMode(mode)
      ? MODELLING_LABEL[mode]
      : isTransformEngine(mode)
        ? ENGINE_LABEL[mode]
        : undefined;
