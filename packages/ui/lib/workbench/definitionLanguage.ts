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
  type DeclarationDefinition,
  type AnyDialect,
  type WithNotation,
  type LanguageDefinition,
  type ValueConfig,
} from '@goal-controller/dialect';

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
  definition: Pick<AnyDialect, 'languages' | 'elements'>,
  value: ValueConfig | undefined,
) => {
  if (value?.type === 'expression') {
    const language = definition.languages[value.language];
    if (language) return languageToken(language);
  }
  const idPattern = elementIdPattern(definition);
  const ids = idPattern === null ? null : new RegExp(`^(?:${idPattern})`);
  return (stream: StringStream): string | null => {
    if (value?.type === 'refList' && ids && stream.match(ids))
      return 'labelName';
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

/** The value config a property line's key has (the first listed kind declaring it). */
const lineValue = (
  definition: Pick<AnyDialect, 'properties' | 'elements'>,
  key: string,
): ValueConfig | undefined => {
  for (const [kind, element] of Object.entries(definition.elements)) {
    if (!element || element.declaration) continue;
    const value = definition.properties[kind]?.find(
      (p) => p.key === key,
    )?.value;
    if (value) return 'when' in value ? value.otherwise : value;
  }
  return undefined;
};

/** How a declaration reads: its delimiters and literals (as tokens). */
type DeclarationTokens = {
  open: string;
  close: string;
  literals: RegExp | null;
};

type DocumentState = {
  part: 'start' | 'annotation' | 'name' | 'notation' | 'declaration' | 'value';
  value: ((stream: StringStream) => string | null) | null;
  /** the declaration of the line's element, when its kind has one */
  declaration: DeclarationTokens | null;
  /** the annotation being read, before the line's id */
  annotation: DeclarationTokens | null;
};

const declarationTokens = (
  declaration: DeclarationDefinition,
): DeclarationTokens => ({
  open: declaration.delimiters[0],
  close: declaration.delimiters[1],
  literals: anyOf(
    declaration.parts.flatMap(function literalsOf(part): string[] {
      return 'literal' in part
        ? part.literal.trim()
          ? [part.literal.trim()]
          : []
        : 'optional' in part
          ? part.optional.flatMap(literalsOf)
          : [];
    }),
  ),
});

/** The Notation view's document tokens, line by line. */
export const documentParser = (
  definition: AnyDialect,
): StreamParser<DocumentState> => {
  // a definition whose lines name no element: each line starts with its name
  const idPattern = elementIdPattern(definition);
  const id = idPattern === null ? null : new RegExp(`^(?:${idPattern})`);
  const { notation } = definition;
  const operand = notation
    ? new RegExp(
        `^(?:${operandPattern({ ...definition, notation } as AnyDialect & WithNotation)})`,
      )
    : null;
  const line = Object.values(definition.elements)[0]?.line ?? '';
  const separator = id
    ? line.slice(line.indexOf('{id}') + 4, line.indexOf('{name}')).trim()
    : '';
  const [open, close] = notation?.delimiters ?? [null, null];
  // each kind's id, with the declaration its line carries (if any)
  const kinds = Object.values(definition.elements).map((element) => ({
    id: id
      ? new RegExp(`^${escape(element!.prefix!)}${element!.idPattern}$`)
      : null,
    declaration: element!.declaration
      ? declarationTokens(element!.declaration)
      : null,
  }));
  // any kind's annotations: the line's kind is not known before its id
  const annotations = [
    ...new Map(
      Object.values(definition.elements)
        .flatMap((element) => element?.annotations ?? [])
        .map((annotation) => [
          annotation.delimiters.join(' '),
          declarationTokens(annotation),
        ]),
    ).values(),
  ];
  const keywords = anyOf(notation?.operand.keywords ?? []);
  const operators = anyOf((notation?.operators ?? []).map((o) => o.symbol));
  const key = new RegExp(
    `^(?:${definition.propertyLineOrder.map(escape).join('|')})(?![\\w])`,
  );
  // a name runs up to the notation, or to its kind's declaration
  const nameStop = open ? new RegExp(`^[^${escape(open)}]+`) : /^.+/;
  const nameStops = new Map(
    kinds.flatMap(({ declaration }) =>
      declaration
        ? [
            [
              declaration,
              new RegExp(
                `^[^${open ? escape(open) : ''}${escape(declaration.open)}]+`,
              ),
            ] as const,
          ]
        : [],
    ),
  );

  return {
    name: definition.id,
    startState: () => ({
      part: 'start',
      value: null,
      declaration: null,
      annotation: null,
    }),
    token(stream, state) {
      if (stream.sol()) {
        state.part = 'start';
        state.value = null;
        state.declaration = null;
        state.annotation = null;
      }
      if (stream.eatSpace()) return null;
      switch (state.part) {
        case 'start': {
          const annotation = annotations.find((a) => stream.match(a.open));
          if (annotation) {
            state.part = 'annotation';
            state.annotation = annotation;
            return 'brace';
          }
          if (id) {
            if (stream.match(id)) {
              const written = stream.current();
              state.part = 'name';
              state.declaration =
                kinds.find((kind) => kind.id?.test(written))?.declaration ??
                null;
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
          state.part = 'name';
        }
        // falls through: a line that names no element starts with its name
        case 'name':
          if (separator && stream.match(separator)) return 'punctuation';
          if (open && stream.match(open)) {
            state.part = 'notation';
            return 'bracket';
          }
          if (state.declaration && stream.match(state.declaration.open)) {
            state.part = 'declaration';
            return 'brace';
          }
          if (
            !stream.match(
              (state.declaration && nameStops.get(state.declaration)) ||
                nameStop,
            )
          )
            stream.next();
          return 'string';
        case 'notation':
          if (close && stream.match(close)) {
            state.part = 'name';
            return 'bracket';
          }
          if (operand && stream.match(operand)) return 'labelName';
          if (keywords && stream.match(keywords)) return 'keyword';
          if (operators && stream.match(operators)) return 'operator';
          if (stream.match(/^\d+/)) return 'number';
          stream.next();
          return null;
        case 'declaration':
          if (stream.match(state.declaration!.close)) {
            state.part = 'name';
            return 'brace';
          }
          if (
            state.declaration!.literals &&
            stream.match(state.declaration!.literals)
          )
            return 'operator';
          if (stream.match(/^-?\d+/)) return 'number';
          if (stream.match(/^[A-Za-z_]\w*/)) return 'typeName';
          stream.next();
          return null;
        case 'annotation':
          if (stream.match(state.annotation!.close)) {
            state.part = 'start';
            return 'brace';
          }
          if (
            state.annotation!.literals &&
            stream.match(state.annotation!.literals)
          )
            return 'operator';
          stream.next();
          return 'meta';
        case 'value':
          return state.value ? state.value(stream) : (stream.next(), null);
      }
    },
  };
};

/** The Notation view's document language. */
export const documentLanguage = (definition: AnyDialect) =>
  StreamLanguage.define(documentParser(definition));

/** A property field's language, when its value config has one. */
export const valueLanguage = (
  definition: Pick<AnyDialect, 'languages' | 'elements'>,
  value: ValueConfig,
) => {
  const token = valueToken(definition, value);
  return StreamLanguage.define<null>({
    name: value.type,
    startState: () => null,
    token: (stream) => (stream.eatSpace() ? null : token(stream)),
  });
};
