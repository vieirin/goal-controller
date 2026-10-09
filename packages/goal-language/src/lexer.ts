import {
  createTokenInstance,
  type ILexingError,
  type IToken,
} from 'chevrotain';
import { DefaultLexer, type LexerResult } from 'langium';

type Rules = ReadonlyArray<readonly [name: string, pattern: RegExp]>;

const rules = (list: ReadonlyArray<readonly [string, RegExp]>): Rules =>
  list.map(([name, pattern]) => [name, new RegExp(pattern.source, 'y')]);

/** The keywords of a list, each matching itself. */
const literal = (...keywords: string[]): Array<[string, RegExp]> =>
  keywords.map((k) => [
    k,
    new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  ]);

/**
 * An element line from its id on, in RTRegex.g4's definition order (implicit
 * literals first, then the lexer rules). ANTLR picks the longest match and
 * breaks ties by this order; GoalLexer does the same, so lines read as the
 * ANTLR grammars read them: `Goal` is one WORD, `G1` is `G` + FLOAT, a space is
 * part of a WORD (so `[G2; G3]` is an error), `->` beats the `-` of a WORD.
 * The catalog's other symbols come after them. `{` opens the declaration.
 */
const RT = rules([
  ...literal('G', 'T', 'R', '[', ']', ':', '@', '|', '?', '+', '#', ';', '->'),
  ...literal(',', '^', '&', '~', '!', '(', ')', '*'),
  ['DIGIT_SUBID', /[0-9][a-z]/],
  ['FLOAT', /[0-9]+\.?[0-9]*/],
  ['skip', /skip/],
  ['X', /X/],
  ['WORD', /[A-Za-z\- ']+/],
  ['WS', /\t+/],
  ['{', /\{/],
]);

/** An optional id before a plain line's name, with its colon: `G1:`, `T1.2X :`. */
const PLAIN_ID = /[GTR](?:[0-9]+\.?[0-9]*X?|[0-9][a-z])[ \t]*:/y;

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

/** AssertionRegex.g4, in its definition order (its WS skips line breaks too). */
const ASSERTION = rules([
  ...literal('&', '|', '!', '(', ')', '=', '!=', '<', '<=', '>', '>='),
  ...literal('true', 'false'),
  ['A_ID', /[a-zA-Z_][a-zA-Z0-9_]*/],
  // AssertionRegex.g4's INT had no zero (`x > 0` did not parse): dropped
  ['A_INT', /[0-9]+/],
  ['WS', /[ \t\r\n]+/],
]);

const SPACE: [string, RegExp] = ['WS', /[ \t\r\n]+/];

const VALUE = /[^\s](?:[^\r\n]*[^\s])?/;

/** One value on its own, by its type (the grammar's value rules). */
const VALUES = {
  int: rules([['INTEGER', /-?[0-9]+/], SPACE]),
  number: rules([
    ['INTEGER', /-?[0-9]+/],
    ['NUMBER', /-?[0-9]+\.[0-9]+/],
    SPACE,
  ]),
  bool: rules([...literal('true', 'false'), SPACE]),
  text: rules([['VALUE', VALUE], SPACE]),
  enum: rules([['VALUE', VALUE], SPACE]),
  refList: rules([
    ...literal('G', 'T', 'R', ','),
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
  | keyof typeof VALUES;

/** Where the lexer is in an element line. */
type LineState =
  /** before the id or name: annotations, and spaces after them */
  'lead' | 'stereotype' | 'tag' | 'name' | 'rt' | 'declaration';

const LINE_RULES: Record<Exclude<LineState, 'lead' | 'name'>, Rules> = {
  stereotype: STEREOTYPE,
  tag: TAG,
  rt: RT,
  declaration: DECLARATION,
};

const HIDDEN = new Set(['WS']);
const LINE_BREAK = /[\r\n]+/y;
const INDENT = /[ \t]+/y;
const ANNOTATION = /<<|\{/y;
/** a line that starts like an element line with an id (`G1`, `TX`) */
const ELEMENT_START = /[GTR](?:[0-9]|X)/y;
const KEY = /[A-Za-z][A-Za-z0-9_]*/y;
const AFTER_KEY = /[ \t]+/y;
const PROPERTY_VALUE = /[^\s](?:[^\r\n]*[^\s])?/y;

const at = (pattern: RegExp, text: string, offset: number) => {
  pattern.lastIndex = offset;
  return pattern.exec(text)?.[0];
};

export class GoalLexer extends DefaultLexer {
  /** Where the next `tokenize` starts (reset after each call). */
  start: LexerStart = 'document';

  override tokenize(text: string): LexerResult {
    const tokens: IToken[] = [];
    const hidden: IToken[] = [];
    const errors: ILexingError[] = [];
    const start = this.start;
    this.start = 'document';
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

    if (start === 'assertion' || start in VALUES) {
      const set =
        start === 'assertion'
          ? ASSERTION
          : VALUES[start as keyof typeof VALUES];
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
      return { tokens, hidden, errors };
    }

    const document = start === 'document' || start === 'plainDocument';
    const plain = start === 'plainDocument' || start === 'annotatedName';
    let state: LineState | 'property' = 'lead';
    // spaces before the id are hidden only after an annotation (RTRegex.g4
    // read a leading space as part of a WORD)
    let annotated = false;
    let lineStart = true;

    while (offset < text.length) {
      const lineBreak = at(LINE_BREAK, text, offset);
      if (lineBreak) {
        push('NL', lineBreak);
        state = 'lead';
        annotated = false;
        lineStart = true;
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
          !at(ELEMENT_START, text, offset) &&
          at(KEY, text, offset)
        ) {
          push('KEY', at(KEY, text, offset)!);
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
        const id = at(PLAIN_ID, text, offset);
        if (id) {
          const [, prefix, rest] = /^([GTR])(\S+?)\s*:$/.exec(id)!;
          push(prefix!, prefix!);
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
      const best = longest(LINE_RULES[state]);
      if (!best) {
        unrecognized();
        continue;
      }
      push(best.name, best.image);
      if (state === 'stereotype' && best.name === '>>') {
        state = 'lead';
        annotated = true;
      } else if (state === 'tag' && best.name === '}') {
        state = 'lead';
        annotated = true;
      } else if (state === 'rt' && best.name === '{') state = 'declaration';
      else if (state === 'declaration' && best.name === '}') state = 'rt';
    }
    return { tokens, hidden, errors };
  }
}
