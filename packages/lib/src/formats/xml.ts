/**
 * A small XML reader for a project's XML resources (MutRoSe's world
 * knowledge, first): elements, attributes and text, with their offsets (tag
 * names, closing tags, text and attribute values too), and what is wrong
 * with the text. No DOM: it runs in Node, the browser and the language
 * server's worker alike. No DTDs, namespaces or CDATA, which the resources
 * don't use.
 */

import { buildAst, type XMLElement as AstElement } from '@xml-tools/ast';
import { parse, type DocumentCstNode } from '@xml-tools/parser';

export type XmlElement = {
  name: string;
  attributes: Record<string, string>;
  children: XmlElement[];
  /** its text, trimmed (an element with children has none) */
  text: string;
  from: number;
  to: number;
  /** its tag name's range in the closing tag (`</name>`), when it has one */
  closeName?: Range;
  /** the range of its trimmed text, when it has text and no children */
  textRange?: Range;
  /** each attribute's name and value ranges (the value's without its quotes) */
  attributeRanges: Record<string, { name: Range; value: Range }>;
  /** where its content starts (after the opening tag) and ends (before the closing one) */
  contentFrom: number;
  contentTo: number;
};

export type Range = { from: number; to: number };

export type XmlProblem = { message: string; from: number; to: number };

const ENTITIES: Record<string, string> = {
  lt: '<',
  gt: '>',
  amp: '&',
  quot: '"',
  apos: "'",
};

const decode = (text: string): string =>
  text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, entity: string) =>
    entity.startsWith('#x')
      ? String.fromCodePoint(parseInt(entity.slice(2), 16))
      : entity.startsWith('#')
        ? String.fromCodePoint(Number(entity.slice(1)))
        : (ENTITIES[entity] ?? whole),
  );

/** Where a document's tokens are: chevrotain's ends are inclusive. */
const rangeOf = (token: { startOffset: number; endOffset: number }): Range => ({
  from: token.startOffset,
  to: token.endOffset + 1,
});

/** A content's text: its comments and processing instructions left out, entities decoded. */
const contentText = (raw: string): string =>
  decode(raw.replace(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>/g, '')).trim();

/**
 * The document's root element (null when there is none), and its problems.
 * Read with `@xml-tools/parser` and `@xml-tools/ast` (error-tolerant, with
 * ranges for every token); the problems are said as the workbench says
 * them.
 */
export const readXml = (
  text: string,
): { root: XmlElement | null; problems: XmlProblem[] } => {
  const { cst, tokenVector, lexErrors, parseErrors } = parse(text);
  const document = buildAst(cst as DocumentCstNode, tokenVector);
  const problems: XmlProblem[] = lexErrors.map((error) => ({
    message: `Not XML: ${error.message}`,
    from: error.offset,
    to: error.offset + error.length,
  }));

  const read = (element: AstElement): XmlElement => {
    const name = element.name ?? '';
    const { openName, closeName, openBody, closeBody, isSelfClosing } =
      element.syntax;
    const from = element.position.startOffset;
    const to = element.position.endOffset + 1;
    const contentFrom = openBody ? openBody.endOffset + 1 : to;
    const contentTo = closeBody ? closeBody.startOffset : to;
    if (closeName && closeName.image !== name)
      problems.push({
        message: `</${closeName.image}> closes <${name}>`,
        ...(closeBody ? rangeOf(closeBody) : rangeOf(closeName)),
      });
    else if (!closeName && !isSelfClosing)
      problems.push({
        message: `<${name}> is not closed`,
        from,
        to: openName ? openName.endOffset + 1 : from + 1,
      });
    const attributes: Record<string, string> = {};
    const attributeRanges: XmlElement['attributeRanges'] = {};
    for (const attribute of element.attributes) {
      if (!attribute.key || !attribute.syntax.key) continue;
      attributes[attribute.key] = decode(attribute.value ?? '');
      const value = attribute.syntax.value;
      attributeRanges[attribute.key] = {
        name: rangeOf(attribute.syntax.key),
        // without its quotes
        value: value
          ? { from: value.startOffset + 1, to: value.endOffset }
          : rangeOf(attribute.syntax.key),
      };
    }
    const children = element.subElements.map(read);
    const raw = children.length ? '' : text.slice(contentFrom, contentTo);
    const content = contentText(raw);
    const lead = raw.length - raw.trimStart().length;
    return {
      name,
      attributes,
      children,
      text: content,
      from,
      to,
      ...(closeName && { closeName: rangeOf(closeName) }),
      ...(content && {
        textRange: {
          from: contentFrom + lead,
          to: contentFrom + raw.trimEnd().length,
        },
      }),
      attributeRanges,
      contentFrom,
      contentTo,
    };
  };
  const root = document.rootElement ? read(document.rootElement) : null;

  // what is after the root element: a second one
  for (const error of parseErrors) {
    const at = error.token.startOffset;
    // at the end of the text: what isn't closed, said above
    if (Number.isNaN(at)) continue;
    if (!/EOF/.test(error.message) || text[at] !== '<') {
      problems.push({
        message: `Not well-formed XML at ${JSON.stringify(error.token.image)}`,
        from: at,
        to: (error.token.endOffset ?? at) + 1,
      });
      continue;
    }
    {
      const name = /^<([A-Za-z_][\w.:-]*)/.exec(text.slice(at))?.[1] ?? '';
      problems.push({
        message: `<${name}>: a document has one root element`,
        from: at,
        to: at + name.length + 1,
      });
    }
  }
  if (!root && !problems.length)
    problems.push({ message: 'No root element', from: 0, to: text.length });
  return { root, problems };
};
