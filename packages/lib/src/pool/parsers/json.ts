/**
 * JSON for a typed reader: jsonc-parser's tree (VS Code's parser), strict
 * JSON (no comments, no trailing commas). It reads past an error, so a file
 * being typed still has a tree. A string's span is its text, without quotes.
 * A key written twice: the last one is read (as JSON.parse does), and the
 * earlier ones are warnings.
 */
import { parseTree, printParseErrorCode, type ParseError } from 'jsonc-parser';
import type { Node, Parsed, ReadProblem } from '../read';

/** `PropertyNameExpected`: `Property name expected` */
const words = (code: string) =>
  code
    .replace(/(?<=[a-z])(?=[A-Z])/g, ' ')
    .replace(/ \w/g, (w) => w.toLowerCase());

/** A string's span, without its quotes (a string being typed has no closing one). */
const unquote = (text: string, node: Node) => {
  if (node.type === 'string' && node.length >= 1) {
    const span = node as { offset: number; length: number };
    const closed =
      span.length >= 2 && text[span.offset + span.length - 1] === '"';
    span.offset += 1;
    span.length -= closed ? 2 : 1;
  }
  node.children?.forEach((child) => unquote(text, child));
};

/** Leaves out each key written again later in its object, with a warning. */
const duplicates = (node: Node, problems: ReadProblem[]) => {
  if (node.type === 'object' && node.children) {
    const last = new Map(
      node.children.map((property) => [property.children![0]!.value, property]),
    );
    // a copy: the loop takes properties out of node.children
    for (const property of node.children.slice())
      if (last.get(property.children![0]!.value) !== property) {
        const key = property.children![0]!;
        problems.push({
          severity: 'warning',
          message: `\`${key.value}\` is written again below: this one isn't read`,
          from: key.offset,
          to: key.offset + key.length,
        });
        node.children.splice(node.children.indexOf(property), 1);
      }
  }
  node.children?.forEach((child) => duplicates(child, problems));
};

export const parseJson = (text: string): Parsed => {
  const errors: ParseError[] = [];
  const tree = parseTree(text, errors, {
    disallowComments: true,
    allowTrailingComma: false,
    allowEmptyContent: true,
  });
  const problems: ReadProblem[] = errors.map(({ error, offset, length }) => ({
    severity: 'error',
    message: `Not valid JSON: ${words(printParseErrorCode(error))}`,
    from: offset,
    to: offset + Math.max(length, 1),
  }));
  if (tree) {
    unquote(text, tree);
    duplicates(tree, problems);
  }
  return { tree, problems };
};
