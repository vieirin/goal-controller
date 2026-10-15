import { isTransformEngine, type TransformEngine } from '@/lib/types';
import {
  DIALECT_LABEL,
  isDialectMode,
  type DialectMode,
} from '@/lib/workbench/dialects';
import { ENGINE_LABEL } from '@/lib/workbench/engineDialects';
import type { ModelSettings } from '@/lib/workbench/types';

/** What a model is for: its engine, a modelling dialect, or piStar for free modelling. */
export const modelKindLabel = (settings: ModelSettings): string =>
  settings.pistar
    ? settings.dialect
      ? DIALECT_LABEL[settings.dialect]
      : 'piStar'
    : ENGINE_LABEL[settings.engine];

/** An engine's or a dialect's name, as the workbench shows it. */
export const modeLabel = (
  mode: TransformEngine | DialectMode | undefined,
): string | undefined =>
  mode === undefined
    ? undefined
    : isDialectMode(mode)
      ? DIALECT_LABEL[mode]
      : isTransformEngine(mode)
        ? ENGINE_LABEL[mode]
        : undefined;
