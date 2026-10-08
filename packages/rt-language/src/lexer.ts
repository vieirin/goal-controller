import {
  createTokenInstance,
  type ILexingError,
  type IToken,
} from 'chevrotain';
import { DefaultLexer, type LexerResult } from 'langium';

/**
 * Token rules in ANTLR's definition order (RTRegex.g4: implicit literals first,
 * then the lexer rules). ANTLR picks the longest match and breaks ties by this
 * order; Chevrotain picks the first match, so RtLexer scans by hand to keep the
 * edgeV2 tokenization: `Goal` is one WORD, `G1` is `G` + FLOAT, a space is part
 * of a WORD (so `[G1; G2]` is an error), `->` beats the `-` of a WORD.
 *
 * `,` is an ANTLR token (`G1, expr`) that this grammar does not support; like
 * any other unknown character it is reported as a lexing error.
 */
const RULES: ReadonlyArray<readonly [name: string, pattern: RegExp]> = [
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
];

const HIDDEN = new Set(['LINEBREAK', 'WS']);

export class RtLexer extends DefaultLexer {
  override tokenize(text: string): LexerResult {
    const tokens: IToken[] = [];
    const hidden: IToken[] = [];
    const errors: ILexingError[] = [];
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

    while (offset < text.length) {
      let best: { name: string; image: string } | null = null;
      for (const [name, pattern] of RULES) {
        pattern.lastIndex = offset;
        const match = pattern.exec(text);
        if (match && (!best || match[0].length > best.image.length)) {
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
      const tokenType = this.definition[best.name]!;
      // chevrotain positions: 1-based lines/columns, inclusive ends
      const startLine = line;
      const startColumn = column;
      const startOffset = offset;
      advance(best.image);
      const token = createTokenInstance(
        tokenType,
        best.image,
        startOffset,
        offset - 1,
        startLine,
        line,
        startColumn,
        column - 1,
      );
      (HIDDEN.has(best.name) ? hidden : tokens).push(token);
    }
    return { tokens, hidden, errors };
  }
}
