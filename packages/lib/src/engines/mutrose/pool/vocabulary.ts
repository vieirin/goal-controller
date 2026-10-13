/**
 * MutRoSe's vocabulary on the definition pool: the kinds its files define
 * and the problems its checks find, each named once. Its files and checks
 * annotate and report with what `annotationsFor` types by them, so a kind
 * or a check's name that isn't one of these doesn't compile.
 */
import {
  annotationsFor,
  type KindDeclaration,
  type Message,
  type MessageArgs,
} from '../../../pool';
import { classOfType } from '../language';

const typeOf = { kinds: ['world.class'], name: classOfType } as const;

/** a new name, if it matches */
const matching = (pattern: RegExp) => (name: string) =>
  pattern.test(name) ? name : null;
/** an XML name: a letter or `_`, then letters, digits, `_`, `-`, `.` */
const xmlName = matching(/^[A-Za-z_][\w.-]*$/);
/** HDDL's names: letters, digits, `-`, `_` */
const hddlName = matching(/^[A-Za-z][\w-]*$/);
const hddl = { caseInsensitive: true, rename: hddlName } as const;

export const KINDS = {
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
  'hddl.type': { label: 'HDDL type', ...hddl },
  'hddl.predicate': { label: 'HDDL predicate', ...hddl },
  'hddl.function': { label: 'HDDL function', ...hddl },
  'hddl.task': { label: 'HDDL task', ...hddl },
  'hddl.method': { label: 'HDDL method', ...hddl },
  'hddl.action': { label: 'HDDL action', ...hddl },
  'hddl.param': {
    label: 'HDDL parameter',
    caseInsensitive: true,
    scope: 'owner',
    // a parameter keeps its `?`
    rename: (name: string) =>
      hddlName(name.replace(/^\?/, '')) && `?${name.replace(/^\?/, '')}`,
  },
  'mutrose.locationType': {
    label: 'Location type',
    // a JSON string: no quote or backslash
    rename: matching(/^[^"\\]+$/),
  },
} as const satisfies Record<string, KindDeclaration>;

/** ` (it has a, b)`: what there is instead */
const has = ({ candidates }: MessageArgs) =>
  candidates ? ` (it has ${candidates})` : '';

export const MESSAGES = {
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
} as const satisfies Record<string, Message>;

/** MutRoSe's kinds */
export type MutroseKind = keyof typeof KINDS;
/** MutRoSe's checks: what its problems are called */
export type MutroseCheck = keyof typeof MESSAGES;

export const { defines, refersTo, link, written, langium } = annotationsFor(
  KINDS,
  MESSAGES,
);

/** A reference that resolves to nothing is an error of this check's. */
export const unresolvedAs = (check: MutroseCheck) => ({
  unresolved: { severity: 'error', message: check } as const,
});
