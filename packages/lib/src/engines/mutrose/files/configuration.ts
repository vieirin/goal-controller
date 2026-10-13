/**
 * MutRoSe's configuration (`configuration/*.json`): what each mapping
 * names in the other three files. A `location_types` entry defines a
 * location type and is the world class it names; `var_mapping` binds a
 * goal-model task's variables to the parameters of the HDDL task that task
 * stands for; `semantic_mapping` ties the world's attributes to the
 * domain's predicates. Keys MutRoSe reads and the pool doesn't (`output`)
 * are let through.
 */
import * as z from 'zod/mini';
import { defineFile, json, scope } from '../../../pool';
import { defines, refersTo, unresolvedAs, written } from '../pool/vocabulary';
import { typeWritten } from './variableType';

/** the decomposer's robots: no class of the world's */
const ROBOTS = new Set(['robot', 'robotteam']);

/** a world class: an unknown one is an error */
const worldClass = refersTo('world.class', undefined, {
  name: (text) => (ROBOTS.has(text) ? null : { text, offset: 0 }),
  ...unresolvedAs('unknown-mapping-class'),
});

/** `Room`, `Sequence(Room)`: the class it names */
const toClass = z.string().check(written(typeWritten(worldClass)));
const toType = z
  .string()
  .check(
    refersTo('hddl.type', undefined, unresolvedAs('unknown-mapping-type')),
  );

/** a semantic mapping's predicate (or numeric function, `staphylococcus`) and its sorts */
const predicate = z.looseObject({
  pred: z.optional(
    z.string().check(refersTo(['hddl.predicate', 'hddl.function'])),
  ),
  arg_sorts: z.optional(z.array(toType)),
});

/** what the world says, not a robot's attribute (`robots_db`) */
const inWorld = z.optional(z.literal('world_db'));

export const configuration = defineFile({
  kind: 'configuration',
  parser: json,
  schema: z.looseObject({
    location_types: z.optional(
      z.array(
        z
          .string()
          .check(
            defines('mutrose.locationType'),
            refersTo(
              'world.class',
              undefined,
              unresolvedAs('unknown-mapping-class'),
            ),
          ),
      ),
    ),
    type_mapping: z.optional(
      z.array(z.looseObject({ hddl_type: toType, ocl_type: toClass })),
    ),
    var_mapping: z.optional(
      z.array(
        z.looseObject({
          task_id: z
            .string()
            .check(
              refersTo(
                'gm.task',
                undefined,
                unresolvedAs('unknown-mapping-task'),
              ),
            ),
          map: z.array(
            z.looseObject({
              gm_var: z
                .string()
                .check(
                  refersTo(
                    'gm.variable',
                    undefined,
                    unresolvedAs('unknown-mapping-variable'),
                  ),
                ),
              // the parameters of the HDDL task the model's task stands for
              hddl_var: z
                .string()
                .check(
                  refersTo(
                    'hddl.param',
                    scope.through('standsFor', '../task_id'),
                    unresolvedAs('hddl-var-not-param'),
                  ),
                ),
            }),
          ),
        }),
      ),
    ),
    semantic_mapping: z.optional(
      z.array(
        z.union([
          // a world class's attribute
          z.looseObject({
            belongs_to: inWorld,
            type: z.literal('attribute'),
            relates_to: toClass,
            name: z
              .string()
              .check(refersTo('world.attribute', scope.owner('relates_to'))),
            map: z.optional(predicate),
          }),
          // a world class's
          z.looseObject({
            belongs_to: inWorld,
            relates_to: toClass,
            map: z.optional(predicate),
          }),
          // a robot's
          z.looseObject({ map: z.optional(predicate) }),
        ]),
      ),
    ),
  }),
});
