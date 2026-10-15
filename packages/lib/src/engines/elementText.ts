/**
 * How engines that read a model as a graph (iStar-DT, Tropos4AS) read an
 * element's text and their list properties: the id its text starts with
 * and its name, a comma-separated list, a `name:value` list.
 */

const ID = /^([A-Z]+)(\d+)\s*:\s*/;

/** An element's text, as its id and its name (`G1: Order Material`). */
export const splitText = (
  text: string,
): { id: string | null; name: string } => {
  const match = ID.exec(text);
  return match
    ? { id: `${match[1]}${match[2]}`, name: text.slice(match[0].length) }
    : { id: null, name: text };
};

/** A comma-separated list's items, trimmed, without the empty ones. */
export const listItems = (text: string | undefined): string[] =>
  (text ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

/** A `name:value` list's pairs, in order. */
export const pairItems = (text: string | undefined): [string, string][] =>
  listItems(text).map((item) => {
    const colon = item.indexOf(':');
    return colon < 0
      ? [item, '']
      : [item.slice(0, colon).trim(), item.slice(colon + 1).trim()];
  });
