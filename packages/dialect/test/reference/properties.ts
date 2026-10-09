// Pinned from vn/rt-langium-notation @ b61def8: packages/rt-language/src/properties.ts
// (scripts/sync-reference.sh; do not edit)
/**
 * The property lines of the notation document: their keys, how each value is
 * read (an assertion, a list of goal ids, or a raw value the engine's checks
 * read), and what each property means.
 */
export const PROPERTY_MODES = {
  maintain: 'assertion',
  assertion: 'assertion',
  dependsOn: 'dependsOn',
  variables: 'value',
  utility: 'value',
  cost: 'value',
  maxRetries: 'value',
  type: 'value',
  root: 'value',
} as const;

export type RtPropertyKey = keyof typeof PROPERTY_MODES;

export const isPropertyKey = (key: string): key is RtPropertyKey =>
  Object.hasOwn(PROPERTY_MODES, key);

export const PROPERTY_HELP: Record<RtPropertyKey, string> = {
  maintain: 'the condition kept while a maintain goal is pursued',
  assertion: 'the condition under which the element may be pursued',
  dependsOn: 'the goals that must be achieved first (comma-separated ids)',
  variables: 'decision variables, `name:space` pairs separated by commas',
  utility: 'the utility reward of achieving it',
  cost: 'the cost reward of pursuing it',
  maxRetries: 'how many times it may be retried (a non-negative integer)',
  type: 'achieve (default) or maintain',
  root: 'marks the root goal',
};

/** A property line's text: `maintain battery > 20`. */
export const propertyLine = (key: RtPropertyKey, value: string): string =>
  value.trim() ? `${key} ${value.trim()}` : key;

/** A property line's key and value, if the line is one (indentation ignored). */
export const readPropertyLine = (
  line: string,
): { key: RtPropertyKey; value: string } | null => {
  const match = /^\s*([A-Za-z]+)(?:[ \t]+(.*?))?\s*$/.exec(line);
  return match && isPropertyKey(match[1]!)
    ? { key: match[1], value: match[2] ?? '' }
    : null;
};

/** The properties a resource declaration sets, by key. */
export const RESOURCE_KEYS = [
  'type',
  'lowerBound',
  'upperBound',
  'initialValue',
] as const;

export type RtResourceProperties = Partial<
  Record<(typeof RESOURCE_KEYS)[number], string>
>;

/**
 * A resource's declaration, `{int 0..100 = 80}` / `{bool = false}`, from its
 * properties (null without a type: there is nothing to declare).
 */
export const resourceDecl = (
  properties: RtResourceProperties,
): string | null => {
  const { type, lowerBound, upperBound, initialValue } = properties;
  if (!type) return null;
  const bounds =
    lowerBound !== undefined && upperBound !== undefined
      ? ` ${lowerBound}..${upperBound}`
      : '';
  const initial = initialValue !== undefined ? ` = ${initialValue}` : '';
  return `{${type}${bounds}${initial}}`;
};

/**
 * Splits an element line into its text and its resource declaration
 * (`R1: Battery {int 0..100 = 80}`), as the grammar's ResourceDecl reads it.
 */
export const readResourceLine = (
  line: string,
): { text: string; resource: RtResourceProperties | null } => {
  const match = /^(.*?)\s*\{([^}]*)\}\s*$/.exec(line);
  if (!match) return { text: line.trim(), resource: null };
  const decl =
    /^\s*([A-Za-z_]\w*)(?:\s+(-?\d+)\s*\.\.\s*(-?\d+))?(?:\s*=\s*(-?\d+|[A-Za-z_]\w*))?\s*$/.exec(
      match[2]!,
    );
  return {
    text: match[1]!.trim(),
    resource: decl
      ? {
          type: decl[1],
          lowerBound: decl[2],
          upperBound: decl[3],
          initialValue: decl[4],
        }
      : null,
  };
};
