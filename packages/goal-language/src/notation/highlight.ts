/**
 * What each part of a text is, for an editor's highlighting: the goal
 * language's tokens (GoalLexer's, no parse), named after the highlight tags
 * editors use (`labelName` an element id, `propertyName` a property key, ...).
 * An annotation's stereotype and tag values carry their text, so an editor can
 * give the same text the same colour.
 */
import {
  hasIds,
  valueOf,
  type AnyDialect,
  type ValueConfig,
} from '@goal-controller/dialect';
import type { IToken } from 'chevrotain';
import type { GoalLexer, LexerStart } from '../lexer.js';
import { ID_PREFIXES } from '../catalog.js';
import { goalServices } from '../parse.js';

export type HighlightStyle =
  | 'labelName'
  | 'propertyName'
  | 'string'
  | 'punctuation'
  | 'bracket'
  | 'brace'
  | 'paren'
  | 'operator'
  | 'keyword'
  | 'number'
  | 'typeName'
  | 'atom'
  | 'variableName'
  /** a stereotype's name: `goal-based` in `<<goal-based>>` */
  | 'stereotype'
  /** a tag's name: `type` in `{type = duty}` */
  | 'tagName'
  /** a tag's value: `duty` in `{type = duty}` */
  | 'tagValue';

export type Highlight = {
  from: number;
  to: number;
  style: HighlightStyle;
  /** a stereotype's or a tag value's text */
  text?: string;
};

const STYLE: Record<string, HighlightStyle> = {
  ':': 'punctuation',
  ',': 'punctuation',
  '[': 'bracket',
  ']': 'bracket',
  '(': 'paren',
  ')': 'paren',
  '{': 'brace',
  '}': 'brace',
  '<<': 'brace',
  '>>': 'brace',
  skip: 'keyword',
  true: 'atom',
  false: 'atom',
  WORD: 'string',
  PLAIN_NAME: 'string',
  KEY: 'propertyName',
  INTEGER: 'number',
  NUMBER: 'number',
  A_INT: 'number',
  FLOAT: 'number',
  A_ID: 'variableName',
  IDENT: 'variableName',
  PAIR_VALUE: 'number',
  VALUE: 'string',
};

const ID_PREFIX = new Set<string>(ID_PREFIXES);
const ID_REST = new Set(['FLOAT', 'X', 'DIGIT_SUBID']);

const tokensOf = (start: LexerStart, text: string): IToken[] => {
  const lexer = goalServices().parser.Lexer as GoalLexer;
  lexer.start = start;
  return lexer.tokenize(text).tokens;
};

const styled = (tokens: IToken[], offset = 0): Highlight[] => {
  const highlights: Highlight[] = [];
  let declaring = false;
  // in an annotation: a stereotype, a tag's name, or (after `=`) its value
  let annotation: 'stereotype' | 'tagName' | 'tagValue' | null = null;
  tokens.forEach((token, i) => {
    const name = token.tokenType.name;
    const span = {
      from: offset + token.startOffset,
      to: offset + token.startOffset + token.image.length,
    };
    const next = tokens[i + 1];
    const previous = tokens[i - 1];
    // an id is its prefix and what follows it, written together (`G1`)
    const idPart =
      (ID_PREFIX.has(name) &&
        next &&
        ID_REST.has(next.tokenType.name) &&
        next.startOffset === token.startOffset + 1) ||
      (ID_REST.has(name) &&
        previous &&
        ID_PREFIX.has(previous.tokenType.name) &&
        token.startOffset === previous.startOffset + 1);
    if (name === '{') declaring = true;
    else if (name === '}') declaring = false;
    if (name === '<<') annotation = 'stereotype';
    else if (name === '{') annotation = 'tagName';
    else if (name === '=' && annotation === 'tagName') annotation = 'tagValue';
    else if (name === '>>' || name === '}') annotation = null;
    if (name === 'TEXT' && annotation) {
      const style = annotation;
      highlights.push(
        style === 'tagName'
          ? { ...span, style }
          : { ...span, style, text: token.image },
      );
      return;
    }
    const style: HighlightStyle | undefined = idPart
      ? 'labelName'
      : declaring && name === 'IDENT' && previous?.tokenType.name === '{'
        ? 'typeName'
        : declaring && name === 'IDENT'
          ? 'atom'
          : (STYLE[name] ??
            (/^[^A-Za-z0-9]+$/.test(name) ? 'operator' : undefined));
    if (!style) return;
    const last = highlights.at(-1);
    // an id is one highlight (`G` and `1` are two tokens)
    if (idPart && last?.style === 'labelName' && last.to === span.from)
      last.to = span.to;
    else highlights.push({ ...span, style });
  });
  return highlights;
};

const START: Record<ValueConfig['type'], LexerStart> = {
  assertion: 'assertion',
  int: 'int',
  number: 'number',
  bool: 'bool',
  text: 'text',
  enum: 'enum',
  refList: 'refList',
  pairList: 'pairList',
  annotatedName: 'annotatedName',
};

/** A value of a type on its own (an inspector field). */
export const highlightValue = (
  value: ValueConfig,
  text: string,
  offset = 0,
): Highlight[] => styled(tokensOf(START[value.type], text), offset);

/** The value config a property line's key has (the first listed kind declaring it). */
const lineValue = (
  definition: Pick<AnyDialect, 'properties' | 'elements'>,
  key: string,
): ValueConfig | undefined => {
  for (const [kind, element] of Object.entries(definition.elements)) {
    if (!element || element.declares) continue;
    const property = definition.properties[kind]?.find((p) => p.key === key);
    if (property) return valueOf(property, {});
  }
  return undefined;
};

/** One line of a Notation view document; a property's value as its type reads. */
export const highlightLine = (
  definition: Pick<AnyDialect, 'properties' | 'elements'>,
  text: string,
): Highlight[] => {
  const tokens = tokensOf(
    hasIds(definition) ? 'document' : 'plainDocument',
    text,
  );
  const value = tokens.find((token) => token.tokenType.name === 'VALUE');
  const key = tokens.find((token) => token.tokenType.name === 'KEY');
  const config = key && lineValue(definition, key.image);
  if (!value || !config) return styled(tokens);
  return [
    ...styled(tokens.filter((token) => token !== value)),
    ...highlightValue(config, value.image, value.startOffset),
  ];
};
