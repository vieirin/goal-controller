/**
 * What a generation depends on: the model without diagram layout (positions,
 * sizes, save date), so dragging a node in the diagram does not count as a
 * change to the model; and without its embedded manifest (the top-level
 * `project` key, lib/project's EMBEDDED_KEY): its options count as options,
 * and they leave the model when its project gets a project.json.
 */
import { EMBEDDED_KEY } from '../project/embedded';

const LAYOUT_KEYS = new Set([
  'x',
  'y',
  'display',
  'saveDate',
  'diagram',
  'width',
  'height',
]);

const strip = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(strip);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !LAYOUT_KEYS.has(key))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, v]) => [key, strip(v)]),
    );
  }
  return value;
};

/**
 * What an analysis ran for: the engine and the model's content, not its
 * exact text. The worker serializes the mirror's model its own way
 * (`toPistar`, no indentation to match); the main thread's `model.text`
 * keeps the file's own formatting. Both give the same key for the same
 * model, so a result from one matches a freshness check against the other.
 */
export const analysisKey = (text: string, engine: string): string =>
  `${engine}\n${modelSignature(text) ?? text}`;

/** Stable text of the model's content (null when the JSON does not parse). */
export const modelSignature = (text: string): string | null => {
  try {
    const value = JSON.parse(text) as unknown;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const { [EMBEDDED_KEY]: _manifest, ...model } = value as Record<
        string,
        unknown
      >;
      return JSON.stringify(strip(model));
    }
    return JSON.stringify(strip(value));
  } catch {
    return null;
  }
};
