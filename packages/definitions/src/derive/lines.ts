/**
 * The line syntax of the Notation view, from a definition: element lines
 * (with their notation or declaration), and property lines under them.
 */
import type {
  DeclarationDefinition,
  DeclarationPart,
  ElementKind,
  EngineDefinition,
} from '../schema';

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type Lines = Pick<
  EngineDefinition,
  'elements' | 'notation' | 'propertyLine' | 'propertyLineOrder'
>;

// every kind of a definition shares one element line
const lineTemplate = (
  definition: Pick<EngineDefinition, 'elements'>,
): string => {
  const line = Object.values(definition.elements)[0]?.line;
  if (!line) throw new Error('a definition needs an element');
  return line;
};

/** The text between `{id}` and `{name}` in the element line. */
const idSeparator = (
  definition: Pick<EngineDefinition, 'elements'>,
): string => {
  const line = lineTemplate(definition);
  return line.slice(line.indexOf('{id}') + 4, line.indexOf('{name}'));
};

/** An element's line, its notation in the delimiters, plus a declaration if any. */
export const elementLine = (
  definition: Pick<EngineDefinition, 'elements' | 'notation'>,
  parts: { id: string; name: string; notation: string | null },
  declaration?: string | null,
): string => {
  const base = lineTemplate(definition)
    .replace('{id}', parts.id)
    .replace('{name}', parts.name.trim());
  const [open, close] = definition.notation.delimiters;
  const line =
    parts.notation && parts.notation.trim()
      ? `${base} ${open}${parts.notation.trim()}${close}`
      : base;
  return declaration ? `${line} ${declaration}` : line;
};

/** The id a line starts with (indentation ignored), if any. */
export const lineId = (
  definition: Pick<EngineDefinition, 'elements' | 'notation'>,
  line: string,
): string | null => {
  const separator = idSeparator(definition).trim();
  const [open, close] = definition.notation.delimiters;
  const stop = escape(`${separator}${open}${close}`);
  return (
    new RegExp(`^\\s*([^\\s${stop}]+)\\s*${escape(separator)}`).exec(
      line,
    )?.[1] ?? null
  );
};

/** Any element's id, as a regex source. */
export const elementIdPattern = (
  definition: Pick<EngineDefinition, 'elements'>,
): string =>
  Object.values(definition.elements)
    .map((element) => `${escape(element.prefix)}${element.idPattern}`)
    .join('|');

/** An element line's id, name and notation, as the view reads them. */
export const readElementLine = (
  definition: Pick<EngineDefinition, 'elements' | 'notation'>,
  line: string,
): { id: string; name: string; notation: string | null } | null => {
  const separator = escape(idSeparator(definition).trim());
  const [open, close] = definition.notation.delimiters.map(escape);
  const match = new RegExp(
    `^\\s*(${elementIdPattern(definition)})\\s*${separator}\\s*(.*?)\\s*(?:${open}(.*)${close})?\\s*$`,
    's',
  ).exec(line);
  return match
    ? {
        id: match[1]!,
        name: match[2]!,
        notation: match[3] !== undefined ? match[3].trim() : null,
      }
    : null;
};

/** The keys property lines may have (every operand kind alike), in line order. */
export const lineKeys = (definition: Pick<Lines, 'propertyLineOrder'>) =>
  definition.propertyLineOrder;

/** A property line's text: key, separator, value. */
export const propertyLine = (
  definition: Pick<Lines, 'propertyLine'>,
  key: string,
  value: string,
): string =>
  value.trim()
    ? `${key}${definition.propertyLine.separator}${value.trim()}`
    : key;

/** A property line's key and value, if the line is one (indentation ignored). */
export const readPropertyLine = (
  definition: Pick<Lines, 'propertyLine' | 'propertyLineOrder'>,
  line: string,
): { key: string; value: string } | null => {
  const match = new RegExp(
    `^\\s*(${definition.propertyLine.keyPattern})(?:[ \\t]+(.*?))?\\s*$`,
  ).exec(line);
  return match && definition.propertyLineOrder.includes(match[1]!)
    ? { key: match[1]!, value: match[2] ?? '' }
    : null;
};

/** The declaration a kind's line carries, if its element declares one. */
export const declarationOf = (
  definition: Pick<EngineDefinition, 'elements'>,
  kind: ElementKind,
): DeclarationDefinition | undefined =>
  (definition.elements as EngineDefinition['elements'])[kind]?.declaration;

/** The properties a declaration sets, in its order. */
export const declarationKeys = (
  declaration: DeclarationDefinition,
): string[] => {
  const keys = (parts: readonly DeclarationPart[]): string[] =>
    parts.flatMap((part) =>
      'key' in part
        ? [part.key]
        : 'optional' in part
          ? keys(part.optional)
          : [],
    );
  return keys(declaration.parts);
};

export type DeclaredProperties = Partial<Record<string, string>>;

/**
 * A declaration from the properties it sets (null when a property it always
 * writes is unset: there is nothing to declare).
 */
export const writeDeclaration = (
  declaration: DeclarationDefinition,
  properties: DeclaredProperties,
): string | null => {
  const write = (parts: readonly DeclarationPart[]): string | null => {
    let text = '';
    for (const part of parts) {
      if ('literal' in part) text += part.literal;
      else if ('key' in part) {
        const value = properties[part.key];
        if (value === undefined) return null;
        text += value;
      } else text += write(part.optional) ?? '';
    }
    return text;
  };
  const [open, close] = declaration.delimiters;
  const body = write(declaration.parts);
  // the first property is what is declared: without it there is nothing
  const [first] = declarationKeys(declaration);
  return body !== null && first !== undefined && properties[first]
    ? `${open}${body}${close}`
    : null;
};

/** A declaration's regex: literals read with any whitespace around them. */
const declarationPattern = (parts: readonly DeclarationPart[]): string =>
  parts
    .map((part) =>
      'key' in part
        ? `(${part.pattern})`
        : 'literal' in part
          ? part.literal.trim()
            ? `\\s*${escape(part.literal.trim())}\\s*`
            : '\\s+'
          : `(?:${declarationPattern(part.optional)})?`,
    )
    .join('');

/**
 * Splits an element line into its text and its declaration; the declaration
 * is null when the line has none or it cannot be read (`declared` tells which).
 */
export const readDeclaration = (
  declaration: DeclarationDefinition,
  line: string,
): {
  text: string;
  properties: DeclaredProperties | null;
  declared: boolean;
} => {
  const [open, close] = declaration.delimiters.map(escape);
  const match = new RegExp(`^(.*?)\\s*${open}([^${close}]*)${close}\\s*$`).exec(
    line,
  );
  if (!match) return { text: line.trim(), properties: null, declared: false };
  const decl = new RegExp(
    `^\\s*${declarationPattern(declaration.parts)}\\s*$`,
  ).exec(match[2]!);
  return {
    text: match[1]!.trim(),
    declared: true,
    properties: decl
      ? Object.fromEntries(
          declarationKeys(declaration).map((key, i) => [key, decl[i + 1]]),
        )
      : null,
  };
};

/** Whether a name only uses the characters the kind's names may (an unknown kind: any). */
export const isValidName = (
  definition: Pick<EngineDefinition, 'elements'>,
  kind: ElementKind,
  name: string,
): boolean => {
  const element = (definition.elements as EngineDefinition['elements'])[kind];
  return !element || new RegExp(`^${element.nameCharset}*$`).test(name);
};
