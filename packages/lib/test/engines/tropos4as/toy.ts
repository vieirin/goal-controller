/**
 * Small Tropos4AS models for the tests, as the analysis model gives them:
 * every element in one actor (unless it says otherwise), named by its id.
 */
import type { AnalysisModel } from '../../../src/engines/analysis';

type ElementSpec = [
  id: string,
  kind: string,
  properties?: Record<string, string>,
  actor?: string | null,
];
type LinkSpec = [source: string, kind: string, target: string, label?: string];

const KINDS: Record<string, string> = {
  goal: 'istar.Goal',
  task: 'istar.Task',
  quality: 'istar.Quality',
  artifact: 'tropos4as.Artifact',
  failure: 'tropos4as.Failure',
  error: 'tropos4as.Error',
};
const LINKS: Record<string, string> = {
  and: 'istar.AndRefinementLink',
  or: 'istar.OrRefinementLink',
  contribution: 'istar.ContributionLink',
  inhibits: 'tropos4as.InhibitsLink',
  sequence: 'tropos4as.SequenceLink',
  failure: 'tropos4as.FailureLink',
  error: 'tropos4as.ErrorLink',
  reads: 'tropos4as.ReadsLink',
};

export const toy = (
  elements: readonly ElementSpec[],
  links: readonly LinkSpec[] = [],
): AnalysisModel => {
  const placed = elements.map(([id, kind, properties = {}, actor = 'A']) => ({
    id,
    kind: KINDS[kind] ?? kind,
    name: id,
    properties,
    ...(actor !== null && { actor }),
  }));
  const actors = [
    ...new Set(placed.flatMap((e) => (e.actor ? [e.actor] : []))),
  ];
  return {
    actors: actors.map((id) => ({
      id,
      kind: 'istar.Actor',
      name: id,
      properties: {},
      elements: placed.filter((e) => e.actor === id).map((e) => e.id),
    })),
    elements: placed,
    links: links.map(([source, kind, target, label], i) => ({
      id: `l${i}`,
      kind: LINKS[kind] ?? kind,
      source,
      target,
      ...(label !== undefined && { label }),
      properties: {},
    })),
  };
};
