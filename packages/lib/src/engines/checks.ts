import type { CheckContext } from '@goal-controller/goal-language';

/**
 * A check's context (the goal language's): the element's RT id, the kinds
 * of the others, and the whole model when the caller has it.
 */
export type { CheckContext };

/**
 * What is wrong with a property's value, as an engine's mapper would reject it
 * (null when fine). Gets the element's whole properties (the value being checked already
 * in place), so cross-property rules work: the bounds check reads both lowerBound and
 * upperBound regardless of which one is being checked. A rule across elements reads
 * `context.elements`, and says nothing when the caller doesn't have the model.
 */
export type Check = (
  raw: Partial<Record<string, string>>,
  context: CheckContext,
) => string | null;
