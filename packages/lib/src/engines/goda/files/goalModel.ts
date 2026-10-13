/**
 * GODA's goal model: its goals' and tasks' contexts (`creationProperty`),
 * whose conditions declare their variables by using them (#58): a
 * variable is defined where it is first used, and every later use refers
 * to it. Its ids aren't declared: GODA scopes them by their goal (BSN's
 * two `T1.2`), which the pool's goal model doesn't read yet.
 */
import * as z from 'zod/mini';
import {
  defineFile,
  defines,
  goalModel as goalModelParser,
  langium,
  written,
} from '../../../pool';
import { goalServices } from '@goal-controller/goal-language';

const variable = defines('gm.variable', { firstUse: true });
const context = langium(goalServices(), {
  start: 'AssertionValue',
  annotate: {
    AssertVar: { variable: [variable] },
    AssertAssign: { variable: [variable] },
    AssertCompare: { variable: [variable] },
  },
});

export const goalModel = defineFile({
  kind: 'model',
  parser: goalModelParser,
  schema: z.looseObject({
    properties: z.looseObject({
      creationProperty: z.optional(z.string().check(written(context))),
    }),
  }),
});
