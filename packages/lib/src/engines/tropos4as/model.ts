/**
 * A Tropos4AS model as the lifecycle and the checks read it, from the
 * analysis model (its elements, links and actors with their properties, in
 * the file's order), as iStar-DT's writer reads its own.
 *
 * - A goal of the lifecycle is an actor's iStar goal or error (an error is
 *   adopted as a goal, #134 D7); a dependum is none. A task is a plan,
 *   executed, never a goal.
 * - A goal's children are its refinements' sources (AND or OR; a task
 *   refining a goal is a means-end), in the links' order; sequence links
 *   reorder them (./lifecycle).
 * - A root is a goal that refines nothing.
 * - An element's properties are read as the dialect reads them
 *   (goal-controller#187, `values`): a value written with an error is
 *   unset, the dialect's checks report it.
 */
import { viewValues, type AnalysisModel, type ViewValues } from '../analysis';
import { splitText } from '../elementText';
import { tropos4as } from './definition';
import {
  TROPOS4AS_KINDS,
  TROPOS4AS_LINKS,
  type GoalType,
  type OnFailure,
} from './vocabulary';

/** The kinds the lifecycle reads, by piStar kind. */
const KIND_OF_PISTAR = {
  'istar.Goal': 'goal',
  'istar.Task': 'task',
  'istar.Resource': 'resource',
  'istar.Quality': 'quality',
  [TROPOS4AS_KINDS.artifact]: 'artifact',
  [TROPOS4AS_KINDS.failure]: 'failure',
  [TROPOS4AS_KINDS.error]: 'error',
  [TROPOS4AS_KINDS.symptom]: 'symptom',
} as const;
export type Tropos4asKind =
  (typeof KIND_OF_PISTAR)[keyof typeof KIND_OF_PISTAR];

/** An element's properties as the dialect reads them: a goal's `type` an option, its conditions assertions, an artifact's `attributes` pairs. */
export type Tropos4asValues = ViewValues<typeof tropos4as>;

export type Tropos4asElement = {
  /** its piStar id */
  pistarId: string;
  kind: Tropos4asKind;
  /** the id its text starts with (`G1`, `ER2`), if it has one */
  id: string | null;
  /** its text after the id */
  name: string;
  /** what scenarios and the trace call it: its id, or its piStar id without one */
  label: string;
  /** its actor's piStar id (none: outside every actor) */
  actor?: string;
  /** its properties as written */
  properties: Readonly<Record<string, string>>;
  /** its properties as the dialect reads them (goal-controller#187) */
  values: Tropos4asValues;
};

export type Tropos4asProblem = {
  severity: 'error' | 'warning' | 'info';
  message: string;
  /** the piStar id of the element (or link) it is about */
  element?: string;
};

export type Tropos4asModel = {
  /** every element the lifecycle reads, in the file's order */
  elements: readonly Tropos4asElement[];
  ofKind: (kind: Tropos4asKind) => Tropos4asElement[];
  /** the goals of the lifecycle: an actor's goals and errors, in the file's order */
  goals: readonly Tropos4asElement[];
  /** an element by its id (`G1`) or its piStar id */
  find: (key: string) => Tropos4asElement | undefined;
  /** a goal's refinement: its relation and its children, in the links' order */
  refinement: (goal: Tropos4asElement) => {
    relation: 'AND' | 'OR' | null;
    children: Tropos4asElement[];
  };
  /** the goal it refines (the first, in link order) */
  parentOf: (element: Tropos4asElement) => Tropos4asElement | undefined;
  /** the goals that inhibit it */
  inhibitors: (goal: Tropos4asElement) => Tropos4asElement[];
  /** the goals a sequence link puts before it */
  predecessors: (goal: Tropos4asElement) => Tropos4asElement[];
  /** the inhibits and sequence links, as pairs, for the cycle check */
  relationLinks: readonly {
    kind: 'inhibits' | 'sequence';
    source: Tropos4asElement;
    target: Tropos4asElement;
    link: string;
  }[];
  /**
   * What an element and its means contribute to the qualities: make 2,
   * help 1, hurt −1, break −2, summed over their contribution links
   */
  contributionOf: (element: Tropos4asElement) => number;
  /** the failures a goal's failing is (its failure links) */
  failuresOf: (goal: Tropos4asElement) => Tropos4asElement[];
  /** an artifact's attributes: `name:type`, in order (none when written with an error) */
  attributesOf: (artifact: Tropos4asElement) => [string, string][];
  /** the problems reading it found */
  problems: readonly Tropos4asProblem[];
};

/** A goal's type: achieve unless it says maintain or perform (#134 D4). */
export const goalTypeOf = (goal: Tropos4asElement): GoalType =>
  goal.values.type ?? 'achieve';

