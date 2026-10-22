/**
 * kaosexpert's dialect (goal-controller#190, D1): kaosprop's, with the
 * quantities of Cailliau and van Lamsweerde's knowledge-uncertainty
 * analysis (RE'15, DOI 10.1109/RE.2015.7320413), and (goal-controller#199)
 * Sabetzadeh et al.'s technology qualification (HASE'11), which shares its
 * Monte Carlo back-end without any expert:
 *
 * - a leaf obstacle's `Probability` is a `distribution`: a point estimate
 *   (`2.7%`, kaosprop's, the degenerate case), a named distribution
 *   (`pert[1%, 2%, 5%]`, `triangular[.82548, .90, .9863]`), or quantiles
 *   (`(2.4%, 2.7%, 3%)`);
 * - keyed by expert (D2): `Probability[e1]`, one estimate per expert the
 *   `expert` project resource declares, which Cooke's model combines; HASE'11
 *   never keys one (no expert declared: every estimate is read plain);
 * - a domain property's `Probability` is how likely it holds, a
 *   distribution too (RE'15's domain hypotheses, `0.98` in §VI.B; default
 *   1, as kaosprop reads one);
 * - a leaf goal's `ESR` (its estimate, nothing obstructs it) is a
 *   distribution too: HASE'11's P(G), a leaf goal's elicited probability of
 *   satisfaction (triangular, with 5 % tails, §III-B2);
 * - an obstacle's `Beta` (kaosprop's, folded in only when it does not
 *   multiply a hub's own product, ./propagation.ts) is a distribution too,
 *   for the same reason as `Probability`.
 *
 * Its project resources: the experts (`experts.json`, with the quantile
 * levels `@experts.quantiles`) and the calibration variables
 * (`calibrations.json`), ./resources.ts; HASE'11's evidence items
 * (`evidence.json`), linked to a leaf goal or obstacle by its `Evidence`
 * key (a list of their ids), traceability with no numeric effect (the
 * elicited `Probability`/`ESR` is what the evidence supports, not computed
 * from it). Every other key is kaosprop's, as written, so a file runs under
 * both: a model with point estimates only gives kaosprop's numbers, without
 * uncertainty. `.kaos` is the native file of both (the same definition):
 * its reader says which mode a file opens in.
 */
import {
  defineDialect,
  property,
  type ResourceTarget,
} from '@goal-controller/dialect';
import { kaos } from '../../dialects/kaos';
import { kaosprop } from '../kaosprop/definition';

const estimate = <const K extends 'Probability' | 'ESR' | 'Beta'>(
  key: K,
  help: string,
  keyed?: ResourceTarget<'expert'>,
) =>
  property.distribution(key, {
    point: true,
    help,
    ...(keyed && { keyed }),
  });

const evidenceList = (help: string) => property.nameList('Evidence', { help });

export const kaosexpert = defineDialect({
  ...kaosprop,
  id: 'kaosexpert',
  name: 'KAOS expert estimates and uncertainty',
  properties: {
    ...kaosprop.properties,
    'kaos.BehavioralGoal': [
      ...kaosprop.properties['kaos.BehavioralGoal'].filter(
        (p) => p.key !== 'ESR',
      ),
      estimate(
        'ESR',
        'its estimated satisfaction rate (a leaf goal’s, nothing obstructs it): a value, a distribution (triangular[.82548, .90, .9863]) or quantiles; default 1 (goal-controller#199, HASE’11’s P(G))',
      ),
      evidenceList(
        'the evidence items (evidence.json) its ESR is based on, by id',
      ),
    ],
    'kaos.Softgoal': [
      ...kaosprop.properties['kaos.Softgoal'].filter((p) => p.key !== 'ESR'),
      estimate(
        'ESR',
        'its estimated satisfaction rate (a leaf goal’s, nothing obstructs it): a value, a distribution (triangular[.82548, .90, .9863]) or quantiles; default 1 (goal-controller#199, HASE’11’s P(G))',
      ),
      evidenceList(
        'the evidence items (evidence.json) its ESR is based on, by id',
      ),
    ],
    'kaosObstacles.Obstacle': [
      ...kaos.properties['kaosObstacles.Obstacle'],
      estimate(
        'Probability',
        'a leaf obstacle’s estimated probability: a value (2.7%), a distribution (pert[1%, 2%, 5%], beta[2, 98]) or quantiles ((2.4%, 2.7%, 3%)); per expert, Probability[e1], which Cooke’s model combines',
        { resource: 'expert' },
      ),
      estimate(
        'Beta',
        'HASE’11’s β (goal-controller#199): how likely it occurs despite none of its sub-obstacles having, read only when it has more than one refinement; a value or a distribution; default 0',
      ),
      evidenceList(
        'the evidence items (evidence.json) its Probability is based on, by id',
      ),
    ],
    'kaos.DomainProperty': [
      ...kaos.properties['kaos.DomainProperty'],
      estimate(
        'Probability',
        'how likely the domain property holds (a domain hypothesis’s, RE’15): a value or a distribution; default 1',
      ),
    ],
  },
  propertyLineOrder: [...kaosprop.propertyLineOrder, 'Evidence'],
  projectResources: {
    expert: {
      label: 'Experts',
      format: 'json',
      role: 'experts',
      path: 'experts.json',
      accept: ['.json'],
      entries: true,
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
    evidence: {
      label: 'Evidence',
      format: 'json',
      role: 'evidence',
      path: 'evidence.json',
      accept: ['.json'],
      help: 'the evidence items a leaf goal’s ESR or a leaf obstacle’s Probability is based on (HASE’11, goal-controller#199), by id, in Evidence',
    },
  },
});
