/**
 * The Edge engines' variables (`variables.json`) as facts
 * (goal-controller#75): each key defines a variable, typed by its value as
 * written (#58): `true`/`false` a boolean, `3` an int, `3.0` or `0.9` a
 * number (JSON.parse can't tell `3` from `3.0`; the ranged reader keeps the
 * text).
 */
import type { DocumentFacts, KindDefinition } from '../../ruleFacts/facts';
import { inside, readJsonNode } from '../../ruleFacts/json';

export const VARIABLES_KINDS: Readonly<Record<string, KindDefinition>> = {
  'edge.variable': { label: 'variable' },
};

export const readVariables = (
  document: string,
  text: string,
): DocumentFacts => {
  const facts: DocumentFacts = {
    document,
    text,
    definitions: [],
    references: [],
  };
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
    if (type)
      facts.definitions.push({
        id: `edge.variable:${key}`,
        kind: 'edge.variable',
        name: key,
        location: { document, ...inside({ from: keyFrom, to: keyTo }) },
        type,
      });
  }
  return facts;
};
