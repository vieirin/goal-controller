/**
 * GODA's named checks: what its goal model reader (`Controller.java`,
 * `GoalImpl.java`) requires of a model that a value type can't say.
 */
import { readProperties } from '@goal-controller/goal-language';
import { checkOn, checks } from '../checks';
import { goda } from './definition';

/**
 * Whether another goal of the model is the one generated from: its stored
 * `selected` as GODA's dialect reads it (the mapper's `props.selected`),
 * `true`.
 */
const isSelected = (selected: string | undefined): boolean =>
  selected !== undefined &&
  readProperties(goda, { element: 'goal' }, { selected }).values.selected ===
    'true';

/**
 * The names of GODA's checks: what a property's `check` may be
 * (listed, not derived from the registry: the checks read the dialect's
 * values, typed by the definition, which names them).
 */
export type GodaCheckName = 'goda.goal.selected';

export const godaCheckRegistry = checks<GodaCheckName>({
  /**
   * One goal is selected: GODA generates from the actor that has it. A second
   * one is reported on itself; none, by the engine (no element to mark).
   */
  'goda.goal.selected': checkOn(goda, { element: 'goal' })(
    ({ props }, context) => {
      if (props.selected !== 'true' || !context.elements) return null;
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
  ),
});
