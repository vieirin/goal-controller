/**
 * The Edge engines' goal model: its goals, tasks and resources (a resource
 * is the type it declares, `int`), and their conditions, whose names are
 * variables of variables.json or elements. An unknown name is the goal
 * language's to report, not the pool's.
 */
import { goalServices } from '@goal-controller/goal-language';
import * as z from 'zod/mini';
import {
  defineFile,
  goalModel as goalModelParser,
  type Occurrence,
} from '../../../pool';
import { assertionType } from '../../assertionUses';
import { defines, langium, refersTo, written } from '../pool/vocabulary';

/** what a resource declares it is: its `type`, `bool` or `int` */
const declaredType = (occurrences: readonly Occurrence[]) =>
  assertionType(
    (occurrences[0]?.parent as { properties?: Record<string, string> })
      ?.properties?.type,
  );

const name = refersTo(
  ['edge.variable', 'gm.resource', 'gm.goal', 'gm.task'],
  'global',
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
    id: z
      .string()
      .check(
        defines(
          `gm.${kind}`,
          kind === 'resource' ? { type: declaredType } : {},
        ),
      ),
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
