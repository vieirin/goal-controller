/**
 * GODA's named checks: what its goal model reader (`Controller.java`,
 * `GoalImpl.java`) requires of a model that a value type can't say.
 */
import { checks } from '../checks';

/** Whether a goal is the one generated from (`selected: true`, read only when exactly `true`). */
export const isSelected = (value: string | undefined): boolean =>
  value?.trim() === 'true';

export const godaCheckRegistry = checks({
  /**
   * One goal is selected: GODA generates from the actor that has it. A second
   * one is reported on itself; none, by the engine (no element to mark).
   */
  'goda.goal.selected': (raw, context) => {
    if (!isSelected(raw.selected) || !context.elements) return null;
    const other = Object.entries(context.elements).find(
      ([id, element]) =>
        id !== context.self &&
        element.kind === 'goal' &&
        isSelected(element.properties.selected),
    );
    return other
      ? `Only one goal is selected: ${other[0]} is selected too`
      : null;
  },
});

/** The names of GODA's checks: what a property's `check` may be. */
export type GodaCheckName = keyof typeof godaCheckRegistry;
