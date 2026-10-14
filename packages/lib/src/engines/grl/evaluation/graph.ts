/**
 * A GRL model as jUCMNav's algorithms walk it: its intentional elements and
 * actors, and each element's links as GRL has them (`src` → `dest`, the
 * element evaluated being the `dest`), read from the analysis model (blue's
 * #107 shape). iStar's links map back to GRL's: a refinement is a
 * decomposition (child → parent), a contribution keeps its GRL values (its
 * properties), and a dependency link from depender to dependee is GRL's from
 * the dependee to the depender.
 */
import type { AnalysisModel } from '../../analysis';
import {
  GRL_CONTRIBUTIONS,
  GRL_DECOMPOSITIONS,
  GRL_IMPORTANCES,
  type GrlContribution,
  type GrlDecomposition,
  type GrlImportance,
} from '../vocabulary';

/** The kinds an evaluation reads as intentional elements (a belief is none). */
export const INTENTIONAL_KINDS: ReadonlySet<string> = new Set([
  'istar.Goal',
  'istar.Task',
  'istar.Resource',
  'istar.Quality',
  'grl.Indicator',
]);

export type GrlEdge =
  | { kind: 'decomposition'; src: string; dest: string }
  | { kind: 'dependency'; src: string; dest: string }
  | {
      kind: 'contribution';
      src: string;
      dest: string;
      contribution: GrlContribution;
      quantitative: number;
    };

export type GrlNode = {
  id: string;
  decompositionType: GrlDecomposition;
  importance: GrlImportance;
  importanceQuantitative: number;
};

export type GrlActorNode = {
  id: string;
  importance: GrlImportance;
  importanceQuantitative: number;
  /** its intentional elements, in the model's order */
  elements: readonly string[];
};

export type GrlGraph = {
  /** in the model's order (jUCMNav's `getIntElements()`) */
  elements: readonly GrlNode[];
  actors: readonly GrlActorNode[];
  /** each element's links in (jUCMNav's `getLinksDest()`), in the model's link order */
  incoming: ReadonlyMap<string, readonly GrlEdge[]>;
  /** each element's links out (`getLinksSrc()`) */
  outgoing: ReadonlyMap<string, readonly GrlEdge[]>;
};

/** iStar's contribution value as GRL's, when the link has no GRL label */
const CONTRIBUTION_OF_LABEL: Readonly<Record<string, GrlContribution>> = {
  make: 'Make',
  help: 'Help',
  hurt: 'Hurt',
  break: 'Break',
};

/** an enum property: its value, or the metamodel's default */
const pick = <T extends string>(
  value: string | undefined,
  literals: readonly T[],
  fallback: T,
): T => (literals.includes(value as T) ? (value as T) : fallback);

/** an int property: its value, or the metamodel's default */
const integer = (value: string | undefined, fallback: number): number => {
  const read = Number(value);
  return value !== undefined && value.trim() !== '' && Number.isInteger(read)
    ? read
    : fallback;
};

export const grlGraph = (model: AnalysisModel): GrlGraph => {
  const intentional = model.elements.filter((e) =>
    INTENTIONAL_KINDS.has(e.kind),
  );
  const ids = new Set(intentional.map((e) => e.id));
  const edges = model.links.flatMap((link): GrlEdge[] => {
    if (!ids.has(link.source) || !ids.has(link.target)) return [];
    switch (link.kind) {
      case 'istar.AndRefinementLink':
      case 'istar.OrRefinementLink':
        return [{ kind: 'decomposition', src: link.source, dest: link.target }];
      case 'istar.DependencyLink':
        return [{ kind: 'dependency', src: link.target, dest: link.source }];
      case 'istar.ContributionLink':
        return [
          {
            kind: 'contribution',
            src: link.source,
            dest: link.target,
            contribution: pick(
              link.properties.contribution,
              GRL_CONTRIBUTIONS,
              CONTRIBUTION_OF_LABEL[link.label ?? ''] ?? 'Help',
            ),
            // EMF's default, as jUCMNav: a contribution's label doesn't set it
            quantitative: integer(link.properties.quantitativeContribution, 25),
          },
        ];
      default:
        return [];
    }
  });
  const incoming = new Map<string, GrlEdge[]>();
  const outgoing = new Map<string, GrlEdge[]>();
  for (const edge of edges) {
    incoming.set(edge.dest, [...(incoming.get(edge.dest) ?? []), edge]);
    outgoing.set(edge.src, [...(outgoing.get(edge.src) ?? []), edge]);
  }
  // an element's decomposition: its property (Xor, #105 D2), else its refinement links'
  const refinementKind = new Map<string, GrlDecomposition>();
  for (const link of model.links)
    if (!refinementKind.has(link.target))
      if (link.kind === 'istar.AndRefinementLink')
        refinementKind.set(link.target, 'And');
      else if (link.kind === 'istar.OrRefinementLink')
        refinementKind.set(link.target, 'Or');
  const elements = intentional.map((element): GrlNode => ({
    id: element.id,
    decompositionType: pick(
      element.properties.decompositionType,
      GRL_DECOMPOSITIONS,
      refinementKind.get(element.id) ?? 'And',
    ),
    importance: pick(element.properties.importance, GRL_IMPORTANCES, 'None'),
    importanceQuantitative: integer(
      element.properties.importanceQuantitative,
      0,
    ),
  }));
  const actors = model.actors.map((actor): GrlActorNode => ({
    id: actor.id,
    importance: pick(actor.properties.importance, GRL_IMPORTANCES, 'None'),
    importanceQuantitative: integer(actor.properties.importanceQuantitative, 0),
    elements: actor.elements.filter((id) => ids.has(id)),
  }));
  return { elements, actors, incoming, outgoing };
};
