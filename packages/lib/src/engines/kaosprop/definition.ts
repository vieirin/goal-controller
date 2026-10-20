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
 * - an obstacle refinement's (on its hub) `Probability`, P(O | SO1..n);
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
    'kaosObstacles.Obstacle': [
      ...kaos.properties['kaosObstacles.Obstacle'],
      probability(
        'its estimated probability (a leaf obstacle’s); a refined one’s is computed',
      ),
    ],
    'kaosObstacles.ObstacleRefinementLinkHub': [
      probability(
        'P(O | SO1..n): how likely the sub-obstacles, together, lead to the obstacle (default 1)',
      ),
    ],
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
  propertyLineOrder: [...kaos.propertyLineOrder, 'RSR', 'ESR', 'Probability'],
  nativeFiles: { kaos: kaosNativeFile },
});
