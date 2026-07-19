export type TransformEngine = 'edge' | 'edgev2' | 'sleec';

const TRANSFORM_ENGINES: TransformEngine[] = ['edge', 'edgev2', 'sleec'];

export const isTransformEngine = (value: string | null): value is TransformEngine =>
  value !== null && TRANSFORM_ENGINES.includes(value as TransformEngine);

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
