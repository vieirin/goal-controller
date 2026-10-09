import type { DocumentNode } from '../../src';

/** A document node: piStar id `i-<id>`, named after its id, unless given. */
export const node = (
  n: Partial<DocumentNode> & Pick<DocumentNode, 'id' | 'kind'>,
): DocumentNode => ({
  iStarId: `i-${n.id}`,
  name: n.id,
  notation: null,
  properties: {},
  children: [],
  ...n,
});
