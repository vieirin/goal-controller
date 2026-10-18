/**
 * How engines that read a model as a graph (iStar-DT, Tropos4AS) read an
 * element's text: the id its text starts with and its name. Their list
 * properties are the dialect's values (goal-controller#217, #286).
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
