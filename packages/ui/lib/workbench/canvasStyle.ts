/**
 * Stylesheets the canvas draws a part of the diagram with (an analysis's
 * selection, a dialect's view): selectors for its nodes and edges by their
 * piStar ids, which React Flow's `data-id` carries.
 */

/** An id as a CSS string, for an attribute selector. */
const cssString = (id: string) => `"${id.replace(/["\\]/g, '\\$&')}"`;

/** The diagram's nodes and edges with these piStar ids, under a container attribute: one selector list. */
export const partSelectors = (attribute: string, ids: readonly string[]) =>
  ids
    .flatMap((id) => [
      `[${attribute}] .react-flow__node[data-id=${cssString(id)}]`,
      `[${attribute}] .react-flow__edge[data-id=${cssString(id)}]`,
    ])
    .join(', ');
