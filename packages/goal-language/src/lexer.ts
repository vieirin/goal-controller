import {
  createTokenInstance,
  type ILexingError,
  type IToken,
} from 'chevrotain';
import { DefaultLexer, type LexerResult } from 'langium';
import {
  ASSERTION_PREFIXES,
  CALL_NAMES,
  EXPRESSION,
  EXPRESSION_REF,
  ID_PREFIXES,
  OCL_BOOLEANS,
  OCL_CONDITION_WORDS,
  OCL_KEYWORDS,
  OCL_LITERALS,
  OCL_OPERATIONS,
  OCL_OPERATORS,
  idPrefixPattern,
  propertyKeyOf,
} from './catalog.js';

type Rules = ReadonlyArray<readonly [name: string, pattern: RegExp]>;

const rules = (list: ReadonlyArray<readonly [string, RegExp]>): Rules =>
  list.map(([name, pattern]) => [name, new RegExp(pattern.source, 'y')]);

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The keywords of a list, each matching itself. */
const literal = (...keywords: string[]): Array<[string, RegExp]> =>
  keywords.map((k) => [k, new RegExp(escaped(k))]);

/**
 * What reads ids, given a dialect's own prefixes (its extension's kinds',
 * `E` in `E1`; none: the catalog's only, as every dialect without them
 * reads). A dialect's own prefix is an ID_PREFIX token; the catalog's are
 * their keywords.
 */
type IdRules = {
  /** an element line from its id on (below) */
  rt: Rules;
  /** a prefix and `X` alone (`TX`), read as a WORD */
  xId: RegExp;
  /** an optional id before a plain line's name, with its colon */
  plainId: RegExp;
  /** a line that starts like an element line with an id (`G1`, `TX`) */
  elementStart: RegExp;
  /** a prefix's token: its keyword, or ID_PREFIX */
  tokenOf: (prefix: string) => string;
  /** an id's prefix and the rest (`T` and `1.2X`) */
  split: RegExp;
};

const idRulesCache = new Map<string, IdRules>();

