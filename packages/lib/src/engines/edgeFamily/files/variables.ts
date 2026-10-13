/**
 * The Edge engines' variables (`variables.json`): each key defines a
 * variable, typed by its value as written (#58): `true`/`false` a boolean,
 * `3` an int, `3.0` or `0.9` a number.
 */
import * as z from 'zod/mini';
import { defineFile, defines, json, type Occurrence } from '../../../pool';

const typeAsWritten = ([occurrence]: readonly Occurrence[]) => {
  const raw = occurrence?.text(occurrence.value as string)?.trim();
  return raw === undefined || /^(true|false)$/.test(raw)
    ? 'boolean'
    : /^-?\d+$/.test(raw)
      ? 'int'
      : 'number';
};

export const variables = defineFile({
  kind: 'variables',
  parser: json,
  schema: z.record(
    z.string().check(defines('edge.variable', { type: typeAsWritten })),
    z.union([z.boolean(), z.number()]),
  ),
});
