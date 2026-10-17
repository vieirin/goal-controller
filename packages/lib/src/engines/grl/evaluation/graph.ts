/**
 * A GRL model as jUCMNav's algorithms walk it: its intentional elements and
 * actors, and each element's links as GRL has them (`src` → `dest`, the
 * element evaluated being the `dest`), read from the analysis model (blue's
 * #107 shape). iStar's links map back to GRL's: a refinement is a
 * decomposition (child → parent), a contribution keeps its GRL values (its
 * properties), and a dependency link from depender to dependee is GRL's from
 * the dependee to the depender.
 */
import { viewValues, type AnalysisModel } from '../../analysis';
import { elementProperties, grl } from '../definition';
import {
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
export const CONTRIBUTION_OF_LABEL: Readonly<Record<string, GrlContribution>> =
  {
    make: 'Make',
    help: 'Help',
    hurt: 'Hurt',
    break: 'Break',
  };

const readingOf = () => ({
  properties: {
    goal: elementProperties,
    task: elementProperties,
    resource: elementProperties,
    quality: elementProperties,
    'grl.Indicator': elementProperties,
  },
  links: grl.links,
  actors: grl.actors,
});
let reading: ReturnType<typeof readingOf> | undefined;
/**
 * GRL as the evaluation reads a model's properties (goal-controller#187):
 * an intentional element's are `elementProperties` (what GRL would declare,
 * #105), its actors' and links' the dialect's. Made on first use: the
 * dialect's module imports the jUCM writer, which imports this one.
 */
const grlReading = () => (reading ??= readingOf());

/** an enum property: its value, or the metamodel's default (the jUCM writer's, which reads its texts) */
export const pick = <T extends string>(
  value: string | undefined,
  literals: readonly T[],
  fallback: T,
): T => (literals.includes(value as T) ? (value as T) : fallback);

/** an int property: its value, or the metamodel's default (the jUCM writer's) */
export const integer = (
  value: string | undefined,
  fallback: number,
): number => {
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
      case 'istar.ContributionLink': {
        const values = viewValues(grlReading(), 'link', link);
        return [
          {
            kind: 'contribution',
            src: link.source,
            dest: link.target,
            contribution:
              values.contribution ??
              CONTRIBUTION_OF_LABEL[link.label ?? ''] ??
              'Help',
            // EMF's default, as jUCMNav: a contribution's label doesn't set it
            quantitative: values.quantitativeContribution ?? 25,
          },
        ];
      }
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
  const elements = intentional.map((element): GrlNode => {
    const values = viewValues(grlReading(), 'element', element);
    return {
      id: element.id,
      decompositionType:
        values.decompositionType ?? refinementKind.get(element.id) ?? 'And',
      importance: values.importance ?? 'None',
      importanceQuantitative: values.importanceQuantitative ?? 0,
    };
  });
  const actors = model.actors.map((actor): GrlActorNode => {
    const values = viewValues(grlReading(), 'actor', actor);
    return {
      id: actor.id,
      importance: values.importance ?? 'None',
      importanceQuantitative: values.importanceQuantitative ?? 0,
      elements: actor.elements.filter((id) => ids.has(id)),
    };
  });
  return { elements, actors, incoming, outgoing };
};
