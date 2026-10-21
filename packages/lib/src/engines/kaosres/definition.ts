/**
 * kaosres's dialect (goal-controller#191, D1): kaosprop's, with what makes a
 * resolution a countermeasure (Cailliau and van Lamsweerde, SEAMS'17, DOI
 * 10.1109/SEAMS.2017.5; Cailliau's thesis, 2017, ch. 5): on the resolution
 * link from the countermeasure goal to the obstacle it resolves,
 *
 * - `Cost`, a number: SEAMS'17's "Countermeasures come with a cost", one
 *   cost (§VI.B: "only single costs are considered here");
 * - `Form`, what applying it does to the model, as KAOSTools annotates a
 *   goal for an obstacle (since 2017-09, after SEAMS'17): `except` (the
 *   anchor keeps its goal and the countermeasure covers the obstacle),
 *   `provided` / `providedNot` (an extra conjunct on the resolving goal's
 *   antecedent), `relaxedTo` (an extra disjunct on its consequent),
 *   `replaces` (the resolving goal substitutes another);
 * - the form's payload: `Condition`, a formula (`provided`'s, `relaxedTo`'s),
 *   and `Replaces`, a goal (`replaces`'s); `except`'s is the `Anchor` the
 *   `kaos` dialect already has.
 *
 * The plain `kaos` dialect and kaosprop's keep these as unknown keys,
 * untouched. What applying a countermeasure does to the model is
 * ./transform.ts; decisions in packages/dialect/docs/frameworks.md, "KAOS
 * stress test, step 4 part A".
 */
import { defineDialect, links, property } from '@goal-controller/dialect';
import { kaosprop } from '../kaosprop/definition';

/** KAOSTools' annotations of a goal for an obstacle (`except [o] g`), as a resolution's `Form`. */
export const COUNTERMEASURE_FORMS = [
  'provided',
  'providedNot',
  'except',
  'relaxedTo',
  'replaces',
] as const;

export type CountermeasureForm = (typeof COUNTERMEASURE_FORMS)[number];

const GOALS = ['kaos.BehavioralGoal', 'kaos.Softgoal'] as const;

export const kaosres = defineDialect({
  ...kaosprop,
  id: 'kaosres',
  name: 'KAOS countermeasures',
  links: links({
    ...kaosprop.links,
    'kaosObstacles.ResolutionLink': [
      ...kaosprop.links['kaosObstacles.ResolutionLink'],
      property.number('Cost', {
        min: 0,
        help: 'what the countermeasure costs (SEAMS’17: a selection’s cost is the sum of its countermeasures’)',
      }),
      property.enum('Form', ['', ...COUNTERMEASURE_FORMS], {
        help: 'what applying it does: except (the anchor kept, this goal covers the obstacle), provided / providedNot (a conjunct on this goal’s antecedent), relaxedTo (a disjunct on its consequent), replaces (this goal substitutes another); unset: its ResolutionType’s',
      }),
      property.formula('Condition', 'ltl', {
        help: 'provided’s extra conjunct, providedNot’s negated one, relaxedTo’s extra disjunct',
      }),
      property.reference('Replaces', GOALS, {
        help: 'the goal this one substitutes (replaces), by its id',
      }),
    ],
  }),
});