/** An achieve-goal's behaviour after its subgoals, a) or b) of §4.3.2. */
export const onFailureOf = (goal: Tropos4asElement): OnFailure =>
  goal.values.onFailure ?? 'restart';

/** iStar's contribution values, as `contributionOf` weighs them */
const CONTRIBUTION_VALUE: Readonly<Record<string, number>> = {
  make: 2,
  help: 1,
  hurt: -1,
  break: -2,
};

const REFINEMENTS: ReadonlySet<string> = new Set([
  'istar.AndRefinementLink',
  'istar.OrRefinementLink',
]);

export const readTropos4asModel = (model: AnalysisModel): Tropos4asModel => {
  const problems: Tropos4asProblem[] = [];
  const elements: Tropos4asElement[] = model.elements.flatMap((element) => {
    const kind = KIND_OF_PISTAR[element.kind as keyof typeof KIND_OF_PISTAR];
    if (!kind) return [];
    const { id, name } = splitText(element.name);
    return [
      {
        pistarId: element.id,
        kind,
        id,
        name,
        label: id ?? element.id,
        ...(element.actor !== undefined && { actor: element.actor }),
        properties: element.properties,
        values: viewValues(tropos4as, 'element', element),
      },
    ];
  });
  const byPistarId = new Map(elements.map((e) => [e.pistarId, e]));
  const byId = new Map(
    elements.flatMap((e) => (e.id ? [[e.id, e] as const] : [])),
  );
  const ofKind = (kind: Tropos4asKind) =>
    elements.filter((element) => element.kind === kind);
  // a dependum is what a depender wants of a dependee, not an agent's goal
  const goals = elements.filter(
    (e) => (e.kind === 'goal' || e.kind === 'error') && e.actor !== undefined,
  );

  const known = (link: { source: string; target: string }) =>
    byPistarId.has(link.source) && byPistarId.has(link.target);
  const refinements = model.links.filter(
    (link) => REFINEMENTS.has(link.kind) && known(link),
  );
  const refinement = (goal: Tropos4asElement) => {
    const links = refinements.filter((l) => l.target === goal.pistarId);
    const relations = new Set(links.map((l) => l.kind));
    return {
      relation:
        relations.size === 0
          ? ('AND' as const)
          : relations.size > 1
            ? null
            : relations.has('istar.AndRefinementLink')
              ? ('AND' as const)
              : ('OR' as const),
      children: links.map((l) => byPistarId.get(l.source)!),
    };
  };
  for (const goal of goals)
    if (refinement(goal).relation === null)
      problems.push({
        severity: 'error',
        message: `${goal.label} is refined with AND and OR links: a goal is AND- or OR-decomposed (AAMAS 2009 §4.2)`,
        element: goal.pistarId,
      });
  const parent = new Map<Tropos4asElement, Tropos4asElement>();
  for (const link of refinements) {
    const child = byPistarId.get(link.source)!;
    if (!parent.has(child)) parent.set(child, byPistarId.get(link.target)!);
  }

  const linksOf = (kind: string) =>
    model.links.filter((link) => link.kind === kind && known(link));
  const relationLinks = (
    [
      ['inhibits', TROPOS4AS_LINKS.inhibits],
      ['sequence', TROPOS4AS_LINKS.sequence],
    ] as const
  ).flatMap(([kind, pistarKind]) =>
    linksOf(pistarKind).map((link) => ({
      kind,
      source: byPistarId.get(link.source)!,
      target: byPistarId.get(link.target)!,
      link: link.id,
    })),
  );
  const sourcesOf =
    (kind: 'inhibits' | 'sequence') => (goal: Tropos4asElement) =>
      relationLinks
        .filter((l) => l.kind === kind && l.target === goal)
        .map((l) => l.source);
  const failureLinks = linksOf(TROPOS4AS_LINKS.failure);
  const contributions = linksOf('istar.ContributionLink');
  const contributionOf = (element: Tropos4asElement) => {
    const sources = new Set(
      [element, ...refinement(element).children].map((e) => e.pistarId),
    );
    return contributions
      .filter((l) => sources.has(l.source))
      .reduce((sum, l) => sum + (CONTRIBUTION_VALUE[l.label ?? ''] ?? 0), 0);
  };

  return {
    elements,
    ofKind,
    goals,
    find: (key) => byId.get(key) ?? byPistarId.get(key),
    refinement,
    parentOf: (element) => parent.get(element),
    inhibitors: sourcesOf('inhibits'),
    predecessors: sourcesOf('sequence'),
    relationLinks,
    contributionOf,
    failuresOf: (goal) =>
      failureLinks
        .filter((l) => l.source === goal.pistarId)
        .map((l) => byPistarId.get(l.target)!),
    attributesOf: (artifact) =>
      (artifact.values.attributes ?? []).map(
        ({ name, value }): [string, string] => [name, value],
      ),
    problems,
  };
};
