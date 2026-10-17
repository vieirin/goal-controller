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
import {
  DEFAULT_FRAMEWORK,
  DEFAULT_MODEL_SHAPE,
  type AnyDialect,
  type Framework,
  type ModelShape,
} from '@goal-controller/dialect';
import type { Type } from '../types/goalTree';

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
 * and the model shape its engine reads (`model`, goal-controller#125); a
 * dialect of a framework besides iStar 2.0 (goal-controller#171), its
 * framework and the link kinds that refine in it.
 */
export type RootReading = {
  name: string;
  unlinkedResources?: 'ignore';
  model?: ModelShape;
} & Partial<Pick<AnyDialect, 'framework' | 'refinements'>>;

/** A framework besides iStar 2.0, the one a dialect is of; null for iStar's. */
export const otherFrameworkOf = (
  dialect?: Partial<Pick<AnyDialect, 'framework'>>,
): Exclude<Framework, 'istar-2.0'> | null => {
  const framework = dialect?.framework ?? DEFAULT_FRAMEWORK;
  return framework === 'istar-2.0' ? null : framework;
};

/**
 * How the IR holds a framework's kinds (goal-controller#171): the node type of
 * each kind its refinements build trees of. `type` says only how a tree holds
 * it (a node's `kind` says what it is): KAOS's goals, domain properties and
 * obstacles, NFR's softgoals and operationalizations are goal nodes, which
 * may be leaves.
 * A kind not listed (KAOS's agents, NFR's claims, a hub) is in no tree: it is
 * in the model's elements, and its links in the model's links.
 */
export const FRAMEWORK_NODE_TYPES: Readonly<
  Record<Exclude<Framework, 'istar-2.0'>, Readonly<Record<string, Type>>>
> = {
  kaos: {
    'kaos.BehavioralGoal': 'goal',
    'kaos.Softgoal': 'goal',
    'kaos.DomainProperty': 'goal',
    // its obstacle analysis (goal-controller#181): obstacle trees
    'kaosObstacles.Obstacle': 'goal',
  },
  nfr: { 'nfr.NFR': 'goal', 'nfr.Operationalization': 'goal' },
};

/** The node type a kind is held as in a tree, in a dialect's framework; null: in no tree. */
export const nodeTypeOf = (
  kind: string,
  dialect?: Partial<Pick<AnyDialect, 'framework'>>,
): Type | null => {
  const framework = otherFrameworkOf(dialect);
  if (framework) return FRAMEWORK_NODE_TYPES[framework][kind] ?? null;
  switch (kind) {
    case 'istar.Goal':
    case 'istar.Quality':
      return 'goal';
    case 'istar.Task':
      return 'task';
    case 'istar.Resource':
      return 'resource';
    default:
      return null;
  }
};

/** A refinement: the relation it makes, its parent and its child (piStar ids). */
export type Refinement = {
  relation: 'and' | 'or' | 'neededBy';
  parent: string;
  child: string;
};

/**
 * The kinds core generates for an n-ary link kind (`kaos.RefinementLink`):
 * its hub element, legs (from a child to the hub) and end (from the hub to
 * what it refines), as DSM3 names them. Read by name, not through core's
 * `metamodelOf`, whose registry is one module instance's: a model parsed by
 * another copy of core (the workbench's ESM build beside goal-tree's
 * CommonJS one) is iStar 2.0's to it.
 */
const hubKindsOf = (kind: string) => ({
  hub: `${kind}Hub`,
  leg: `${kind}Start`,
  end: `${kind}End`,
});

/**
 * How a model's links refine, in a dialect's framework, by link id, and the
 * hubs (elements of no tree). iStar's: `linkRelation`, from the child to the
 * parent. Another framework's (goal-controller#171), by the dialect's
 * `refinements`: a refining kind's link as iStar's, and a leg of an n-ary
 * one refines its hub's end's target, so KAOS's hub is an AND with n
 * children. A link without an entry refines nothing.
 */
export function refinementsOf(
  model: IstarModel<string, string>,
  dialect?: Partial<Pick<AnyDialect, 'framework' | 'refinements'>>,
): { byLink: Map<string, Refinement>; hubs: Set<string> } {
  const byLink = new Map<string, Refinement>();
  const hubs = new Set<string>();
  const links = [...model.links.values()];
  if (!otherFrameworkOf(dialect)) {
    for (const link of links) {
      const relation = linkRelation(link);
      if (relation)
        byLink.set(link.id, {
          relation,
          parent: link.target,
          child: link.source,
        });
    }
    return { byLink, hubs };
  }
  const refinements = dialect?.refinements ?? {};
  // each hub's end: what its legs refine
  const ends = new Map<string, string>();
  for (const [kind] of Object.entries(refinements)) {
    const generated = hubKindsOf(kind);
    for (const element of model.elements.values())
      if (element.kind === generated.hub) hubs.add(element.id);
    for (const link of links)
      if (link.kind === generated.end) ends.set(link.source, link.target);
  }
  for (const link of links) {
    const relation = refinements[link.kind];
    if (relation) {
      byLink.set(link.id, {
        relation,
        parent: link.target,
        child: link.source,
      });
      continue;
    }
    const leg = Object.entries(refinements).find(
      ([kind]) => link.kind === hubKindsOf(kind).leg,
    );
    const end = ends.get(link.target);
    if (leg && end !== undefined)
      byLink.set(link.id, {
        relation: leg[1],
        parent: end,
        child: link.source,
      });
  }
  return { byLink, hubs };
}

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
