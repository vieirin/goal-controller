import {
  GODA_DEFAULT_VARIANT,
  GODA_VARIANTS,
  type GodaVariant,
} from '@goal-controller/lib';

/**
 * The one spelling of engine names used across the UI and its API:
 * 'edge' (legacy Edge), 'edgev2' (EdgeV2), 'sleec', 'mutrose' and 'goda'.
 */
export type TransformEngine = 'edge' | 'edgev2' | 'sleec' | 'mutrose' | 'goda';

/** edgeV2: one PRISM module per task (EDGE reference layout) or a single ChangeManager module */
export type EdgeV2TaskLayout = 'taskModules' | 'changeManager';
export const EDGE_V2_TASK_LAYOUTS: EdgeV2TaskLayout[] = [
  'taskModules',
  'changeManager',
];
export const isEdgeV2TaskLayout = (value: unknown): value is EdgeV2TaskLayout =>
  typeof value === 'string' &&
  (EDGE_V2_TASK_LAYOUTS as string[]).includes(value);

/** GODA: the generator version it writes as (lib's GODA_VARIANTS, goal-controller#34 D10). */
export { GODA_DEFAULT_VARIANT, type GodaVariant };
export const isGodaVariant = (value: unknown): value is GodaVariant =>
  typeof value === 'string' &&
  (GODA_VARIANTS as readonly string[]).includes(value);

const TRANSFORM_ENGINES: TransformEngine[] = [
  'edge',
  'edgev2',
  'sleec',
  'mutrose',
  'goda',
];

export const isTransformEngine = (
  value: string | null,
): value is TransformEngine =>
  value !== null && TRANSFORM_ENGINES.includes(value as TransformEngine);

/**
 * Engine from the `?mode=` URL parameter. Old links used `mode=prism` for the
 * Edge engine; this is the only place a legacy spelling is translated.
 */
export const normalizeEngineMode = (
  mode: string | null,
): TransformEngine | null => {
  if (mode === 'prism') {
    return 'edge';
  }
  return isTransformEngine(mode) ? mode : null;
};

export const isPrismEngine = (engine: TransformEngine): boolean =>
  engine === 'edge' || engine === 'edgev2';
