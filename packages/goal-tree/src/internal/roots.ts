/**
 * How the engines read the link graph: which links make a parent, and an actor's root
 * intentional element. Root is a project convention, not part of the iStar metamodel /
 * @istar-ts/core.
 */
import {
  childrenOf,
  isActor,
  linksOf,
  type IstarElement,
  type IstarLink,
  type IstarModel,
} from '@istar-ts/core';
import { DEFAULT_MODEL_SHAPE, type ModelShape } from '@goal-controller/dialect';

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

/**
 * How a dialect reads its roots (a DialectDefinition's `unlinkedResources`)
 * and the model shape its engine reads (`model`, goal-controller#125).
 */
export type RootReading = {
  name: string;
  unlinkedResources?: 'ignore';
  model?: ModelShape;
};

/** The kinds a tree holds (a Quality as a goal node). */
export const TREE_KINDS: ReadonlySet<string> = new Set([
  'istar.Goal',
  'istar.Task',
  'istar.Resource',
  'istar.Quality',
]);

/**
 * An actor's roots (goal-controller#125), in the model's order: its elements
 * of the tree kinds, but Qualities, that refine nothing (no outgoing
 * refinement link, `linkRelation`). Excluded as today: an element only a
 * Quality qualifies and, in a dialect with `unlinkedResources: 'ignore'`, a
 * Resource with no links at all. An element whose only outgoing links are
 * others (a contribution, a dependency) is a root: before, any outgoing link
 * kept it from being one, so it was in no tree.
 */
export function actorRoots<EK extends string, LK extends string>(
  model: IstarModel<EK, LK>,
  actorId: string,
  dialect?: RootReading,
): IstarElement<EK>[] {
  const nodes = childrenOf(model, actorId);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return nodes.filter((node) => {
    if (!TREE_KINDS.has(node.kind) || node.kind === 'istar.Quality')
      return false;
    const links = linksOf(model, node.id);
    if (
      links.some(
        (link) =>
          link.kind === 'istar.QualificationLink' &&
          link.target === node.id &&
          byId.get(link.source)?.kind === 'istar.Quality',
      )
    )
      return false;
    if (
      dialect?.unlinkedResources === 'ignore' &&
      node.kind === 'istar.Resource' &&
      links.length === 0
    )
      return false;
    return !links.some(
      (link) =>
        link.source === node.id &&
        linkRelation(link as IstarLink<string>) !== null,
    );
  });
}

/**
 * What is wrong with a model for an engine that reads this shape (its
 * dialect's `model`, by default one actor with one root goal): null when
 * it fits. The workbench lists it as a dialect problem; `Model.validate` and
 * `GoalTree.fromModel` throw it.
 */
export function modelShapeProblem<EK extends string, LK extends string>(
  model: IstarModel<EK, LK>,
  dialect?: RootReading,
): string | null {
  const shape = dialect?.model ?? DEFAULT_MODEL_SHAPE;
  const actors = [...model.elements.values()].filter(isActor);
  const reads = `${dialect?.name ?? 'The engine'} reads ${
    shape.actors === 'one'
      ? shape.treesPerActor === 'one'
        ? 'one actor with one root goal'
        : 'one actor'
      : 'one root goal per actor'
  }`;
  if (shape.actors === 'one' && actors.length !== 1)
    return `${reads}; the model has ${actors.length === 0 ? 'no actor' : `${actors.length} actors`}`;
  if (shape.treesPerActor === 'one')
    for (const actor of actors) {
      const roots = actorRoots(model, actor.id, dialect);
      if (roots.length !== 1)
        return `${reads}; actor "${actor.name.trim()}" has ${
          roots.length === 0
            ? 'no root goal'
            : `${roots.length} root goals (${roots.map((root) => root.name.split(':')[0]!.trim()).join(', ')})`
        }`;
    }
  return null;
}

/**
 * The elements that could be the actor's root (see `actorRoots`), without deciding:
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
