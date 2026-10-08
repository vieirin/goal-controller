import {
  createTokenInstance,
  type ILexingError,
  type IToken,
} from 'chevrotain';
import { DefaultLexer, type LexerResult } from 'langium';
import { PROPERTY_MODES, type RtPropertyKey } from './properties.js';

type Rules = ReadonlyArray<readonly [name: string, pattern: RegExp]>;

/**
 * RT text, in ANTLR's definition order (RTRegex.g4: implicit literals first, then
 * the lexer rules). ANTLR picks the longest match and breaks ties by this order;
 * Chevrotain picks the first match, so RtLexer scans by hand to keep the edgeV2
 * tokenization: `Goal` is one WORD, `G1` is `G` + FLOAT, a space is part of a WORD
 * (so `[G1; G2]` is an error), `->` beats the `-` of a WORD.
 *
 * `,` is an ANTLR token (`G1, expr`) that this grammar does not support; like any
 * other unknown character it is reported as a lexing error. `{` opens a resource
 * declaration (not RTRegex.g4: a goal name never contains one).
 */
const RT_RULES: Rules = [
  ['G', /G/y],
  ['T', /T/y],
  ['R', /R/y],
  ['[', /\[/y],
  [']', /\]/y],
  [':', /:/y],
  ['@', /@/y],
  ['|', /\|/y],
  ['?', /\?/y],
  ['+', /\+/y],
  ['#', /#/y],
  [';', /;/y],
  ['->', /->/y],
  ['DIGIT_SUBID', /[0-9][a-z]/y],
  ['FLOAT', /[0-9]+\.?[0-9]*/y],
  ['skip', /skip/y],
  ['X', /X/y],
  // ANTLR's NEWLINE has no parser use (a goal name is one line); in a
  // multi-line document it separates lines and swallows the indentation
  ['LINEBREAK', /[\r\n]+[ \t]*/y],
  ['WORD', /[A-Za-z\- ']+/y],
  ['WS', /\t+/y],
  ['{', /\{/y],
];

/** AssertionRegex.g4, in its definition order (its WS also skips line breaks). */
const ASSERTION_RULES: Rules = [
  ['&', /&/y],
  ['|', /\|/y],
  ['!', /!/y],
  ['(', /\(/y],
  [')', /\)/y],
  ['=', /=/y],
  ['!=', /!=/y],
  ['<', /</y],
  ['<=', /<=/y],
  ['>', />/y],
  ['>=', />=/y],
  ['true', /true/y],
  ['false', /false/y],
  ['A_ID', /[a-zA-Z_][a-zA-Z0-9_]*/y],
  ['A_INT', /[1-9][0-9]*/y],
  ['WS', /[ \t\r\n]+/y],
];

/** dependsOn: RT ids separated by commas (the mapper splits on `,` and trims). */
const DEPENDS_ON_RULES: Rules = [
  ['G', /G/y],
  ['T', /T/y],
  ['R', /R/y],
  [',', /,/y],
  ['DIGIT_SUBID', /[0-9][a-z]/y],
  ['FLOAT', /[0-9]+\.?[0-9]*/y],
  ['X', /X/y],
  ['WS', /[ \t\r\n]+/y],
];

/** A resource declaration between `{` and `}`. */
const DECL_RULES: Rules = [
  ['}', /\}/y],
  ['..', /\.\./y],
  ['=', /=/y],
  ['DECL_NUM', /-?[0-9]+/y],
  ['DECL_WORD', /[A-Za-z_][A-Za-z0-9_]*/y],
  ['WS', /[ \t]+/y],
];

/** Any other property value: the rest of the line, checked by the engine's checks. */
const VALUE_RULES: Rules = [
  ['WS', /[ \t\r\n]+/y],
  ['VALUE', /[^ \t\r\n](?:[^\r\n]*[^\r\n \t])?/y],
];

const MODES = {
  rt: RT_RULES,
  assertion: ASSERTION_RULES,
  dependsOn: DEPENDS_ON_RULES,
  decl: DECL_RULES,
  value: VALUE_RULES,
} as const;

export type RtLexerMode = keyof typeof MODES;

const PROPERTY_KEY = new RegExp(
  `(${Object.keys(PROPERTY_MODES).join('|')})(?![A-Za-z0-9_])`,
  'y',
);

const HIDDEN = new Set(['LINEBREAK', 'WS']);
const LINE_BREAK = /[\r\n]+[ \t]*/y;

export class RtLexer extends DefaultLexer {
  /**
   * Where the next `tokenize` starts: `rt` for a document, a value mode to read
   * one property value on its own. Reset after each call.
   */
  startMode: RtLexerMode = 'rt';

  override tokenize(text: string): LexerResult {
    const tokens: IToken[] = [];
    const hidden: IToken[] = [];
    const errors: ILexingError[] = [];
    const startMode = this.startMode;
    this.startMode = 'rt';
    // a single value: line breaks belong to it; a document: they end a line
    const singleValue = startMode !== 'rt';
    let mode: RtLexerMode = startMode;
    let lineStart = !singleValue;
    let propertyLine = false;
    let offset = 0;
    let line = 1;
    let column = 1;

    const advance = (image: string) => {
      for (const ch of image) {
        if (ch === '\n') {
          line++;
          column = 1;
        } else {
          column++;
        }
      }
      offset += image.length;
    };
    const push = (name: string, image: string) => {
      const tokenType = this.definition[name]!;
      // chevrotain positions: 1-based lines/columns, inclusive ends
      const startLine = line;
      const startColumn = column;
      const startOffset = offset;
      advance(image);
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

    while (offset < text.length) {
      if (!singleValue) {
        // a line break ends any property or declaration line
        LINE_BREAK.lastIndex = offset;
        const lineBreak = LINE_BREAK.exec(text);
        if (lineBreak) {
          // ends a property line for the parser too (an empty value stops here)
          push(propertyLine ? 'EOL' : 'LINEBREAK', lineBreak[0]);
          mode = 'rt';
          propertyLine = false;
          lineStart = true;
          continue;
        }
        if (lineStart) {
          lineStart = false;
          PROPERTY_KEY.lastIndex = offset;
          const key = PROPERTY_KEY.exec(text)?.[0] as RtPropertyKey | undefined;
          if (key) {
            push(key, key);
            mode = PROPERTY_MODES[key];
            propertyLine = true;
            continue;
          }
        }
      }

      let best: { name: string; image: string } | null = null;
      for (const [name, pattern] of MODES[mode]) {
        pattern.lastIndex = offset;
        const match = pattern.exec(text);
        if (match?.[0] && (!best || match[0].length > best.image.length)) {
          best = { name, image: match[0] };
        }
      }
      if (!best) {
        errors.push({
          offset,
          line,
          column,
          length: 1,
          message: `token recognition error at: '${text[offset]}'`,
        });
        advance(text[offset]!);
        continue;
      }
      push(best.name, best.image);
      if (best.name === '{') mode = 'decl';
      else if (best.name === '}') mode = 'rt';
    }
    return { tokens, hidden, errors };
  }
}
