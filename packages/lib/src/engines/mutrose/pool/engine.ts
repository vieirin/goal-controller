/**
 * MutRoSe on the definition pool (goal-controller#82): its four files
 * (the goal model, the world, the HDDL domain, the configuration), the
 * kinds they define, the checks across them and their messages.
 */
import { defineEngine, type MessageArgs } from '../../../pool';
import { configuration } from '../files/configuration';
import { goalModel, otherModel, BASIC_TYPES } from '../files/goalModel';
import { hddl } from '../files/hddl';
import { world } from '../files/world';
import { noInstances, unboundParam, unusedHddlTask } from './checks';

/** The class a type names: `Room` for `Room` and `Sequence(Room)`; none for OCL's own. */
const classOfType = (type: string) => {
  const name = /^Sequence\((\w+)\)$/.exec(type)?.[1] ?? type;
  return BASIC_TYPES.has(name) ? null : name;
};
const typeOf = { kinds: ['world.class'], name: classOfType };

/** a new name, if it matches */
const matching = (pattern: RegExp) => (name: string) =>
  pattern.test(name) ? name : null;
/** an XML name: a letter or `_`, then letters, digits, `_`, `-`, `.` */
const xmlName = matching(/^[A-Za-z_][\w.-]*$/);
/** HDDL's names: letters, digits, `-`, `_` */
const hddlName = matching(/^[A-Za-z][\w-]*$/);
const hddl_ = { caseInsensitive: true, rename: hddlName };

/** ` (it has a, b)`: what there is instead */
const has = ({ candidates }: MessageArgs) =>
  candidates ? ` (it has ${candidates})` : '';

export const mutrose = defineEngine({
  files: [goalModel, otherModel, world, hddl, configuration],
  kinds: {
    // ids are the diagram's and the runtime annotation's: not renamed here
    'gm.goal': { label: 'Goal', rename: false },
    'gm.task': { label: 'Abstract task', rename: false },
    'gm.variable': {
      label: 'Variable',
      rename: matching(/^[A-Za-z][A-Za-z0-9_]*$/),
      typeOf,
    },
    'world.class': { label: 'World class', rename: xmlName },
    'world.attribute': {
      label: 'World attribute',
      scope: 'owner',
      rename: xmlName,
      typeOf,
    },
    'world.instance': { label: 'World instance', rename: xmlName },
    'hddl.type': { label: 'HDDL type', ...hddl_ },
    'hddl.predicate': { label: 'HDDL predicate', ...hddl_ },
    'hddl.function': { label: 'HDDL function', ...hddl_ },
    'hddl.task': { label: 'HDDL task', ...hddl_ },
    'hddl.method': { label: 'HDDL method', ...hddl_ },
    'hddl.action': { label: 'HDDL action', ...hddl_ },
    'hddl.param': {
      label: 'HDDL parameter',
      caseInsensitive: true,
      scope: 'owner',
      // a parameter keeps its `?`
      rename: (name) =>
        hddlName(name.replace(/^\?/, '')) && `?${name.replace(/^\?/, '')}`,
    },
    'mutrose.locationType': {
      label: 'Location type',
      // a JSON string: no quote or backslash
      rename: matching(/^[^"\\]+$/),
    },
  },
  checks: [unboundParam, unusedHddlTask, noInstances],
  messages: {
    'unknown-hddl-task': (args) =>
      `${args.name} is not a task of the HDDL domain${has(args)}`,
    'unknown-mapping-task': (args) =>
      `${args.name} is not a task of the goal model${has(args)}`,
    'unknown-mapping-variable':
      '{name} is not a variable the goal model declares',
    'unknown-mapping-type': (args) =>
      `${args.name} is not a type of the HDDL domain${has(args)}`,
    'unknown-mapping-class': (args) =>
      `${args.name} is not a class of the world knowledge${has(args)}`,
    'hddl-var-not-param': (args) =>
      `${args.name} is not a parameter of ${args.owner}${has(args)}`,
    'unbound-param': ({ name, task, hddlTask }) =>
      `${name} is bound to no parameter${hddlTask ? ` of ${hddlTask}` : ''}: the configuration's var_mapping for ${task} doesn't map it`,
    'unused-hddl-task':
      'No task of the goal model stands for {name}, and no method decomposes into it',
    'no-instances': ({ name, type, class: worldClass }) =>
      worldClass
        ? `${name} is a ${type}, and the world knowledge has no ${worldClass}: this forAll has nothing to iterate`
        : `${name} has no instances in the world knowledge: this select finds nothing`,
  },
});
