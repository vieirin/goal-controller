/**
 * The Edge engines' variables (`variables.json`): each key defines a
 * variable, typed by its value as written (#58): `true`/`false` a boolean,
 * `3` an int, `3.0` or `0.9` a number. JSON.parse can't tell `3` from `3.0`;
 * the range-keeping reader keeps the raw text.
 */
import type { PoolFacts, PoolProvider } from '../core/types';
import { inside, readJsonNode } from '../readers/json';

export const variablesProvider: PoolProvider = {
  id: 'edge',
  documents: { resources: ['variables'] },
  kinds: { variable: { label: 'variable' } },
  extract: ({ id: document, text = '' }) => {
    const facts: PoolFacts = { definitions: [], references: [] };
    const root = readJsonNode(text);
    if (root?.type !== 'object') return facts;
    for (const { key, keyFrom, keyTo, value } of root.members) {
      const type =
        value.type === 'boolean'
          ? 'boolean'
          : value.type === 'number'
            ? /^-?\d+$/.test(value.raw)
              ? 'int'
              : 'number'
            : null;
      if (!type) continue;
      facts.definitions.push({
        id: `edge.variable:${key}`,
        kind: 'edge.variable',
        name: key,
        location: { document, ...inside({ from: keyFrom, to: keyTo }) },
        type,
        detail: text.slice(value.from, value.to),
      });
    }
    return facts;
  },
};
