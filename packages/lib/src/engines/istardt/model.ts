/**
 * An iStar-DT model as the writer and the checks read it, from the piStar
 * model (`analysisModel`: the elements, links and actors with their
 * properties, in the file's order). The non-refinement links and the actor's
 * sets are read here, from piStar, as GRL's engine reads its links: moving
 * them to goal-tree's IR is goal-controller#125's follow-up.
 *
 * - An element's DT-Golog identifier is its `identifier` property, or the
 *   camelCase of its name (#117 D1).
 * - The order is the model's: each kind by its id's number (the importer
 *   numbers them in the file's order), effects and children by their links'
 *   order (#117 D5).
 * - The cross-run, exported and initialized sets are the actor's ordered
 *   lists of identifiers (#117 D4).
 * - Properties are read as the dialect reads them (goal-controller#187): an
 *   element's `values`, a link's probability and weight, the actor's
 *   initializations; a value written with an error is unset (the dialect's
 *   checks report it). The texts stay for the iStarDT-X writer.
 */
import {
  readProperties,
  type ElementPropertiesOf,
  type PropertyValues,
} from '@goal-controller/goal-language';
import { viewValues, type AnalysisLink, type AnalysisModel } from '../analysis';
import { istardt } from './definition';
import {
  camelCase,
  ISTARDT_KINDS,
  ISTARDT_LINKS,
  KIND_OF_PISTAR,
  type IstardtKind,
} from './vocabulary';
import { listItems, splitText } from '../elementText';

/** The dialect kind each kind's properties are declared on. */
const DIALECT_KIND = {
  goal: 'goal',
  task: 'task',
  quality: 'quality',
  effect: ISTARDT_KINDS.effect,
  condition: ISTARDT_KINDS.condition,
  predicate: ISTARDT_KINDS.predicate,
  variable: ISTARDT_KINDS.variable,
} as const satisfies Record<IstardtKind, keyof typeof istardt.properties>;

/** A kind's properties as the dialect reads them: a goal's `root` a boolean, a quality's `formula` its expression, … */
export type IstardtValues<K extends IstardtKind = IstardtKind> = PropertyValues<
  ElementPropertiesOf<typeof istardt, (typeof DIALECT_KIND)[K]>
>;

/** An element of a kind; `IstardtElement` is any kind's, its `values` typed by its `kind`. */
type ElementOf<K extends IstardtKind> = {
  /** its piStar id */
  pistarId: string;
  kind: K;
  /** the id its text starts with (`G1`, `E3`), if it has one */
  id: string | null;
  /** its text after the id */
  name: string;
  /** what DT-Golog calls it */
  identifier: string;
  /** its properties as written */
  properties: Readonly<Record<string, string>>;
  /** its properties as the dialect reads them (goal-controller#187) */
  values: IstardtValues<K>;
};
export type IstardtElement<K extends IstardtKind = IstardtKind> = {
  [Kind in K]: ElementOf<Kind>;
}[K];

export type IstardtProblem = {
  severity: 'error' | 'warning' | 'info';
  message: string;
  /** the piStar id of the element (or link, or actor) it is about */
  element?: string;
};

/** The actor's properties the sets are kept in (#117 D4). */
export const SET_KEYS = {
  crossRun: 'crossRun',
  exported: 'exported',
  initializations: 'initializations',
} as const;

