/** Matches strings that are a plain integer with no decimal point or trailing characters. */
const STRICT_INT_RE = /^-?\d+$/;

/**
 * Parse a string as a strict integer: rejects decimals ("1.5"), partial-numeric
 * strings ("10abc"), and empty/whitespace-only strings.
 * Returns NaN for any rejected input so callers can treat it like a failed parse.
 */
export const parseStrictInt = (s: string): number => {
  if (!STRICT_INT_RE.test(s.trim())) return NaN;
  return Number(s.trim());
};

/**
 * Normalize degradation retry counts from the model (numbers or numeric strings from JSON).
 * Rejects non-integer numbers (e.g. 1.5) and partial-numeric strings (e.g. "10abc", "1.5").
 */
export const coercePositiveIntRetry = (value: unknown): number | null => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
    return value > 0 ? value : null;
  }
  if (typeof value === 'string') {
    const n = parseStrictInt(value);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return null;
};
