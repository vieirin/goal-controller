import type { GodaVariant } from '@goal-controller/lib';

/**
 * The one spelling of engine names used across the UI and its API:
 * 'edge' (legacy Edge), 'edgev2' (EdgeV2), 'sleec', 'mutrose', 'goda' and
 * 'grl' (an analysis engine: it evaluates, it generates no file),
 * 'istardt' (iStar-DT: DT-Golog), 'tropos4as' (an analysis engine: the
 * goal lifecycle of AAMAS 2009 over a scenario) and 'cgm' (contextual goal
 * models, REJ 2010: contexts at the variation points).
 */
export type TransformEngine =
  | 'edge'
  | 'edgev2'
  | 'sleec'
  | 'mutrose'
  | 'goda'
  | 'grl'
  | 'istardt'
  | 'tropos4as'
  | 'cgm';

/** edgeV2: one PRISM module per task (EDGE reference layout) or a single ChangeManager module */
export type EdgeV2TaskLayout = 'taskModules' | 'changeManager';

/** GODA: the generator version it writes as (lib's GODA_VARIANTS, goal-controller#34 D10). */
export type { GodaVariant };

const TRANSFORM_ENGINES: TransformEngine[] = [
  'edge',
  'edgev2',
  'sleec',
  'mutrose',
  'goda',
  'grl',
  'istardt',
  'tropos4as',
  'cgm',
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
