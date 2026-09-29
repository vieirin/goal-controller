/**
 * Resolve an actor's root intentional element from the link graph.
 * Root is a project convention, not part of the iStar metamodel / @istar-ts/core.
 */
import { childrenOf, linksOf, type IstarElement, type IstarModel } from "@istar-ts/core";

/**
 * The unique non-Quality child of `actorId` with no outgoing links, excluding
 * nodes that exist only as targets of a Quality's QualificationLink.
 *
 * @throws Error if there is not exactly one such node
 */
export function findActorRoot(model: IstarModel, actorId: string): IstarElement {
  const nodes = childrenOf(model, actorId);
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const roots = nodes.filter((node) => {
    if (node.kind === "istar.Quality") return false;

    const links = linksOf(model, node.id);
    const qualifiedByQuality = links.some(
      (link) =>
        link.kind === "istar.QualificationLink" &&
        link.target === node.id &&
        byId.get(link.source)?.kind === "istar.Quality",
    );
    if (qualifiedByQuality) return false;

    return !links.some((link) => link.source === node.id);
  });

  if (roots.length !== 1 || !roots[0]) {
    throw new Error("[INVALID_MODEL]: Invalid number of roots, one allowed");
  }

  return roots[0];
}
