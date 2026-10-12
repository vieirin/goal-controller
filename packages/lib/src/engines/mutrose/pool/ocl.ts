/**
 * A stand-in for MutRoSe's own Langium language (goal-controller#62): the
 * names and paths of an OCL value and of a variable list, with their
 * ranges, read from its tokens. It has the readers' API exactly
 * (`readOclExpression`, `readOclVariables`), so the goal-model provider
 * switches to the grammar's by its import.
 */

/** A name and its range (offsets in the text read, plus its offset). */
export type OclName = { name: string; from: number; to: number };

/** `a.b.c`: a variable, then its attributes. */
export type OclPath = { head: OclName; attributes: OclName[] };

export type OclReading = {
  /** every path, a select's or forAll's source too; not `world_db`, nor a keyword */
  paths: OclPath[];
  /** `->select(v:Type | …)`: the query's variable, its type, and what it reads (null: `world_db`) */
  selects: { variable: OclName; type: OclName; source: OclPath | null }[];
  /** `coll->forAll(it | …)`: what it iterates over, and with which variable */
  forAlls: { iterated: OclPath | null; iteration: OclName }[];
};

export type OclVariable = {
  name: OclName;
  /** the type as written (`Sequence(Room)`), or empty */
  type: string;
  /** its class: `Room` in `Room` and in `Sequence(Room)` */
  typeName?: OclName;
};

type Parsed<T> = { value: T; errors: { message: string; offset: number }[] };

type Token = {
  type: 'name' | 'number' | 'string' | 'arrow' | 'symbol';
  text: string;
  from: number;
  to: number;
};

const TOKEN =
  /\s+|(?<name>[A-Za-z_][A-Za-z0-9_]*)|(?<number>\d+(?:\.\d+)?)|(?<string>"[^"]*"?)|(?<arrow>->)|(?<symbol>&&|\|\||<=|>=|<>|!=|[^\s])/gy;

const tokens = (text: string, offset: number): Token[] => {
  const found: Token[] = [];
  TOKEN.lastIndex = 0;
  for (let match = TOKEN.exec(text); match; match = TOKEN.exec(text)) {
    const groups = match.groups ?? {};
    const type = (
      ['name', 'number', 'string', 'arrow', 'symbol'] as const
    ).find((key) => groups[key] !== undefined);
    if (type)
      found.push({
        type,
        text: match[0],
        from: offset + match.index,
        to: offset + match.index + match[0].length,
      });
  }
  return found;
};

/** Words OCL reads itself: no variable */
const KEYWORDS = new Set([
  'not',
  'and',
  'or',
  'in',
  'implies',
  'true',
  'false',
  'null',
  'self',
]);

const nameOf = (token: Token): OclName => ({
  name: token.text,
  from: token.from,
  to: token.to,
});

/** An OCL value's paths, and the variables and types its `select` and `forAll` introduce. */
export const readOclExpression = (
  text: string,
  offset = 0,
): Parsed<OclReading> => {
  const all = tokens(text, offset);
  const reading: OclReading = { paths: [], selects: [], forAlls: [] };
  // the path just before `->`: what the operation reads (null: world_db)
  let last: OclPath | null = null;
  for (let i = 0; i < all.length; i += 1) {
    const token = all[i]!;
    if (
      token.type === 'arrow' &&
      all[i + 1]?.type === 'name' &&
      all[i + 2]?.text === '('
    ) {
      const operation = all[i + 1]!.text;
      const variable = all[i + 3];
      const type =
        all[i + 4]?.text === ':' && all[i + 5]?.type === 'name'
          ? all[i + 5]
          : null;
      if (operation === 'select' && variable?.type === 'name' && type) {
        reading.selects.push({
          variable: nameOf(variable),
          type: nameOf(type),
          source: last,
        });
        i += 5;
      } else if (operation === 'forAll' && variable?.type === 'name') {
        reading.forAlls.push({ iterated: last, iteration: nameOf(variable) });
        i += 3;
      } else i += 2;
      last = null;
      continue;
    }
    if (token.type !== 'name') {
      last = null;
      continue;
    }
    // a path: names joined by `.` with nothing between
    const names: OclName[] = [nameOf(token)];
    while (
      all[i + 1]?.text === '.' &&
      all[i + 1]!.from === all[i]!.to &&
      all[i + 2]?.type === 'name' &&
      all[i + 2]!.from === all[i + 1]!.to
    ) {
      names.push(nameOf(all[i + 2]!));
      i += 2;
    }
    const [head, ...attributes] = names;
    if (head!.name === 'world_db') {
      last = null;
      continue;
    }
    if (KEYWORDS.has(head!.name.toLowerCase()) && !attributes.length) {
      last = null;
      continue;
    }
    const path = { head: head!, attributes };
    reading.paths.push(path);
    last = path;
  }
  return { value: reading, errors: [] };
};

/** `a : T, b : Sequence(T), c`: each name, its type as written, and its class. */
export const readOclVariables = (
  text: string,
  offset = 0,
): Parsed<OclVariable[]> => {
  const variables: OclVariable[] = [];
  let at = 0;
  for (const item of text.split(',')) {
    const name = /[A-Za-z][A-Za-z0-9_]*/.exec(item);
    if (name) {
      const colon = item.indexOf(':');
      const typeText = colon >= 0 ? item.slice(colon + 1) : '';
      const type = /[A-Za-z0-9]+(\([A-Za-z]+\))?/.exec(typeText);
      const inner = type && /\(([A-Za-z]+)\)/.exec(type[0]);
      const typeFrom =
        type &&
        offset + at + colon + 1 + type.index + (inner ? inner.index + 1 : 0);
      const typeName = type && (inner ? inner[1]! : type[0]);
      variables.push({
        name: {
          name: name[0],
          from: offset + at + name.index,
          to: offset + at + name.index + name[0].length,
        },
        type: type?.[0] ?? '',
        ...(typeName &&
          typeFrom !== null && {
            typeName: {
              name: typeName,
              from: typeFrom,
              to: typeFrom + typeName.length,
            },
          }),
      });
    }
    at += item.length + 1;
  }
  return { value: variables, errors: [] };
};
