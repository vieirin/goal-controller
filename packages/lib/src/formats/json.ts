/**
 * A JSON text as a tree with ranges: what `JSON.parse` reads, with where each
 * key and value is. A project resource's references point into it (an engine's
 * configuration, goal-controller#59). It reads only valid JSON (null for any
 * other text): `readJson` says what is wrong with it.
 */

export type JsonRange = { from: number; to: number };

export type JsonNode =
  | ({ type: 'object'; entries: JsonEntry[] } & JsonRange)
  | ({ type: 'array'; items: JsonNode[] } & JsonRange)
  /** a string's range includes its quotes; `inner` is its content's */
  | ({ type: 'string'; value: string; inner: JsonRange } & JsonRange)
  | ({ type: 'number'; value: number } & JsonRange)
  | ({ type: 'boolean'; value: boolean } & JsonRange)
  | ({ type: 'null' } & JsonRange);

export type JsonEntry = {
  key: string;
  /** the key's range, its quotes included */
  keyRange: JsonRange;
  value: JsonNode;
};

const WHITESPACE = /[ \t\n\r]*/y;
const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const STRING = /"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/y;

/** The tree of a JSON text, or null when it isn't JSON. */
export const readJsonTree = (text: string): JsonNode | null =>
  parseTree(text).root;

/** The tree of a JSON text; when it isn't JSON, none, and where it stops being. */
const parseTree = (text: string): { root: JsonNode | null; at: number } => {
  let pos = 0;
  const skip = () => {
    WHITESPACE.lastIndex = pos;
    WHITESPACE.exec(text);
    pos = WHITESPACE.lastIndex;
  };
  const fail = (): never => {
    throw new SyntaxError(`JSON at ${pos}`);
  };
  const string = (): Extract<JsonNode, { type: 'string' }> => {
    STRING.lastIndex = pos;
    const match = STRING.exec(text) ?? fail();
    const from = pos;
    pos = STRING.lastIndex;
    return {
      type: 'string',
      value: JSON.parse(match[0]) as string,
      from,
      to: pos,
      inner: { from: from + 1, to: pos - 1 },
    };
  };
  const value = (): JsonNode => {
    skip();
    const from = pos;
    const char = text[pos];
    if (char === '{') {
      pos += 1;
      const entries: JsonEntry[] = [];
      skip();
      if (text[pos] === '}') pos += 1;
      else
        for (;;) {
          skip();
          const key = string();
          skip();
          if (text[pos] !== ':') fail();
          pos += 1;
          entries.push({
            key: key.value,
            keyRange: { from: key.from, to: key.to },
            value: value(),
          });
          skip();
          if (text[pos] === ',') pos += 1;
          else if (text[pos] === '}') {
            pos += 1;
            break;
          } else fail();
        }
      return { type: 'object', entries, from, to: pos };
    }
    if (char === '[') {
      pos += 1;
      const items: JsonNode[] = [];
      skip();
      if (text[pos] === ']') pos += 1;
      else
        for (;;) {
          items.push(value());
          skip();
          if (text[pos] === ',') pos += 1;
          else if (text[pos] === ']') {
            pos += 1;
            break;
          } else fail();
        }
      return { type: 'array', items, from, to: pos };
    }
    if (char === '"') return string();
    for (const [word, node] of [
      ['true', { type: 'boolean', value: true }],
      ['false', { type: 'boolean', value: false }],
      ['null', { type: 'null' }],
    ] as const)
      if (text.startsWith(word, pos)) {
        pos += word.length;
        return { ...node, from, to: pos } as JsonNode;
      }
    NUMBER.lastIndex = pos;
    const number = NUMBER.exec(text) ?? fail();
    pos = NUMBER.lastIndex;
    return { type: 'number', value: Number(number[0]), from, to: pos };
  };
  try {
    const root = value();
    skip();
    return pos === text.length ? { root, at: pos } : { root: null, at: pos };
  } catch {
    return { root: null, at: Math.min(pos, text.length) };
  }
};

/** What reading a JSON file found wrong, and where. */
export type JsonDiagnostic = {
  severity: 'error';
  message: string;
  from: number;
  to: number;
};

/**
 * A JSON file's value, or where it isn't JSON (goal-controller#143: a
 * native file in JSON starts here).
 */
export const readJson = (
  text: string,
): { value: unknown; diagnostics: JsonDiagnostic[] } => {
  const { root, at } = parseTree(text);
  if (root) return { value: JSON.parse(text) as unknown, diagnostics: [] };
  return {
    value: undefined,
    diagnostics: [
      {
        severity: 'error',
        message:
          at >= text.length
            ? 'Not JSON: the text ends too soon'
            : `Not JSON: unexpected ${JSON.stringify(text[at])}`,
        from: at,
        to: Math.min(at + 1, text.length),
      },
    ],
  };
};

/** A value as a JSON file: two-space indents, a final line break. */
export const writeJson = (value: unknown): string =>
  `${JSON.stringify(value, null, 2)}\n`;

/** A value with every object's keys sorted, at any depth. */
const sortedKeys = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(sortedKeys)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [
              key,
              sortedKeys((value as Record<string, unknown>)[key]),
            ]),
        )
      : value;

/**
 * A JSON text in the form two are compared in: its keys sorted, written as
 * `writeJson` writes. The text as it was when it isn't JSON.
 */
export const canonicalJson = (text: string): string => {
  const { value, diagnostics } = readJson(text);
  return diagnostics.length ? text : writeJson(sortedKeys(value));
};

/** An object's entry by key (the first; JSON.parse keeps the last). */
export const jsonEntry = (
  node: JsonNode | undefined,
  key: string,
): JsonEntry | undefined =>
  node?.type === 'object'
    ? [...node.entries].reverse().find((entry) => entry.key === key)
    : undefined;
