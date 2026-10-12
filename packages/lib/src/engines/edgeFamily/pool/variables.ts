/**
 * The Edge engines' variables (`variables.json`) in the definition pool:
 * each key defines a variable, typed by its value as written (#58):
 * `true`/`false` a boolean, `3` an int, `3.0` or `0.9` a number (JSON.parse
 * can't tell `3` from `3.0`; the ranged reader keeps the text).
 */
import { readJsonTree } from '../../../formats';
import type {
  PoolDefinition,
  PoolFacts,
  PoolProvider,
} from '../../definitionPool';

export const variablesProvider: PoolProvider = {
  id: 'edge',
  documents: { resources: ['variables'] },
  kinds: { variable: { label: 'Variable' } },
  extract: ({ id: document, text = '' }): PoolFacts => {
    const root = readJsonTree(text);
    const definitions: PoolDefinition[] =
      root?.type !== 'object'
        ? []
        : root.entries.flatMap(({ key, keyRange, value }) => {
            const raw = text.slice(value.from, value.to);
            const type =
              value.type === 'boolean'
                ? 'boolean'
                : value.type === 'number'
                  ? /^-?\d+$/.test(raw)
                    ? 'int'
                    : 'number'
                  : null;
            return type
              ? [
                  {
                    id: `edge.variable:${key}`,
                    kind: 'edge.variable',
                    name: key,
                    location: {
                      document,
                      from: keyRange.from + 1,
                      to: keyRange.to - 1,
                    },
                    type,
                    detail: raw,
                  },
                ]
              : [];
          });
    return { definitions, references: [] };
  },
};
