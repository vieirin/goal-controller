/** MutRoSe's project resources, parsed: its world, its HDDL domain and its configuration. */
import { projectResourceParsers } from '../../projectResources';
import { mutrose } from '../definition';
import { parseConfiguration, type MutroseConfiguration } from './configuration';
import { parseHddl, type HddlDomain } from './hddl';
import { parseWorld, type WorldKnowledge } from './world';

export * from './configuration';
export * from './hddl';
export * from './world';

export const mutroseProjectResources = projectResourceParsers(mutrose)({
  world: parseWorld,
  hddl: parseHddl,
  configuration: parseConfiguration,
});

/** What MutRoSe's checks and template read of its parsed resources (each may be missing). */
export type MutroseResourceData = {
  world?: WorldKnowledge;
  hddl?: HddlDomain;
  configuration?: MutroseConfiguration;
};
