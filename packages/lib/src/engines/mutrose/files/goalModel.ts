/**
 * MutRoSe's goal model: its goals and abstract tasks, the variables
 * Controls and queries declare, and what refers to the other files. A
 * task's first word is the HDDL task it stands for; a type is a world
 * class; `name.attr` is an attribute of name's class. Its property values
 * are MutRoSe's language (../language/mutrose.langium), each read with the
 * rule its field is written in.
 */
import * as z from 'zod/mini';
import {
  defineFile,
  goalModel as goalModelParser,
  type Annotated,
  type NamePart,
  type Occurrence,
} from '../../../pool';
import {
  defines,
  langium,
  leadsTo,
  refersTo,
  scope,
  unresolvedAs,
  written,
} from '../pool/vocabulary';
import type { OclCall, OclVariable } from '../language/generated/ast';
import { BASIC_TYPES, mutroseServices } from '../language';
import { variableType } from './variableType';

/** The world: no variable */
const WORLD = 'world_db';
/** Words OCL reads itself, written as a name: no variable */
const KEYWORDS = new Set(['implies', 'null', 'self']);

const services = mutroseServices();

/** a task's first word: the HDDL task it stands for */
export const firstWord: NamePart = (text) => {
  const word = /\S+/.exec(text);
  return word && { text: word[0], offset: word.index };
};

/** a world class, unless it's OCL's own (MutRoSe's property checks say an unknown one) */
const worldClass = refersTo('world.class', 'global', {
  name: (text) => (BASIC_TYPES.has(text) ? null : { text, offset: 0 }),
  unresolved: false,
});

/** a variable of the element's, or the model's */
const variable = refersTo('gm.variable', scope.owner('^id'));

/** Controls: the model's variables, declared by their first declaration */
const declarations = langium(services, {
  start: 'OclVariables',
  annotate: {
    OclVariable: {
      name: [
        defines('gm.variable', {
          firstUse: true,
          type: (occurrences: readonly Occurrence[]) => {
            const type = (occurrences[0]?.parent as OclVariable | undefined)
              ?.type;
            return (
              type && type.name + (type.element ? `(${type.element})` : '')
            );
          },
        }),
      ],
    },
    ...variableType(worldClass),
  },
});

/** Monitors, Params, Location: variables used */
const uses = langium(services, {
  start: 'OclVariables',
  annotate: { OclVariable: { name: [variable] } },
});

/** a path's attributes: each of its predecessor's type's class */
const attribute = refersTo(
  'world.attribute',
  scope.leadsTo('type', scope.previous('head')),
);

/** a query or a condition: its paths, and the variables its operations introduce */
const expression = langium(services, {
  start: 'OclExpression',
  annotate: {
    OclPath: {
      head: ({ head, attributes }) =>
        head === WORLD || (!attributes.length && KEYWORDS.has(head))
          ? []
          : [variable],
      attributes: ({ head }) => (head === WORLD ? [] : [attribute]),
    },
    OclCall: {
      // a query's variable is its own, looked up in the element first;
      // forAll iterates with one of the model's
      variable: ({ operation, type }): readonly Annotated[] =>
        operation === 'select' && type
          ? [
              defines('gm.variable', {
                owner: '^id',
                type: (occurrences: readonly Occurrence[]) =>
                  (occurrences[0]?.parent as OclCall | undefined)?.type?.name,
              }),
            ]
          : operation === 'forAll'
            ? [variable]
            : [],
    },
    OclType: { name: [worldClass] },
  },
});

/** `assertion condition "…"`: the OCL between the quotes */
const condition: NamePart = (text) => {
  const match = /^(\s*assertion\s+condition\s+")([^"]*)"/i.exec(text);
  return match && { text: match[2]!, offset: match[1]!.length };
};

const properties = z.looseObject({
  Controls: z.optional(z.string().check(written(declarations))),
  Monitors: z.optional(z.string().check(written(uses))),
  Params: z.optional(z.string().check(written(uses))),
  Location: z.optional(z.string().check(written(uses))),
  QueriedProperty: z.optional(z.string().check(written(expression))),
  AchieveCondition: z.optional(z.string().check(written(expression))),
  CreationCondition: z.optional(
    z.string().check(written(expression, { part: condition })),
  ),
});

/** one element of the model (the pool reads them one by one) */
const element = z.union([
  z.looseObject({
    kind: z.literal('task'),
    // ids are the diagram's and the runtime annotation's (kinds: not renamed)
    id: z.string().check(defines('gm.task')),
    name: z.string().check(
      refersTo('hddl.task', 'global', {
        name: firstWord,
        ...unresolvedAs('unknown-hddl-task'),
      }),
      leadsTo('hddlTask'),
    ),
    properties,
  }),
  z.looseObject({
    kind: z.literal('goal'),
    id: z.string().check(defines('gm.goal')),
    properties,
  }),
  z.looseObject({}),
]);

export const goalModel = defineFile({
  kind: 'model',
  parser: goalModelParser(),
  schema: element,
});

/**
 * The project's other goal models (a domain may be shared by several):
 * a document of this kind is read by the checks, not indexed.
 */
export const OTHER_MODEL = 'otherModel';

export const otherModel = defineFile({
  kind: OTHER_MODEL,
  parser: goalModelParser(),
  schema: z.looseObject({}),
});
