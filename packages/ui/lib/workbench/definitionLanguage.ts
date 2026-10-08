/**
 * Highlighting from an engine definition: the Notation view's document (element
 * lines, the notation inside its delimiters, declarations, property lines) and
 * the value languages property fields are written in. Nothing here knows an
 * engine: every token comes from the definition.
 */
import { StreamLanguage, type StreamParser } from '@codemirror/language';
import type { StringStream } from '@codemirror/language';
import {
  elementIdPattern,
  operandPattern,
  type EngineDefinition,
  type LanguageDefinition,
  type ValueConfig,
} from '@goal-controller/definitions';

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A regex matching any of the texts, longest first, at the stream's position. */
const anyOf = (texts: readonly string[]): RegExp | null =>
  texts.length
    ? new RegExp(
        `^(?:${[...texts]
          .sort((a, b) => b.length - a.length)
          .map(escape)
          .join('|')})`,
      )
    : null;

/** Tokens of a value language (an assertion): one token per call. */
const languageToken = (language: LanguageDefinition) => {
  const operators = anyOf([
    ...language.comparators,
    ...language.operators.map((op) => op.symbol),
  ]);
  const parens = anyOf(language.parens);
  const keywords = new RegExp(
    `^(?:${language.keywords.map(escape).join('|')})(?![\\w])`,
  );
  const literals = Object.values(language.literals).map(
    (source) => new RegExp(`^(?:${source})(?![\\w])`),
  );
  const identifier = new RegExp(`^${language.identifier}`);
  return (stream: StringStream): string | null => {
    if (language.keywords.length && stream.match(keywords)) return 'atom';
    if (literals.some((literal) => stream.match(literal))) return 'number';
    if (stream.match(identifier)) return 'variableName';
    if (operators && stream.match(operators)) return 'operator';
    if (parens && stream.match(parens)) return 'paren';
    stream.next();
    return null;
  };
};

/** Tokens of any value config (a field, or a property line's value). */
const valueToken = (
  definition: Pick<EngineDefinition, 'languages' | 'elements'>,
  value: ValueConfig | undefined,
) => {
  if (value?.type === 'expression') {
    const language = definition.languages[value.language];
    if (language) return languageToken(language);
  }
  const ids = new RegExp(`^(?:${elementIdPattern(definition)})`);
  return (stream: StringStream): string | null => {
    if (value?.type === 'refList' && stream.match(ids)) return 'labelName';
    if (value?.type === 'pairList' || value?.type === 'refList') {
      if (stream.match(/^[^\s,:]+/))
        return /^-?\d/.test(stream.current()) ? 'number' : 'variableName';
      stream.next();
      return 'punctuation';
    }
    if (stream.match(/^-?\d+(?:\.\d+)?(?![\w])/)) return 'number';
    stream.skipToEnd();
    return 'string';
  };
};

/** The value config a property line's key has (the first operand kind declaring it). */
const lineValue = (
  definition: Pick<EngineDefinition, 'properties' | 'notation'>,
  key: string,
): ValueConfig | undefined => {
  for (const kind of definition.notation.operand.kinds) {
    const value = definition.properties[kind].find((p) => p.key === key)?.value;
    if (value) return 'when' in value ? value.otherwise : value;
  }
  return undefined;
};

type DocumentState = {
  part: 'start' | 'name' | 'notation' | 'declaration' | 'value';
  value: ((stream: StringStream) => string | null) | null;
};

/** The Notation view's document language. */
export const documentLanguage = (definition: EngineDefinition) => {
  const id = new RegExp(`^(?:${elementIdPattern(definition)})`);
  const operand = new RegExp(`^(?:${operandPattern(definition)})`);
  const line = Object.values(definition.elements)[0]?.line ?? '';
  const separator = line
    .slice(line.indexOf('{id}') + 4, line.indexOf('{name}'))
    .trim();
  const [open, close] = definition.notation.delimiters;
  const [declOpen, declClose] = definition.declaration.delimiters;
  const keywords = anyOf(definition.notation.operand.keywords);
  const operators = anyOf(definition.notation.operators.map((o) => o.symbol));
  const key = new RegExp(
    `^(?:${definition.propertyLineOrder.map(escape).join('|')})(?![\\w])`,
  );
  const literals = anyOf(
    definition.declaration.parts.flatMap(function literalsOf(part): string[] {
      return 'literal' in part
        ? part.literal.trim()
          ? [part.literal.trim()]
          : []
        : 'optional' in part
          ? part.optional.flatMap(literalsOf)
          : [];
    }),
  );
  const nameStop = new RegExp(`^[^${escape(open)}${escape(declOpen)}]+`);

  const parser: StreamParser<DocumentState> = {
    name: definition.id,
    startState: () => ({ part: 'start', value: null }),
    token(stream, state) {
      if (stream.sol()) {
        state.part = 'start';
        state.value = null;
      }
      if (stream.eatSpace()) return null;
      switch (state.part) {
        case 'start': {
          if (stream.match(id)) {
            state.part = 'name';
            return 'labelName';
          }
          const matched = stream.match(key);
          if (matched) {
            state.part = 'value';
            state.value = valueToken(
              definition,
              lineValue(definition, stream.current()),
            );
            return 'propertyName';
          }
          stream.skipToEnd();
          return null;
        }
        case 'name':
          if (separator && stream.match(separator)) return 'punctuation';
          if (stream.match(open)) {
            state.part = 'notation';
            return 'bracket';
          }
          if (stream.match(declOpen)) {
            state.part = 'declaration';
            return 'brace';
          }
          stream.match(nameStop);
          return 'string';
        case 'notation':
          if (stream.match(close)) {
            state.part = 'name';
            return 'bracket';
          }
          if (stream.match(operand)) return 'labelName';
          if (keywords && stream.match(keywords)) return 'keyword';
          if (operators && stream.match(operators)) return 'operator';
          if (stream.match(/^\d+/)) return 'number';
          stream.next();
          return null;
        case 'declaration':
          if (stream.match(declClose)) {
            state.part = 'name';
            return 'brace';
          }
          if (literals && stream.match(literals)) return 'operator';
          if (stream.match(/^-?\d+/)) return 'number';
          if (stream.match(/^[A-Za-z_]\w*/)) return 'typeName';
          stream.next();
          return null;
        case 'value':
          return state.value ? state.value(stream) : (stream.next(), null);
      }
    },
  };
  return StreamLanguage.define(parser);
};

/** A property field's language, when its value config has one. */
export const valueLanguage = (
  definition: Pick<EngineDefinition, 'languages' | 'elements'>,
  value: ValueConfig,
) => {
  const token = valueToken(definition, value);
  return StreamLanguage.define<null>({
    name: value.type,
    startState: () => null,
    token: (stream) => (stream.eatSpace() ? null : token(stream)),
  });
};
