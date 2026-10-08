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
