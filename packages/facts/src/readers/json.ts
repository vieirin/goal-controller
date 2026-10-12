/**
 * JSON with locations (JSON.parse keeps none): each value with its offsets,
 * an object's keys with theirs, and a number's text as written (`3` is an
 * int, `3.0` is not). Lenient: it stops at the first error, keeping what it
 * read.
 */

export type JsonNode =
  | { type: 'object'; from: number; to: number; members: JsonMember[] }
  | { type: 'array'; from: number; to: number; items: JsonNode[] }
  | { type: 'string'; from: number; to: number; value: string }
  | { type: 'number'; from: number; to: number; value: number; raw: string }
  | { type: 'boolean'; from: number; to: number; value: boolean }
  | { type: 'null'; from: number; to: number };

export type JsonMember = {
  key: string;
  /** the key's offsets, quotes included */
  keyFrom: number;
  keyTo: number;
  value: JsonNode;
};

class Stop extends Error {}

export const readJsonNode = (text: string): JsonNode | null => {
  let at = 0;
  const space = () => {
    while (/\s/.test(text[at] ?? '')) at += 1;
  };
  const fail = (): never => {
    throw new Stop();
  };
  const string = (): { value: string; from: number; to: number } => {
    const match = /"(?:[^"\\\n]|\\.)*"/y;
    match.lastIndex = at;
    const found = match.exec(text) ?? fail();
    const from = at;
    at = match.lastIndex;
    return { value: JSON.parse(found[0]) as string, from, to: at };
  };
  const value = (): JsonNode => {
    space();
    const from = at;
    const ch = text[at];
    if (ch === '{') {
      at += 1;
      const members: JsonMember[] = [];
      space();
      if (text[at] === '}') at += 1;
      else
        for (;;) {
          space();
          const key = string();
          space();
          if (text[at++] !== ':') fail();
          members.push({
            key: key.value,
            keyFrom: key.from,
            keyTo: key.to,
            value: value(),
          });
          space();
          const next = text[at++];
          if (next === '}') break;
          if (next !== ',') fail();
        }
      return { type: 'object', from, to: at, members };
    }
    if (ch === '[') {
      at += 1;
      const items: JsonNode[] = [];
      space();
      if (text[at] === ']') at += 1;
      else
        for (;;) {
          items.push(value());
          space();
          const next = text[at++];
          if (next === ']') break;
          if (next !== ',') fail();
        }
      return { type: 'array', from, to: at, items };
    }
    if (ch === '"') return { type: 'string', ...string() };
    const word = /true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
    word.lastIndex = at;
    const found = word.exec(text) ?? fail();
    at = word.lastIndex;
    const raw = found[0];
    if (raw === 'null') return { type: 'null', from, to: at };
    if (raw === 'true' || raw === 'false')
      return { type: 'boolean', from, to: at, value: raw === 'true' };
    return { type: 'number', from, to: at, value: Number(raw), raw };
  };
  try {
    return value();
  } catch (error) {
    if (error instanceof Stop) return null;
    throw error;
  }
};

/** An object's member, by key. */
export const member = (
  node: JsonNode | undefined,
  key: string,
): JsonMember | undefined =>
  node?.type === 'object' ? node.members.find((m) => m.key === key) : undefined;

/** A string node's location, without its quotes. */
export const inside = (node: { from: number; to: number }) => ({
  from: node.from + 1,
  to: node.to - 1,
});
