/**
 * The one spelling of engine names used across the UI and its API:
 * 'edge' (legacy Edge), 'edgev2' (EdgeV2), 'edgelangium' (EdgeV2 read by the
 * Langium RT grammar, with the notation view) and 'sleec'.
 */
export type TransformEngine = 'edge' | 'edgev2' | 'edgelangium' | 'sleec';

export const ENGINE_LABEL: Record<TransformEngine, string> = {
  edgev2: 'EdgeV2',
  edgelangium: 'EdgeLangium',
  edge: 'Edge',
  sleec: 'SLEEC',
};

/** edgeV2: one PRISM module per task (EDGE reference layout) or a single ChangeManager module */
export type EdgeV2TaskLayout = 'taskModules' | 'changeManager';
export const EDGE_V2_TASK_LAYOUTS: EdgeV2TaskLayout[] = [
  'taskModules',
  'changeManager',
];
export const isEdgeV2TaskLayout = (value: unknown): value is EdgeV2TaskLayout =>
  typeof value === 'string' &&
  (EDGE_V2_TASK_LAYOUTS as string[]).includes(value);

const TRANSFORM_ENGINES: TransformEngine[] = [
  'edge',
  'edgev2',
  'edgelangium',
  'sleec',
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

/**
 * Engines with EdgeV2's semantics, PRISM templates and generation options;
 * EdgeLangium only reads the RT notation with another parser.
 */
export const isEdgeV2Engine = (
  engine: TransformEngine,
): engine is 'edgev2' | 'edgelangium' =>
  engine === 'edgev2' || engine === 'edgelangium';

export const isPrismEngine = (engine: TransformEngine): boolean =>
  engine === 'edge' || isEdgeV2Engine(engine);
