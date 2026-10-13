/**
 * MutRoSe on the definition pool (goal-controller#82): its four files
 * (the goal model, the world, the HDDL domain, the configuration), the
 * kinds they define, the checks across them and their messages.
 */
import { defineEngine } from '../../../pool';
import { configuration } from '../files/configuration';
import { goalModel, otherModel } from '../files/goalModel';
import { hddl } from '../files/hddl';
import { world } from '../files/world';
import { noInstances, unboundParam, unusedHddlTask } from './checks';
import { KINDS, LINKS, MESSAGES } from './vocabulary';

export const mutrose = defineEngine({
  files: [goalModel, otherModel, world, hddl, configuration],
  kinds: KINDS,
  checks: [unboundParam, unusedHddlTask, noInstances],
  messages: MESSAGES,
  links: LINKS,
});
