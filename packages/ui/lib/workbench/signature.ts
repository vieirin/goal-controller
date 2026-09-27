/**
 * What a generation depends on: the model without diagram layout (positions,
 * sizes, save date), so dragging a node in the diagram does not count as a
 * change to the model.
 */
const LAYOUT_KEYS = new Set(['x', 'y', 'display', 'saveDate', 'diagram', 'width', 'height']);

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

/** Stable text of the model's content (null when the JSON does not parse). */
export const modelSignature = (text: string): string | null => {
  try {
    return JSON.stringify(strip(JSON.parse(text)));
  } catch {
    return null;
  }
};
