/**
 * GODA's goal model: its goals and tasks, whose ids are scoped by their
 * goal (BSN's two `T1.2`, kept as `G3/T1.2` and `G4/T1.2`) and whose
 * notations name their children; and their contexts (`creationProperty`),
 * whose conditions declare their variables by using them (#58): a
 * variable is defined where it is first used, and every later use refers
 * to it.
 */
import * as z from 'zod/mini';
import { defineFile } from '../../../pool';
import {
  defines,
  goalModel as goalModelParser,
  langium,
  written,
} from '../pool/vocabulary';
import { goalServices } from '@goal-controller/goal-language';

const variable = defines('gm.variable', { firstUse: true });
const context = langium(goalServices(), {
  start: 'AssertionValue',
  annotate: {
    AssertVar: { variable: [variable] },
    AssertAssign: { variable: [variable] },
    // a comparison's sides: the names and ids it compares
    ExprVar: { name: [variable] },
    ExprRef: { id: [variable] },
  },
});

const properties = z.looseObject({
  creationProperty: z.optional(z.string().check(written(context))),
});

/** one element of the model (the pool reads them one by one) */
const element = z.union([
  z.looseObject({
    kind: z.literal('goal'),
    id: z.string().check(defines('gm.goal')),
    properties,
  }),
  z.looseObject({
    kind: z.literal('task'),
    id: z.string().check(defines('gm.task')),
    properties,
  }),
  z.looseObject({ properties }),
]);

export const goalModel = defineFile({
  kind: 'model',
  // a bracket's id that is no child: the goal language says it (notAChild)
  parser: goalModelParser({
    children: { kind: 'gm.child', unresolved: false },
  }),
  schema: element,
});
