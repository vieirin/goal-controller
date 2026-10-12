/**
 * The Edge engines' variables (`variables.json`), typed (goal-controller#79):
 * a value for each of the model's context variables (true/false) and
 * achievability variables (a probability), as the generation reads them:
 * `{ "isRaining": false, "T1_achievable": 0.9 }`. Each key defines a
 * variable (#75), typed by its value as written (#58): `true`/`false` a
 * boolean, `3` an int, `3.0` or `0.9` a number.
 */
import * as z from 'zod/mini';
import { read, type Reader } from '../../../readers';
import { parseJson } from '../../../readers/json';
import type { DocumentFacts, KindDefinition } from '../../ruleFacts/facts';

export const variablesSchema = z.record(
  z.string(),
  z.union([z.boolean(), z.number()], {
    error: 'A variable is true, false or a number',
  }),
);

export type VariablesFile = z.infer<typeof variablesSchema>;

export const VARIABLES_KINDS: Readonly<Record<string, KindDefinition>> = {
  'edge.variable': { label: 'variable' },
};

export const variablesReader: Reader<VariablesFile, DocumentFacts> = {
  parse: parseJson,
  schema: variablesSchema,
  facts: (variables, at, document) => ({
    document,
    text: '',
    definitions: Object.entries(variables).map(([name, value]) => {
      const { from, to } = at([name], 'key')!;
      return {
        id: `edge.variable:${name}`,
        kind: 'edge.variable',
        name,
        location: { document, from, to },
        // JSON.parse can't tell `3` from `3.0`; its text can
        type:
          typeof value === 'boolean'
            ? 'boolean'
            : /^-?\d+$/.test(at([name])!.text)
              ? 'int'
              : 'number',
      };
    }),
    references: [],
  }),
};

/** The variables' facts (none when they aren't an object). */
export const readVariables = (
  document: string,
  text: string,
): DocumentFacts => {
  const { facts } = read(variablesReader, document, text);
  return facts
    ? { ...facts, text }
    : { document, text, definitions: [], references: [] };
};
