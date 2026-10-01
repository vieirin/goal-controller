/**
 * How the engines read the link graph: which links make a parent, and an actor's root
 * intentional element. Root is a project convention, not part of the iStar metamodel /
 * @istar-ts/core.
 */
import {
  childrenOf,
  linksOf,
  type IstarElement,
  type IstarLink,
  type IstarModel,
} from '@istar-ts/core';

/** How a link refines its parent, or null for a kind the engines do not read. */
export function linkRelation(
  link: IstarLink,
): 'and' | 'or' | 'neededBy' | null {
  switch (link.kind) {
    case 'istar.AndRefinementLink':
    case 'istar.QualificationLink':
      return 'and';
    case 'istar.OrRefinementLink':
      return 'or';
    case 'istar.NeededByLink':
      return 'neededBy';
    default:
      return null;
  }
}

/** [parent, child] of a link: a Quality is refined into what it qualifies. */
export function linkEnds(link: IstarLink): [parent: string, child: string] {
  return link.kind === 'istar.QualificationLink'
    ? [link.source, link.target]
    : [link.target, link.source];
}

/**
 * The unique non-Quality child of `actorId` with no outgoing links, excluding
 * nodes that exist only as targets of a Quality's QualificationLink.
 *
 * @throws Error if there is not exactly one such node
 */
export function findActorRoot(
  model: IstarModel,
  actorId: string,
): IstarElement {
  const roots = actorRootCandidates(model, actorId);
  if (roots.length !== 1 || !roots[0]) {
    throw new Error('[INVALID_MODEL]: Invalid number of roots, one allowed');
  }
  return roots[0];
}

/**
 * The elements that could be the actor's root (see `findActorRoot`), without deciding:
 * the engines need exactly one, editors show what there is.
 */
export function actorRootCandidates(
  model: IstarModel,
  actorId: string,
): IstarElement[] {
  const nodes = childrenOf(model, actorId);
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const roots = nodes.filter((node) => {
    if (node.kind === 'istar.Quality') return false;

    const links = linksOf(model, node.id);
    const qualifiedByQuality = links.some(
      (link) =>
        link.kind === 'istar.QualificationLink' &&
        link.target === node.id &&
        byId.get(link.source)?.kind === 'istar.Quality',
    );
    if (qualifiedByQuality) return false;

    return !links.some((link) => link.source === node.id);
  });

  return roots;
}
