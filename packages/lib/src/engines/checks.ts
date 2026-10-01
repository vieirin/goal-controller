/** The kind of an RT id in the model, if it exists. */
export type NodeKind = 'goal' | 'task' | 'resource';

export type CheckContext = {
  /** RT id of the element being checked (dependsOn's "for node X") */
  self: string;
  /** the kind of another RT id in the model, if it exists */
  kindOf: (id: string) => NodeKind | undefined;
};

/**
 * What is wrong with a property's value, as an Edge engine's mapper would reject it
 * (null when fine). Gets the element's whole properties (the value being checked already
 * in place), so cross-property rules work: the bounds check reads both lowerBound and
 * upperBound regardless of which one is being checked.
 */
export type Check = (
  raw: Partial<Record<string, string>>,
  context: CheckContext,
) => string | null;
