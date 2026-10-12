/**
 * MutRoSe on the rule layer (goal-controller#75): its goal model, world,
 * HDDL domain and configuration read as facts, and the rules that join them
 * (#59's checks).
 */
import GOAL_MODEL_RULES from '../../ruleFacts/goalModel.rules';
import { GOAL_MODEL_KINDS, readGoalModel } from '../../ruleFacts/goalModel';
import type { EngineRules } from '../../ruleFacts/engine';
import { mutrose } from '../definition';
import CONFIGURATION_RULES from './configuration.rules';
import {
  CONFIGURATION_KINDS,
  readConfiguration,
} from '../readers/configuration';
import HDDL_RULES from './hddl.rules';
import { HDDL_KINDS, readHddl } from './hddl';
import MODEL_RULES from './model.rules';
import {
  MUTROSE_MODEL_HOOKS,
  MUTROSE_MODEL_KINDS,
  readOtherModel,
} from './model';
import WORLD_RULES from './world.rules';
import { readWorld, WORLD_KINDS } from '../readers/world';

export const mutroseRules: EngineRules = {
  engine: 'mutrose',
  kinds: {
    ...GOAL_MODEL_KINDS,
    ...MUTROSE_MODEL_KINDS,
    ...WORLD_KINDS,
    ...HDDL_KINDS,
    ...CONFIGURATION_KINDS,
  },
  ruleFiles: [
    GOAL_MODEL_RULES,
    MODEL_RULES,
    WORLD_RULES,
    HDDL_RULES,
    CONFIGURATION_RULES,
  ],
  messages: {
    'hddl.unusedTask':
      'No goal-model task or method uses the HDDL task `{name}`',
    'mutrose.unboundParam':
      'No var_mapping of this task binds `{name}` to an HDDL parameter',
    'mutrose.paramType':
      'The HDDL parameter `{name}` doesn’t take this variable’s type (see type_mapping)',
    'mutrose.noInstances':
      '{name} has no instances in the world knowledge: this select finds nothing',
    'mutrose.iteratesNoInstances':
      '`{name}` iterates over a class with no instances in the world knowledge',
  },
  read: ({ model, otherModels = [], resources }) => [
    ...(model ? readGoalModel(model, mutrose, MUTROSE_MODEL_HOOKS) : []),
    ...otherModels.flatMap(({ path, view }) => readOtherModel(path, view)),
    ...resources.flatMap(({ kind, path, text }) =>
      kind === 'world'
        ? [readWorld(path, text)]
        : kind === 'hddl'
          ? // MutRoSe's domains use types they don't list (`?r - robot`)
            [readHddl(path, text, { typesByUse: true })]
          : kind === 'configuration'
            ? [readConfiguration(path, text)]
            : [],
    ),
  ],
};
