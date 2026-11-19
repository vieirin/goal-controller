import { edgeEngine, type GodaVariant } from '@goal-controller/lib';
import {
  isTransformEngine,
  type ENGINE_LIST,
} from './workbench/engineDialects';

/**
 * An engine's id, the one spelling of engine names used across the UI and its
 * API: one of the registered engines' (lib/workbench/engineDialects.ts,
 * `ENGINE_LIST`), derived from the registry, never written out.
 */
export type TransformEngine = (typeof ENGINE_LIST)[number]['id'];

/** edgeV2: one PRISM module per task (EDGE reference layout) or a single ChangeManager module */
export type EdgeV2TaskLayout = 'taskModules' | 'changeManager';

/** GODA: the generator version it writes as (lib's GODA_VARIANTS, goal-controller#34 D10). */
export type { GodaVariant };

export { isTransformEngine };

/**
 * Engine from the `?mode=` URL parameter. Old links used `mode=prism` for the
 * Edge engine; this is the only place a legacy spelling is translated.
 */
export const normalizeEngineMode = (
  mode: string | null,
): TransformEngine | null => {
  if (mode === 'prism') {
    return edgeEngine.id;
  }
  return isTransformEngine(mode) ? mode : null;
};
