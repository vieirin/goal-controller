/**
 * kaosprop's dialect (goal-controller#181): the `kaos` dialect, with the
 * quantities of Cailliau and van Lamsweerde's probabilistic obstacle
 * analysis (RE'12; REJ 18(2) 2013), as nfrprop adds its `initialLabel` to
 * `nfr`. Each is a `probability` (`0.8`, `.8`, `80%`), written as read:
 *
 * - a goal's `RSR`, its required satisfaction rate, and its `ESR`, its
 *   estimated one: read as the estimate of a leaf goal nothing obstructs;
 *   computed for every other goal (its EPS);
 * - a leaf obstacle's `Probability`, its estimated likelihood;
 * - a goal refinement's (on its hub) `Probability`, P(G | SG1..n), and an
 *   obstacle refinement's (on its hub) `Probability`, P(O | SO1..n): both
 *   default 1, a factor on that hub's AND product. This is Sabetzadeh et
 *   al.'s α (HASE'11, §III-B), a goal hub's partial-AND risk, exactly:
 *   their `P(G) = (1 − α) · Π P(Gi)` is this slot's `P(G|SG1..n) · Π
 *   P(Gi)` with `P(G|SG1..n) = 1 − α` (goal-controller#199, logged on
 *   #189). Their β, an obstacle's partial-OR risk, does not fold in: it
 *   multiplies `Π (1 − P(SOi))` across an obstacle's several refinements,
 *   not any one hub's own AND product, so it is `Beta`, its own key, below;
 * - an obstruction's `Probability`, P(¬G | O);
 * - a case-driven refinement's leg's `Probability`, P(CS), its case's.
 *
 * The plain `kaos` dialect keeps them as unknown keys, untouched.
 *
 * Its native file is KAOSTools' textual KAOS (`.kaos`, importers/kaos),
 * whose quantities are these keys: a `.kaos` file opens in this mode.
 */
import { defineDialect, links, property } from '@goal-controller/dialect';
import { kaos } from '../../dialects/kaos';
import { kaosNativeFile } from '../../importers/kaos/native';

const RSR = property.probability('RSR', {
  help: 'its required satisfaction rate: the probability it must be satisfied with (RE’12’s RDS)',
});
const ESR = property.probability('ESR', {
  help: 'its estimated satisfaction rate: read for a leaf goal nothing obstructs (default 1); computed for any other',
});
const probability = (help: string) =>
  property.probability('Probability', { help });
const HUB_PROBABILITY = (of: 'G' | 'O') =>
  probability(
    `P(${of} | S${of}1..n): how likely the sub-${of === 'G' ? 'goals' : 'obstacles'}, together, lead to the ${of === 'G' ? 'goal' : 'obstacle'} (default 1); HASE’11’s α (goal-controller#199) is 1 − this, on a goal hub`,
  );

export const kaosprop = defineDialect({
  ...kaos,
  id: 'kaosprop',
  name: 'KAOS obstacle probabilities',
  properties: {
    ...kaos.properties,
    'kaos.BehavioralGoal': [
      ...kaos.properties['kaos.BehavioralGoal'],
      RSR,
      ESR,
    ],
    'kaos.Softgoal': [...kaos.properties['kaos.Softgoal'], RSR, ESR],
    'kaos.RefinementLinkHub': [
      ...kaos.properties['kaos.RefinementLinkHub'],
      HUB_PROBABILITY('G'),
    ],
    'kaosObstacles.Obstacle': [
      ...kaos.properties['kaosObstacles.Obstacle'],
      probability(
        'its estimated probability (a leaf obstacle’s); a refined one’s is computed',
      ),
      property.probability('Beta', {
        help: 'HASE’11’s β (goal-controller#199): how likely it occurs despite none of its sub-obstacles having, read only when it has more than one refinement (an OR of them); default 0',
      }),
    ],
    'kaosObstacles.ObstacleRefinementLinkHub': [HUB_PROBABILITY('O')],
  },
  links: links({
    ...kaos.links,
    'kaos.RefinementLinkStart': [
      probability(
        'P(CS): the probability of this case, in a case-driven refinement',
      ),
    ],
    'kaosObstacles.ObstructionLink': [
      probability(
        'P(¬G | O): how likely the obstacle, occurring, violates the goal (default 1)',
      ),
    ],
  }),
  propertyLineOrder: [
    ...kaos.propertyLineOrder,
    'RSR',
    'ESR',
    'Probability',
    'Beta',
  ],
  nativeFiles: { kaos: kaosNativeFile },
});
