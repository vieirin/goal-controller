/**
 * kaosexpert's dialect (goal-controller#190, D1): kaosprop's, with the
 * quantities of Cailliau and van Lamsweerde's knowledge-uncertainty
 * analysis (RE'15, DOI 10.1109/RE.2015.7320413):
 *
 * - a leaf obstacle's `Probability` is a `distribution`: a point estimate
 *   (`2.7%`, kaosprop's, the degenerate case), a named distribution
 *   (`pert[1%, 2%, 5%]`, `beta[2, 98]`), or quantiles (`(2.4%, 2.7%, 3%)`);
 * - keyed by expert (D2): `Probability[e1]`, one estimate per expert the
 *   `expert` project resource declares, which Cooke's model combines;
 * - a domain property's `Probability` is how likely it holds, a
 *   distribution too (RE'15's domain hypotheses, `0.98` in §VI.B; default
 *   1, as kaosprop reads one).
 *
 * Its project resources: the experts (`experts.json`, with the quantile
 * levels `@experts.quantiles`) and the calibration variables
 * (`calibrations.json`), ./resources.ts. Every other key is kaosprop's, as
 * written, so a file runs under both: a model with point estimates only
 * gives kaosprop's numbers, without uncertainty. `.kaos` is the native file
 * of both (the same definition): its reader says which mode a file opens in.
 */
import { defineDialect, property } from '@goal-controller/dialect';
import { kaos } from '../../dialects/kaos';
import { kaosprop } from '../kaosprop/definition';

const estimate = (help: string, keyed?: 'expert') =>
  property.distribution('Probability', {
    point: true,
    help,
    ...(keyed && { keyed }),
  });

export const kaosexpert = defineDialect({
  ...kaosprop,
  id: 'kaosexpert',
  name: 'KAOS expert estimates and uncertainty',
  properties: {
    ...kaosprop.properties,
    'kaosObstacles.Obstacle': [
      ...kaos.properties['kaosObstacles.Obstacle'],
      estimate(
        'a leaf obstacle’s estimated probability: a value (2.7%), a distribution (pert[1%, 2%, 5%], beta[2, 98]) or quantiles ((2.4%, 2.7%, 3%)); per expert, Probability[e1], which Cooke’s model combines',
        'expert',
      ),
    ],
    'kaos.DomainProperty': [
      ...kaos.properties['kaos.DomainProperty'],
      estimate(
        'how likely the domain property holds (a domain hypothesis’s, RE’15): a value or a distribution; default 1',
      ),
    ],
  },
  projectResources: {
    expert: {
      label: 'Experts',
      format: 'json',
      role: 'experts',
      path: 'experts.json',
      accept: ['.json'],
      help: 'the experts whose estimates (Probability[e1]) are combined, and the quantile levels their estimates give ((.1, .5, .9))',
    },
    calibration: {
      label: 'Calibration variables',
      format: 'json',
      role: 'calibration',
      path: 'calibrations.json',
      accept: ['.json'],
      help: 'quantities whose value is known, each with the experts’ estimates of it: what Cooke’s model weighs the experts by',
    },
  },
});
