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

/**
 * How a link refines its parent, or null for a kind that is not a refinement. A
 * Qualification link is not one: it attaches a Quality to what it qualifies.
 */
export function linkRelation(
  link: IstarLink<string>,
): 'and' | 'or' | 'neededBy' | null {
  switch (link.kind) {
    case 'istar.AndRefinementLink':
      return 'and';
    case 'istar.OrRefinementLink':
      return 'or';
    case 'istar.NeededByLink':
      return 'neededBy';
    default:
      return null;
  }
}

/** [parent, child] of a refinement link: it points from the child to the parent. */
export function linkEnds(
  link: IstarLink<string>,
): [parent: string, child: string] {
  return [link.target, link.source];
}

/** How a dialect reads its roots (a DialectDefinition's `unlinkedResources`). */
export type RootReading = { name: string; unlinkedResources?: 'ignore' };

/**
 * The unique non-Quality child of `actorId` with no outgoing links, excluding
 * nodes that exist only as targets of a Quality's QualificationLink and, in
 * a dialect with `unlinkedResources: 'ignore'`, Resources with no links at all.
 *
 * @throws Error if there is not exactly one such node
 */
export function findActorRoot(
  model: IstarModel,
  actorId: string,
  dialect?: RootReading,
): IstarElement {
  const roots = actorRootCandidates(model, actorId, dialect);
  if (roots.length !== 1 || !roots[0]) {
    throw new Error('[INVALID_MODEL]: Invalid number of roots, one allowed');
  }
  return roots[0];
}

/**
 * The elements that could be the actor's root (see `findActorRoot`), without deciding:
 * the engines need exactly one, editors show what there is.
 */
export function actorRootCandidates<EK extends string, LK extends string>(
  model: IstarModel<EK, LK>,
  actorId: string,
  dialect?: RootReading,
): IstarElement<EK>[] {
  const nodes = childrenOf(model, actorId);
  const byId = new Map(nodes.map((node) => [node.id, node]));

  return nodes.filter((node) => {
    if (node.kind === 'istar.Quality') return false;

    const links = linksOf(model, node.id);
    const qualifiedByQuality = links.some(
      (link) =>
        link.kind === 'istar.QualificationLink' &&
        link.target === node.id &&
        byId.get(link.source)?.kind === 'istar.Quality',
    );
    if (qualifiedByQuality) return false;
    // a Resource linked to nothing is no tree's root where the dialect says
    // so: drawn beside the goals (GODA's TAS), it is read and left out
    if (
      dialect?.unlinkedResources === 'ignore' &&
      node.kind === 'istar.Resource' &&
      links.length === 0
    )
      return false;

    return !links.some((link) => link.source === node.id);
  });
}
