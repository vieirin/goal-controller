/**
 * A plain tokenizer for the LTL formula value (../ast.ts): no Langium rule,
 * since `formula` is a schema-level value (a `ValueConfig` tagged with a
 * language, dialect/src/schema.ts:228), not one of the goal-language's
 * generic `ValueType`s (../catalog.ts) that the shared Langium grammar
 * parses. The sugar surface's words and RE'01's symbols tokenize alike: an
 * identifier (a hyphen is a name character, so `sooner-or-later` is one
 * token, matching the sugar grammar's own name terminal), a number, a
 * quoted string, or one symbol/punctuation character (ASCII or the
 * Unicode operators).
 */

export type LtlTokenType = 'id' | 'number' | 'string' | 'symbol' | 'eof';

export interface LtlToken {
  readonly type: LtlTokenType;
  readonly text: string;
  readonly pos: number;
}

const ID_START = /[A-Za-z_$]/;
const ID_PART = /[A-Za-z0-9_$-]/;

/** two-character ASCII operators the lexer must not split */
const TWO_CHAR_SYMBOLS = ['==', '!=', '>=', '<='];

/** every Unicode LTL operator/punctuation symbol, one token each */
const UNICODE_SYMBOLS = new Set([
  '∀',
  '∃',
  '⇒',
  '⇔',
  '∧',
  '∨',
  '¬',
  '○',
  '●',
  '◇',
  '♦',
  '□',
  '■',
  '·',
  '∙',
  '≤',
  '≥',
]);

export const tokenize = (text: string): LtlToken[] => {
  const tokens: LtlToken[] = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const start = i;
    if (ID_START.test(c)) {
      i++;
      while (i < n && ID_PART.test(text[i]!)) i++;
      tokens.push({ type: 'id', text: text.slice(start, i), pos: start });
      continue;
    }
    if (/[0-9]/.test(c)) {
      i++;
      while (i < n && /[0-9]/.test(text[i]!)) i++;
      if (text[i] === '.' && /[0-9]/.test(text[i + 1] ?? '')) {
        i++;
        while (i < n && /[0-9]/.test(text[i]!)) i++;
      }
      tokens.push({ type: 'number', text: text.slice(start, i), pos: start });
      continue;
    }
    if (c === '"') {
      i++;
      while (i < n && text[i] !== '"') i++;
      i++; // the closing quote, or EOF: the parser reports the unterminated string
      tokens.push({ type: 'string', text: text.slice(start, i), pos: start });
      continue;
    }
    const two = text.slice(i, i + 2);
    if (TWO_CHAR_SYMBOLS.includes(two)) {
      tokens.push({ type: 'symbol', text: two, pos: start });
      i += 2;
      continue;
    }
    if (UNICODE_SYMBOLS.has(c) || '(),.:;@=<>[]'.includes(c)) {
      tokens.push({ type: 'symbol', text: c, pos: start });
      i++;
      continue;
    }
    tokens.push({ type: 'symbol', text: c, pos: start });
    i++;
  }
  tokens.push({ type: 'eof', text: '', pos: n });
  return tokens;
};