const idRulesOf = (own: readonly string[]): IdRules => {
  const key = own.join(',');
  const cached = idRulesCache.get(key);
  if (cached) return cached;
  const prefix = idPrefixPattern(own);
  /**
   * An element line from its id on, in RTRegex.g4's definition order
   * (implicit literals first, then the lexer rules). ANTLR picks the longest
   * match and breaks ties by this order; GoalLexer does the same, so lines
   * read as the ANTLR grammars read them: `Goal` is one WORD, `G1` is `G` +
   * FLOAT, a space is part of a WORD (so `[G2; G3]` is an error), `->` beats
   * the `-` of a WORD. The catalog's other symbols come after them. `{` opens
   * the declaration.
   */
  const rt = rules([
    ...literal(...ID_PREFIXES),
    ...(own.length
      ? [['ID_PREFIX', new RegExp(own.map(escaped).join('|'))] as const]
      : []),
    ...literal('[', ']', ':', '@', '|', '?', '+', '#', ';', '->'),
    ...literal(',', '^', '&', '~', '!', '(', ')', '*', ...CALL_NAMES),
    ['DIGIT_SUBID', /[0-9][a-z]/],
    ['FLOAT', /[0-9]+\.?[0-9]*/],
    ['skip', /skip/],
    ['X', /X/],
    ['WORD', /[A-Za-z\- ']+/],
    ['WS', /\t+/],
    ['{', /\{/],
  ]);
  const rulesOf: IdRules = {
    rt,
    xId: new RegExp(`^(${prefix})X$`),
    plainId: new RegExp(
      `(?:${prefix})(?:[0-9]+\\.?[0-9]*X?|[0-9][a-z]|X)[ \\t]*:`,
      'y',
    ),
    elementStart: new RegExp(`(?:${prefix})(?:[0-9]|X)`, 'y'),
    tokenOf: (p) => (own.includes(p) ? 'ID_PREFIX' : p),
    split: new RegExp(`^(${prefix})(\\S+?)\\s*:$`),
  };
  idRulesCache.set(key, rulesOf);
  return rulesOf;
};

/**
 * A leaf's cost in its bracket (`[W = 0.1x]`, GODA's CostRegex.g4): `W`, `=`,
 * a constant and a variable of letters; spaces between them are hidden.
 */
const COST = rules([
  ...literal('W', '=', ']'),
  ['FLOAT', /[0-9]+\.?[0-9]*/],
  ['IDENT', /[A-Za-z_]+/],
  ['WS', /[ \t]+/],
]);

/** A bracket that holds a cost: `W =` first (spaces aside). */
const COST_START = /[ \t]*W[ \t]*=/y;

/** A line without an id: its name, then (spaces aside) the RT tokens. */
const PLAIN_NAME = /[^\s[\]{}<](?:[^\r\n[\]{}]*[^\s[\]{}])?/y;

const STEREOTYPE = rules([
  ['>>', />>/],
  ['TEXT', /[^\s<>{}=](?:[^\r\n<>{}=]*[^\s<>{}=])?/],
  ['WS', /[ \t]+/],
]);

const TAG = rules([
  ['}', /\}/],
  ['=', /=/],
  ['TEXT', /[^\s<>{}=](?:[^\r\n<>{}=]*[^\s<>{}=])?/],
  ['WS', /[ \t]+/],
]);

const DECLARATION = rules([
  ['}', /\}/],
  ['..', /\.\./],
  ['=', /=/],
  ['INTEGER', /-?[0-9]+/],
  ['IDENT', /[A-Za-z_][A-Za-z0-9_]*/],
  ['WS', /[ \t]+/],
]);

/**
 * An expression's operands (the catalog's EXPRESSION): an id ties with a name
 * of its length and wins (`R1`, `GX`), a longer name is a name (`Rate`, `G1a`).
 */
const OPERANDS: Array<[string, RegExp]> = [
  // the catalog's ids (`G3.1`, `TX`), and a dotted id of any kind (`F7.1`; an
  // undotted `F7` ties with a name and reads as one, resolved by the value)
  ['A_REF', new RegExp(EXPRESSION_REF)],
  ['A_ID', /[a-zA-Z_][a-zA-Z0-9_]*/],
  // AssertionRegex.g4's INT had no zero (`x > 0` did not parse): dropped
  ['A_INT', /[0-9]+/],
  // CtxRegex.g4's FLOAT (`x > 0.5`): longer than the INT it starts with
  ['A_NUMBER', /[0-9]+\.[0-9]*/],
];

/** The expression language's symbols: its operators, parentheses and separator. */
const EXPRESSION_SYMBOLS = [
  ...EXPRESSION.infix.flat(),
  ...EXPRESSION.prefix,
  ...EXPRESSION.parens,
  EXPRESSION.separator,
  // `room.clean`: a token of its own, so `a.b` and `a . b` read the same
  // (`T1.1` and `0.5` stay one token: longer than an id or a number)
  EXPRESSION.member,
];

/**
 * AssertionRegex.g4, in its definition order (its WS skips line breaks too),
 * with the expression language's symbols and operands (a comparison's sides).
 */
const ASSERTION = rules([
  ...literal('&', '|', '!', '(', ')', '=', '!=', '<', '<=', '>', '>='),
  ...literal('true', 'false'),
  ...literal(...EXPRESSION_SYMBOLS),
  ...OPERANDS,
  ['WS', /[ \t\r\n]+/],
]);

/**
 * A condition's prefix (CtxRegex.g4's `assertion condition `, `assertion
 * trigger `): read only where the value starts, so `assertion` stays a name
 * anywhere else.
 */
const ASSERTION_PREFIX = new RegExp(
  `(?:${ASSERTION_PREFIXES.map((prefix) => prefix.replace(' ', '[ \\t]+')).join('|')})(?![A-Za-z0-9_])`,
  'y',
);

const SPACE: [string, RegExp] = ['WS', /[ \t\r\n]+/];

const VALUE = /[^\s](?:[^\r\n]*[^\s])?/;

/** One value on its own, by its type (the grammar's value rules). */
const VALUES = {
  expression: rules([...literal(...EXPRESSION_SYMBOLS), ...OPERANDS, SPACE]),
  int: rules([['INTEGER', /-?[0-9]+/], SPACE]),
  number: rules([
    ['INTEGER', /-?[0-9]+/],
    ['NUMBER', /-?[0-9]+\.[0-9]+/],
    SPACE,
  ]),
  bool: rules([...literal('true', 'false'), SPACE]),
  text: rules([['VALUE', VALUE], SPACE]),
  enum: rules([['VALUE', VALUE], SPACE]),
  // any id, an extension kind's too (`S1`): whether it names an element of
  // the model is the value's to say, not its syntax's
  refList: rules([
    ...literal(...ID_PREFIXES),
    ['ID_PREFIX', /[A-Z]{1,2}(?=[0-9])/],
    ...literal(','),
    ['DIGIT_SUBID', /[0-9][a-z]/],
    ['FLOAT', /[0-9]+\.?[0-9]*/],
    ['X', /X/],
    SPACE,
  ]),
  pairList: rules([
    ...literal(':', ','),
    ['IDENT', /[A-Za-z_][A-Za-z0-9_]*/],
    SPACE,
  ]),
  nameList: rules([
    ...literal(','),
    ['IDENT', /[A-Za-z_][A-Za-z0-9_]*/],
    SPACE,
  ]),
  // longest match: `->` before `-`, `<>`/`!=` and `<=` before `<`; a keyword
  // ties with an IDENT of its length and wins, a longer word (`index`) is an
  // IDENT
  ocl: rules([
    ...literal(...OCL_OPERATORS),
    ...literal(...OCL_OPERATIONS.map((operation) => operation.name)),
    ...literal(...OCL_KEYWORDS, ...OCL_CONDITION_WORDS),
    ...literal(...OCL_BOOLEANS),
    ['STRING', OCL_LITERALS.STRING],
    ['NUMBER', OCL_LITERALS.NUMBER],
    ['INTEGER', OCL_LITERALS.INTEGER],
    ['IDENT', OCL_LITERALS.IDENT],
    SPACE,
  ]),
} as const;

const PAIR_VALUE = /[^\s,:](?:[^\r\n,:]*[^\s,:])?/y;

/**
 * Where a tokenize call starts: a document (its lines with ids and property
 * lines, or lines without ids), one element line, or one value of a type.
 */
export type LexerStart =
  | 'document'
  | 'plainDocument'
  | 'elementLine'
  | 'annotatedName'
  | 'assertion'
  /** a property line's key on its own (`Probability[e1]`, goal-controller#354) */
  | 'propertyKey'
  | keyof typeof VALUES;

/** Where the lexer is in an element line. */
type LineState =
  /** before the id or name: annotations, and spaces after them */
  'lead' | 'stereotype' | 'tag' | 'name' | 'rt' | 'cost' | 'declaration';

const LINE_RULES: Record<Exclude<LineState, 'lead' | 'name' | 'rt'>, Rules> = {
  stereotype: STEREOTYPE,
  tag: TAG,
  cost: COST,
  declaration: DECLARATION,
};

const HIDDEN = new Set(['WS']);
const LINE_BREAK = /[\r\n]+/y;
const INDENT = /[ \t]+/y;
const ANNOTATION = /<<|\{/y;
const KEY = /[A-Za-z][A-Za-z0-9_]*/y;
const KEYED_NAME = /[^\s[\]]+/y;
const AFTER_KEY = /[ \t]+/y;
const LINE_REST = /[^\r\n]*/y;
const PROPERTY_VALUE = /[^\s](?:[^\r\n]*[^\s])?/y;

/** An id's prefix token (`G`, `T`, `R`, `AT`, an extension kind's `E`). */
const isPrefixToken = (name: string) =>
  name === 'ID_PREFIX' || (ID_PREFIXES as readonly string[]).includes(name);

/**
 * An id is one lexical unit (goal-controller#186): a hidden space between its
 * prefix and its number (`G 1`), or its number and its `X` (`G1 X`), is an
 * error, not an id read across it. Spaces around a separator stay (`G1 ,G2`).
 */
const idGaps = (text: string, tokens: readonly IToken[]): ILexingError[] =>
  tokens.flatMap((token, i) => {
    const before = tokens[i - 1];
    if (!before) return [];
    const [prev, next] = [before.tokenType.name, token.tokenType.name];
    const number = next === 'FLOAT' || next === 'DIGIT_SUBID';
    const idPart =
      (isPrefixToken(prev) && (number || next === 'X')) ||
      (prev === 'FLOAT' &&
        next === 'X' &&
        isPrefixToken(tokens[i - 2]?.tokenType.name ?? ''));
    const gap = before.endOffset! + 1;
    if (!idPart || token.startOffset === gap) return [];
    // from the id's prefix (`G1 X`: the `G`)
    const from = isPrefixToken(prev) ? before : tokens[i - 2]!;
    const written = text.slice(from.startOffset, token.endOffset! + 1);
    return [
      {
        offset: gap,
        line: before.endLine,
        column: before.endColumn! + 1,
        length: token.startOffset - gap,
        message: `an id has no spaces: '${written.replace(/\s+/g, '')}', not '${written}'`,
      },
    ];
  });

const at = (pattern: RegExp, text: string, offset: number) => {
  pattern.lastIndex = offset;
  return pattern.exec(text)?.[0];
};

export class GoalLexer extends DefaultLexer {
  /** Where the next `tokenize` starts (reset after each call). */
  start: LexerStart = 'document';
  /**
   * The id prefixes the next `tokenize` reads besides the catalog's: its
   * dialect's own, an extension's kinds' (reset after each call).
   */
  prefixes: readonly string[] = [];
  /**
   * The keys the next `tokenize` reads as property lines' in a document
   * without ids (`propertyKeysOf`; reset after each call).
   */
  keys: readonly string[] = [];

  override tokenize(text: string): LexerResult {
    const tokens: IToken[] = [];
    const hidden: IToken[] = [];
    const errors: ILexingError[] = [];
    const start = this.start;
    this.start = 'document';
    const ids = idRulesOf(this.prefixes);
    this.prefixes = [];
    const keys = this.keys;
    this.keys = [];
    let offset = 0;
    let line = 1;
    let column = 1;

    const advance = (image: string) => {
      for (const ch of image) {
        if (ch === '\n') {
          line++;
          column = 1;
        } else column++;
      }
      offset += image.length;
    };
    const push = (name: string, image: string) => {
      const tokenType = this.definition[name];
      if (!tokenType) throw new Error(`GoalLexer: no token type ${name}`);
      const [startLine, startColumn, startOffset] = [line, column, offset];
      advance(image);
      // chevrotain positions: 1-based lines and columns, inclusive ends
      const token = createTokenInstance(
        tokenType,
        image,
        startOffset,
        offset - 1,
        startLine,
        line,
        startColumn,
        column - 1,
      );
      (HIDDEN.has(name) ? hidden : tokens).push(token);
    };
    const unrecognized = () => {
      errors.push({
        offset,
        line,
        column,
        length: 1,
        message: `token recognition error at: '${text[offset]}'`,
      });
      advance(text[offset]!);
    };
    /** the longest match of a token set (ties: the first listed) */
    const longest = (set: Rules) => {
      let best: { name: string; image: string } | null = null;
      for (const [name, pattern] of set) {
        const image = at(pattern, text, offset);
        if (image && (!best || image.length > best.image.length))
          best = { name, image };
      }
      return best;
    };

    /**
     * a property line's key (`Probability`), and a keyed key's name in its
     * brackets right after it (`Probability[e1]`, goal-controller#354)
     */
    const pushKey = (key: string) => {
      push('KEY', key);
      if (text[offset] !== '[') return;
      push('[', '[');
      for (const [name, pattern] of [
        ['WS', INDENT],
        ['KEYED_NAME', KEYED_NAME],
        ['WS', INDENT],
      ] as const) {
        const image = at(pattern, text, offset);
        if (image) push(name, image);
      }
      if (text[offset] === ']') push(']', ']');
    };

    if (start === 'propertyKey') {
      const key = at(KEY, text, offset);
      if (key) pushKey(key);
      while (offset < text.length) unrecognized();
      return { tokens, hidden, errors };
    }

    if (start === 'assertion' || start in VALUES) {
      const set =
        start === 'assertion'
          ? ASSERTION
          : VALUES[start as keyof typeof VALUES];
      if (start === 'assertion') {
        // a prefix, before anything else but spaces
        const space = at(/[ \t\r\n]+/y, text, offset);
        if (space) push('WS', space);
        const prefix = at(ASSERTION_PREFIX, text, offset);
        if (prefix) push('A_PREFIX', prefix);
      }
      while (offset < text.length) {
        if (start === 'pairList' && tokens.at(-1)?.tokenType.name === ':') {
          const value = at(PAIR_VALUE, text, offset);
          if (value) {
            push('PAIR_VALUE', value);
            continue;
          }
        }
        const best = longest(set);
        if (best) push(best.name, best.image);
        else unrecognized();
      }
      return { tokens, hidden, errors: [...errors, ...idGaps(text, tokens)] };
    }

    const document = start === 'document' || start === 'plainDocument';
    const plain = start === 'plainDocument' || start === 'annotatedName';
    let state: LineState | 'property' = 'lead';
    // spaces before the id are hidden only after an annotation (RTRegex.g4
    // read a leading space as part of a WORD)
    let annotated = false;
    let lineStart = true;
    // whether the line's bracket has opened (only it may hold a cost)
    let bracketed = false;

    while (offset < text.length) {
      const lineBreak = at(LINE_BREAK, text, offset);
      if (lineBreak) {
        push('NL', lineBreak);
        state = 'lead';
        annotated = false;
        lineStart = true;
        bracketed = false;
        continue;
      }
      if (lineStart && document) {
        lineStart = false;
        const indent = at(INDENT, text, offset);
        if (indent) {
          push('WS', indent);
          continue;
        }
      }
      lineStart = false;
      if (state === 'property') {
        const value = at(PROPERTY_VALUE, text, offset);
        const space = at(INDENT, text, offset);
        if (space) push('WS', space);
        else if (value) push('VALUE', value);
        else unrecognized();
        continue;
      }
      if (state === 'lead') {
        const annotation = at(ANNOTATION, text, offset);
        if (annotation) {
          push(annotation, annotation);
          state = annotation === '<<' ? 'stereotype' : 'tag';
          continue;
        }
        const space = annotated && at(INDENT, text, offset);
        if (space) {
          push('WS', space);
          continue;
        }
        if (
          document &&
          !plain &&
          !annotated &&
          !at(ids.elementStart, text, offset) &&
          at(KEY, text, offset)
        ) {
          pushKey(at(KEY, text, offset)!);
          const space = at(AFTER_KEY, text, offset);
          if (space) push('WS', space);
          state = 'property';
          continue;
        }
        // a line without an id that starts with a declared key is its
        // property line (goal-controller#138); a name so written is quoted
        const key =
          document &&
          plain &&
          !annotated &&
          keys.length > 0 &&
          propertyKeyOf(keys, at(LINE_REST, text, offset) ?? '');
        if (key) {
          push('KEY', key);
          const space = at(AFTER_KEY, text, offset);
          if (space) push('WS', space);
          state = 'property';
          continue;
        }
        state = plain ? 'name' : 'rt';
        continue;
      }
      if (state === 'name') {
        // an optional id first (`G1: Name`): its tokens as an element line's
        const id = at(ids.plainId, text, offset);
        if (id) {
          const [, prefix, rest] = ids.split.exec(id)!;
          push(ids.tokenOf(prefix!), prefix!);
          if (/^[0-9][a-z]$/.test(rest!)) push('DIGIT_SUBID', rest!);
          else {
            const float = /^[0-9]+\.?[0-9]*/.exec(rest!)![0];
            push('FLOAT', float);
            if (rest!.length > float.length) push('X', 'X');
          }
          const space = at(INDENT, text, offset);
          if (space) push('WS', space);
          push(':', ':');
          const after = at(INDENT, text, offset);
          if (after) push('WS', after);
          continue;
        }
        const name = at(PLAIN_NAME, text, offset);
        if (name) push('PLAIN_NAME', name);
        state = 'rt';
        if (!name) unrecognized();
        continue;
      }
      if (plain && state === 'rt') {
        // a line without an id: spaces separate its parts
        const space = at(INDENT, text, offset);
        if (space) {
          push('WS', space);
          continue;
        }
      }
      const best = longest(state === 'rt' ? ids.rt : LINE_RULES[state]);
      if (!best) {
        unrecognized();
        continue;
      }
      // an id where one may be: not a name right after its colon (`G1:GX`)
      const xId =
        state === 'rt' &&
        best.name === 'WORD' &&
        tokens.at(-1)?.tokenType.name !== ':' &&
        ids.xId.exec(best.image);
      if (xId) {
        push(ids.tokenOf(xId[1]!), xId[1]!);
        push('X', 'X');
        continue;
      }
      push(best.name, best.image);
      if (state === 'rt' && best.name === '[' && !bracketed) {
        bracketed = true;
        if (at(COST_START, text, offset)) state = 'cost';
        continue;
      }
      if (state === 'cost' && best.name === ']') {
        state = 'rt';
        continue;
      }
      if (state === 'stereotype' && best.name === '>>') {
        state = 'lead';
        annotated = true;
      } else if (state === 'tag' && best.name === '}') {
        state = 'lead';
        annotated = true;
      } else if (state === 'rt' && best.name === '{') state = 'declaration';
      else if (state === 'declaration' && best.name === '}') state = 'rt';
    }
    return { tokens, hidden, errors: [...errors, ...idGaps(text, tokens)] };
  }
}
