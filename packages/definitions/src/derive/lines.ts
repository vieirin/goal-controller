/**
 * The line syntax of the Notation view, from a definition: element lines
 * (with their notation or declaration), and property lines under them.
 */
import {
  declarationKeys,
  type DeclarationDefinition,
  type DeclarationPart,
  type ElementKind,
  type EngineDefinition,
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

/**
 * An element's line, its notation in the delimiters, plus a declaration if
 * any, after its annotations if any.
 */
export const elementLine = (
  definition: Pick<EngineDefinition, 'elements' | 'notation'>,
  parts: { id: string; name: string; notation: string | null },
  declaration?: string | null,
  annotations?: string | null,
): string => {
  const base = lineTemplate(definition)
    .replace('{id}', parts.id)
    .replace('{name}', parts.name.trim());
  const [open, close] = definition.notation.delimiters;
  const line =
    parts.notation && parts.notation.trim()
      ? `${base} ${open}${parts.notation.trim()}${close}`
      : base;
  const declared = declaration ? `${line} ${declaration}` : line;
  return annotations ? `${annotations} ${declared}` : declared;
};

/** The annotations a kind's line starts with (none if it declares none). */
export const annotationsOf = (
  definition: Pick<EngineDefinition, 'elements'>,
  kind: ElementKind,
): readonly DeclarationDefinition[] =>
  (definition.elements as EngineDefinition['elements'])[kind]?.annotations ??
  [];

/**
 * One annotation group of any kind's, at the start of a text: the line's
 * kind is not known before its id, so every kind's delimiters are tried.
 */
const annotationGroup = (
  definition: Pick<EngineDefinition, 'elements'>,
): RegExp | null => {
  const groups = new Set(
    Object.values(definition.elements as EngineDefinition['elements']).flatMap(
      (element) =>
        (element?.annotations ?? []).map(({ delimiters: [open, close] }) => {
          const [o, c] = [escape(open), escape(close)];
          return `${o}[^${c}]*${c}`;
        }),
    ),
  );
  return groups.size ? new RegExp(`^(\\s*)(${[...groups].join('|')})`) : null;
};

/**
 * A line's leading annotation groups (as written, where each starts) and the
 * rest of the line, from `offset` on (the whole line when it has none).
 */
export const splitAnnotations = (
  definition: Pick<EngineDefinition, 'elements'>,
  line: string,
): {
  groups: { text: string; from: number }[];
  rest: string;
  offset: number;
} => {
  const group = annotationGroup(definition);
  const groups: { text: string; from: number }[] = [];
  let offset = 0;
  for (let m = group?.exec(line); m; m = group!.exec(line.slice(offset))) {
    groups.push({ text: m[2]!, from: offset + m[1]!.length });
    offset += m[0].length;
  }
  return { groups, rest: line.slice(offset), offset };
};

/** The annotations a kind's line starts with, from the properties they set. */
export const writeAnnotations = (
  annotations: readonly DeclarationDefinition[],
  properties: DeclaredProperties,
): string | null =>
  annotations
    .map((annotation) => writeDeclaration(annotation, properties))
    .filter((text): text is string => text !== null)
    .join(' ') || null;

/**
 * What a line's annotation groups set: each group is read by the first of the
 * kind's annotations (not used yet) it reads with; `read` has what each group
 * sets, null for a group none reads.
 */
export const readAnnotations = (
  annotations: readonly DeclarationDefinition[],
  groups: readonly string[],
): { properties: DeclaredProperties; read: (DeclaredProperties | null)[] } => {
  const used = new Set<DeclarationDefinition>();
  const read = groups.map((group) => {
    for (const annotation of annotations) {
      const [open, close] = annotation.delimiters;
      if (
        used.has(annotation) ||
        !group.startsWith(open) ||
        !group.endsWith(close)
      )
        continue;
      const properties = readDeclarationBody(
        annotation,
        group.slice(open.length, group.length - close.length),
      );
      if (properties) {
        used.add(annotation);
        return properties;
      }
    }
    return null;
  });
  return { properties: Object.assign({}, ...read), read };
};

/** The id a line starts with (indentation and annotations ignored), if any. */
export const lineId = (
  definition: Pick<EngineDefinition, 'elements' | 'notation'>,
  written: string,
): string | null => {
  const line = splitAnnotations(definition, written).rest;
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

/** An element line's id, name and notation, as the view reads them (annotations ignored). */
export const readElementLine = (
  definition: Pick<EngineDefinition, 'elements' | 'notation'>,
  written: string,
): { id: string; name: string; notation: string | null } | null => {
  const line = splitAnnotations(definition, written).rest;
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

/** What a declaration's text between its delimiters sets, if it reads. */
const readDeclarationBody = (
  declaration: DeclarationDefinition,
  body: string,
): DeclaredProperties | null => {
  const decl = new RegExp(
    `^\\s*${declarationPattern(declaration.parts)}\\s*$`,
  ).exec(body);
  return decl
    ? Object.fromEntries(
        declarationKeys(declaration).map((key, i) => [key, decl[i + 1]]),
      )
    : null;
};

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
  return {
    text: match[1]!.trim(),
    declared: true,
    properties: readDeclarationBody(declaration, match[2]!),
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
