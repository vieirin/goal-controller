/**
 * A toy engine on the pool's protocol (#82): shelves in a JSON file, things
 * in a Langium model, each referring to the other. The whole declaration
 * (its own checks are toy.test.ts's).
 */
import * as z from 'zod/mini';
import {
  declarePool,
  defineFile,
  defines,
  json,
  langium,
  refersTo,
  scope,
} from '../../../src/pool';
import { toyLanguage } from './language';

const shelves = defineFile({
  kind: 'shelves',
  parser: json,
  schema: z.strictObject({
    shelves: z.array(
      z.strictObject({
        name: z.string().check(defines('toy.shelf')),
        holds: z.array(
          z.strictObject({
            thing: z.string().check(refersTo('toy.thing', 'global')),
            part: z.optional(
              z.string().check(refersTo('toy.part', scope.owner('thing'))),
            ),
          }),
        ),
      }),
    ),
  }),
});

const things = defineFile({
  kind: 'things',
  extensions: ['.toy'],
  parser: langium(toyLanguage, {
    kinds: { Thing: 'toy.thing', Part: 'toy.part', Shelf: 'toy.shelf' },
    // `put ball.red`: red is a part of what `thing` names
    annotate: { Put: { part: [refersTo('toy.part', scope.owner('thing'))] } },
  }),
});

export const toy = declarePool({
  files: [shelves, things],
  kinds: {
    'toy.shelf': { label: 'shelf' },
    'toy.thing': { label: 'thing' },
    'toy.part': { label: 'part', scope: 'owner', reportUnused: true },
  },
});
