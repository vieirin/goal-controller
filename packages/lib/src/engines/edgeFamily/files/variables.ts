/**
 * The Edge engines' variables (`variables.json`): each key defines a
 * variable, typed by its value (#58): `true`/`false` a bool, `3` an int,
 * `3.0` or `0.9` a number.
 */
import * as z from 'zod/mini';
import type { AssertionType } from '../../assertionUses';
import { defineFile, json, type Occurrence } from '../../../pool';
import { defines } from '../pool/vocabulary';

const typeOfValue = ([occurrence]: readonly Occurrence[]):
  | AssertionType
  | undefined => {
  if (!occurrence) return undefined;
  const key = occurrence.value as string;
  if (typeof (occurrence.parent as Variables)[key] === 'boolean') return 'bool';
  // 3 and 3.0 parse alike: as written tells an int from a number
  return /^-?\d+$/.test(occurrence.text(key)?.trim() ?? '') ? 'int' : 'number';
};

const value = z.union([z.boolean(), z.number()]);
type Variables = Record<string, z.infer<typeof value>>;

export const variables = defineFile({
  kind: 'variables',
  parser: json,
  schema: z.record(
    z.string().check(defines('edge.variable', { type: typeOfValue })),
    value,
  ),
});
