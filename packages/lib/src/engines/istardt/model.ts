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
 */
import type { AnalysisLink, AnalysisModel } from '../analysis';
import {
  camelCase,
  ISTARDT_LINKS,
  KIND_OF_PISTAR,
  type IstardtKind,
} from './vocabulary';

export type IstardtElement = {
  /** its piStar id */
  pistarId: string;
  kind: IstardtKind;
  /** the id its text starts with (`G1`, `E3`), if it has one */
  id: string | null;
  /** its text after the id */
  name: string;
  /** what DT-Golog calls it */
  identifier: string;
  properties: Readonly<Record<string, string>>;
};

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
  ofKind: (kind: IstardtKind) => IstardtElement[];
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
  /** a task's effects, in its effect links' order */
  effectsOf: (task: IstardtElement) => IstardtElement[];
  /** the task an effect is of */
  taskOf: (effect: IstardtElement) => IstardtElement | undefined;
  /** the sources of an element's precedence links, in link order */
  pre: (element: IstardtElement) => IstardtElement[];
  /** the sources of an element's negative precedence links */
  npr: (element: IstardtElement) => IstardtElement[];
  /** a quality's utility links: the effect and the link's weight */
  utilities: (
    quality: IstardtElement,
  ) => { effect: IstardtElement; weight: string; link: AnalysisLink }[];
  crossRun: readonly string[];
  exported: readonly string[];
  initializations: readonly (readonly [string, string])[];
  /** the actor's piStar id, when the model has one */
  actor?: string;
  problems: readonly IstardtProblem[];
};

const ID = /^([A-Z]+)(\d+)\s*:\s*/;

/** An element's text, as its id and its name (`G1: Order Material`). */
export const splitText = (
  text: string,
): { id: string | null; name: string } => {
  const match = ID.exec(text);
  return match
    ? { id: `${match[1]}${match[2]}`, name: text.slice(match[0].length) }
    : { id: null, name: text };
};

/** A comma-separated list's items, trimmed, without the empty ones. */
export const listItems = (text: string | undefined): string[] =>
  (text ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

/** A `name:value` list's pairs, in order. */
export const pairItems = (text: string | undefined): [string, string][] =>
  listItems(text).map((item) => {
    const colon = item.indexOf(':');
    return colon < 0
      ? [item, '']
      : [item.slice(0, colon).trim(), item.slice(colon + 1).trim()];
  });

const numberOf = (id: string | null) =>
  id ? Number(/\d+$/.exec(id)?.[0] ?? Infinity) : Infinity;

export const readIstardtModel = (model: AnalysisModel): IstardtModel => {
  const problems: IstardtProblem[] = [];
  const elements: IstardtElement[] = [];
  model.elements.forEach((element) => {
    const kind = KIND_OF_PISTAR[element.kind];
    if (!kind) return;
    const { id, name } = splitText(element.name);
    elements.push({
      pistarId: element.id,
      kind,
      id,
      name,
      identifier: element.properties.identifier?.trim() || camelCase(name),
      properties: element.properties,
    });
  });
  const position = new Map(elements.map((e, i) => [e, i]));
  elements.sort(
    (a, b) =>
      a.kind.localeCompare(b.kind) ||
      numberOf(a.id) - numberOf(b.id) ||
      position.get(a)! - position.get(b)!,
  );
  const ofKind = (kind: IstardtKind) =>
    elements.filter((element) => element.kind === kind);

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

  const effectLinks = linksOf(ISTARDT_LINKS.effect);
  const effectsOf = (task: IstardtElement) =>
    effectLinks
      .filter((l) => l.source === task.pistarId)
      .map((l) => byPistarId.get(l.target)!)
      .filter((e) => e.kind === 'effect');
  const taskOf = (effect: IstardtElement) => {
    const link = effectLinks.find((l) => l.target === effect.pistarId);
    return link && byPistarId.get(link.source);
  };
  const sourcesOf = (kind: string) => (element: IstardtElement) =>
    linksOf(kind)
      .filter((l) => l.target === element.pistarId)
      .map((l) => byPistarId.get(l.source)!);

  const utilities = (quality: IstardtElement) =>
    linksOf(ISTARDT_LINKS.utility)
      .filter((l) => l.target === quality.pistarId)
      .map((link) => ({
        effect: byPistarId.get(link.source)!,
        weight: link.properties.weight?.trim() ?? '',
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

  return {
    elements,
    ofKind,
    byIdentifier,
    byPistarId,
    refinement,
    parentOf: (element) => parent.get(element),
    effectsOf,
    taskOf,
    pre: sourcesOf(ISTARDT_LINKS.precedence),
    npr: sourcesOf(ISTARDT_LINKS.negativePrecedence),
    utilities,
    crossRun: listItems(actorProperties[SET_KEYS.crossRun]),
    exported: listItems(actorProperties[SET_KEYS.exported]),
    initializations: pairItems(actorProperties[SET_KEYS.initializations]),
    ...(actor && { actor: actor.id }),
    problems,
  };
};
