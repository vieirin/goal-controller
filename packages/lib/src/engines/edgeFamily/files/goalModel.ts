/**
 * The Edge engines' goal model: its goals, tasks and resources (a resource
 * is the type it declares, `int`), and their conditions, whose names are
 * variables of variables.json or elements. An unknown name is the goal
 * language's to report, not the pool's.
 */
import * as z from 'zod/mini';
import {
  defineFile,
  defines,
  goalModel as goalModelParser,
  langium,
  refersTo,
  written,
  type Occurrence,
} from '../../../pool';
import { goalServices } from '@goal-controller/goal-language';

/**
 * what a resource declares it is (its `type`: `bool` or `int`), as
 * conditions read it; a goal's `type` (`maintain`) is none
 */
const declaredType = (occurrences: readonly Occurrence[]) => {
  const type = (
    occurrences[0]?.parent as { properties?: Record<string, string> }
  )?.properties?.type;
  return type === 'bool' ? 'boolean' : type === 'int' ? 'int' : undefined;
};

const name = refersTo(
  ['edge.variable', 'gm.resource', 'gm.goal', 'gm.task'],
  undefined,
  { unresolved: false },
);
const condition = z.optional(
  z.string().check(
    written(
      langium(goalServices(), {
        start: 'AssertionValue',
        annotate: {
          AssertVar: { variable: [name] },
          AssertAssign: { variable: [name] },
          AssertCompare: { variable: [name] },
        },
      }),
    ),
  ),
);

const element = (kind: 'goal' | 'task' | 'resource') =>
  z.looseObject({
    kind: z.literal(kind),
    id: z.string().check(defines(`gm.${kind}`, { type: declaredType })),
    properties: z.looseObject({ maintain: condition, assertion: condition }),
  });

export const goalModel = defineFile({
  kind: 'model',
  parser: goalModelParser,
  schema: z.union([
    element('goal'),
    element('task'),
    element('resource'),
    z.looseObject({}),
  ]),
});