export type IstardtModel = {
  /** every element, each kind by its id's number */
  elements: readonly IstardtElement[];
  ofKind: <K extends IstardtKind>(kind: K) => IstardtElement<K>[];
  /** an element by its DT-Golog identifier (the first, when two share it) */
  byIdentifier: ReadonlyMap<string, IstardtElement>;
  byPistarId: ReadonlyMap<string, IstardtElement>;
  /** a goal's refinement: its relation and its children, child goals first */
  refinement: (goal: IstardtElement) => {
    relation: 'AND' | 'OR' | null;
    children: IstardtElement[];
  };
  /** the goal it refines (the last goal, in order, that lists it) */
  parentOf: (element: IstardtElement) => IstardtElement | undefined;
  /** a task's effects: its effect group's, in the group links' order */
  effectsOf: (task: IstardtElement) => IstardtElement<'effect'>[];
  /** an effect's probability as written (trimmed): its effect group link's */
  probabilityOf: (effect: IstardtElement) => string | undefined;
  /** an effect's probability as the dialect reads it: unset when written with an error */
  probabilityValueOf: (effect: IstardtElement) => number | null | undefined;
  /** the effect groups (their piStar ids), with the tasks linked to them and their effects */
  effectGroups: readonly {
    id: string;
    tasks: IstardtElement[];
    effects: IstardtElement<'effect'>[];
  }[];
  /** the predicates an effect turns true, in link order (their identifiers) */
  turnsTrue: (effect: IstardtElement) => string[];
  /** the predicates an effect turns false */
  turnsFalse: (effect: IstardtElement) => string[];
  /** the sources of an element's precedence links, in link order */
  pre: (element: IstardtElement) => IstardtElement[];
  /** the sources of an element's negative precedence links */
  npr: (element: IstardtElement) => IstardtElement[];
  /** what a quality's or a condition's reads links come from (previous values too) */
  reads: (element: IstardtElement) => IstardtElement[];
  /**
   * a quality's utility links, in order: the effect or quality, the link's
   * weight as written (trimmed), and as the dialect reads it (`factor`:
   * unset when blank or written with an error)
   */
  utilities: (quality: IstardtElement) => {
    source: IstardtElement;
    weight: string;
    factor: number | null | undefined;
    link: AnalysisLink;
  }[];
  /** the actor's `crossRun`: a text, its identifiers comma-separated */
  crossRun: readonly string[];
  /** the actor's `exported`: the same */
  exported: readonly string[];
  /** the actor's `initializations`: its pairs, none when written with an error */
  initializations: readonly (readonly [string, string])[];
  /** the actor's piStar id, when the model has one */
  actor?: string;
  problems: readonly IstardtProblem[];
};

export { listItems, splitText } from '../elementText';

const numberOf = (id: string | null) =>
  id ? Number(/\d+$/.exec(id)?.[0] ?? Infinity) : Infinity;

