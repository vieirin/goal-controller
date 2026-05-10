/**
 * Normalize degradation retry counts from the model (numbers or numeric strings from JSON).
 */
export const coercePositiveIntRetry = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.trunc(value);
    return n > 0 ? n : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = parseInt(value, 10);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return null;
};