export const readIstardtModel = (model: AnalysisModel): IstardtModel => {
  const problems: IstardtProblem[] = [];
  const elements: IstardtElement[] = [];
  model.elements.forEach((element) => {
    const kind = KIND_OF_PISTAR[element.kind];
    if (!kind) return;
    const { id, name } = splitText(element.name);
    const values = readProperties(
      istardt,
      { element: DIALECT_KIND[kind] },
      element.properties,
    ).values;
    elements.push({
      pistarId: element.id,
      kind,
      id,
      name,
      identifier: values.identifier || camelCase(name),
      properties: element.properties,
      values,
    } as IstardtElement);
  });
  const position = new Map(elements.map((e, i) => [e, i]));
  elements.sort(
    (a, b) =>
      a.kind.localeCompare(b.kind) ||
      numberOf(a.id) - numberOf(b.id) ||
      position.get(a)! - position.get(b)!,
  );
  const ofKind = <K extends IstardtKind>(kind: K) =>
    elements.filter((element) => element.kind === kind) as IstardtElement<K>[];

  const byIdentifier = new Map<string, IstardtElement>();
  for (const element of elements) {
    const other = byIdentifier.get(element.identifier);
    if (other)
      problems.push({
        severity: 'error',
        message: `${element.identifier} names two elements (${other.id ?? other.name} and ${element.id ?? element.name}): DT-Golog would confuse them`,
        element: element.pistarId,
      });
    else byIdentifier.set(element.identifier, element);
  }
  const byPistarId = new Map(elements.map((e) => [e.pistarId, e]));

  const linksOf = (kind: string) =>
    model.links.filter(
      (link) =>
        link.kind === kind &&
        byPistarId.has(link.source) &&
        byPistarId.has(link.target),
    );
  const refinements = model.links.filter(
    (link) =>
      (link.kind === 'istar.AndRefinementLink' ||
        link.kind === 'istar.OrRefinementLink') &&
      byPistarId.has(link.source) &&
      byPistarId.has(link.target),
  );

  const refinement = (goal: IstardtElement) => {
    const links = refinements.filter((l) => l.target === goal.pistarId);
    const relations = new Set(links.map((l) => l.kind));
    const children = links.map((l) => byPistarId.get(l.source)!);
    return {
      relation:
        relations.size !== 1
          ? null
          : relations.has('istar.AndRefinementLink')
            ? ('AND' as const)
            : ('OR' as const),
      // the translator reads a goal's child goals, then its child tasks
      children: [
        ...children.filter((c) => c.kind === 'goal'),
        ...children.filter((c) => c.kind !== 'goal'),
      ],
    };
  };
  const parent = new Map<IstardtElement, IstardtElement>();
  for (const goal of ofKind('goal'))
    for (const child of refinement(goal).children) parent.set(child, goal);

  // a task, its effect group (`eff`), the group's effects with their probabilities
  const groupIds = model.elements
    .filter((element) => element.kind === ISTARDT_KINDS.effectGroup)
    .map((element) => element.id);
  const isGroup = new Set(groupIds);
  const taskLinks = model.links.filter(
    (l) =>
      l.kind === ISTARDT_LINKS.effect &&
      byPistarId.get(l.source)?.kind === 'task' &&
      isGroup.has(l.target),
  );
  const groupLinks = model.links.filter(
    (l) =>
      l.kind === ISTARDT_LINKS.effectGroup &&
      isGroup.has(l.source) &&
      byPistarId.get(l.target)?.kind === 'effect',
  );
  const effectGroups = groupIds.map((id) => ({
    id,
    tasks: taskLinks
      .filter((l) => l.target === id)
      .map((l) => byPistarId.get(l.source)!),
    effects: groupLinks
      .filter((l) => l.source === id)
      .map((l) => byPistarId.get(l.target) as IstardtElement<'effect'>),
  }));
  const effectsOf = (task: IstardtElement) =>
    taskLinks
      .filter((l) => l.source === task.pistarId)
      .flatMap(
        (l) => effectGroups.find((group) => group.id === l.target)!.effects,
      );
  const groupLinkOf = (effect: IstardtElement) =>
    groupLinks.find((l) => l.target === effect.pistarId);
  const probabilityOf = (effect: IstardtElement) =>
    groupLinkOf(effect)?.properties.probability?.trim();
  const probabilityValueOf = (effect: IstardtElement) => {
    const link = groupLinkOf(effect);
    return link && viewValues(istardt, 'link', link).probability;
  };
  const targetsOf = (kind: string) => (element: IstardtElement) =>
    linksOf(kind)
      .filter((l) => l.source === element.pistarId)
      .map((l) => byPistarId.get(l.target)!.identifier);
  const sourcesOf = (kind: string) => (element: IstardtElement) =>
    linksOf(kind)
      .filter((l) => l.target === element.pistarId)
      .map((l) => byPistarId.get(l.source)!);

  const utilities = (quality: IstardtElement) =>
    linksOf(ISTARDT_LINKS.utility)
      .filter((l) => l.target === quality.pistarId)
      .map((link) => ({
        source: byPistarId.get(link.source)!,
        weight: link.properties.weight?.trim() ?? '',
        factor: viewValues(istardt, 'link', link).weight,
        link,
      }));

  const actors = model.actors;
  if (actors.length > 1)
    problems.push({
      severity: 'error',
      message: `iStar-DT has one actor; this model has ${actors.length}`,
      element: actors[1]!.id,
    });
  const actor = actors[0];
  const actorProperties = actor?.properties ?? {};
  const actorValues = actor && viewValues(istardt, 'actor', actor);

  return {
    elements,
    ofKind,
    byIdentifier,
    byPistarId,
    refinement,
    parentOf: (element) => parent.get(element),
    effectsOf,
    probabilityOf,
    probabilityValueOf,
    effectGroups,
    turnsTrue: targetsOf(ISTARDT_LINKS.turnsTrue),
    turnsFalse: targetsOf(ISTARDT_LINKS.turnsFalse),
    pre: sourcesOf(ISTARDT_LINKS.precedence),
    npr: sourcesOf(ISTARDT_LINKS.negativePrecedence),
    reads: (element) => [
      ...sourcesOf(ISTARDT_LINKS.reads)(element),
      ...sourcesOf(ISTARDT_LINKS.readsPrevious)(element),
    ],
    utilities,
    crossRun: listItems(actorProperties[SET_KEYS.crossRun]),
    exported: listItems(actorProperties[SET_KEYS.exported]),
    initializations: (actorValues?.initializations ?? []).map(
      ({ name, value }) => [name, value] as const,
    ),
    ...(actor && { actor: actor.id }),
    problems,
  };
};
