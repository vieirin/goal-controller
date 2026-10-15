/**
 * A contextual goal model as the analyses and the DLV writer read it: the
 * `AnalysisModel` (piStar ids), with each element's id as its text names
 * it (`G1`, `C5`: what formulas name), its refinements, dependencies,
 * contributions and cost relations, and the roots variants start from.
 */
import type { AnalysisElement, AnalysisLink, AnalysisModel } from '../analysis';
import { formulaOf, type FormulaLookup } from './formulas';
import { CGM_KEYS, CGM_KINDS, CGM_LINKS } from './vocabulary';

/** an id as an element's text starts with it (`G3.1: …`) */
const TEXT_ID = /^\s*([A-Za-z]+\d+(?:\.\d+)*)\s*:/;

/** How a child joins its parent: kept (`and`) or one alternative (`or`). */
export type Refinement = {
  link: AnalysisLink;
  /** piStar ids */
  parent: string;
  child: string;
  relation: 'and' | 'or';
};

/** A dependency as its depender reaches it: the depender's link, the dependum, and the dependee (an element, or none: an actor). */
export type Dependency = {
  link: AnalysisLink;
  depender: string;
  dependum: string;
  dependee?: string;
};

export type CgmModel = {
  model: AnalysisModel;
  element: (pistarId: string) => AnalysisElement | undefined;
  /** an element's id as formulas name it: its text's id, or its piStar id */
  idOf: (pistarId: string) => string;
  /** an element by the id its text starts with, or its piStar id */
  byId: (id: string) => AnalysisElement | undefined;
  /** what formulas read: an element's kind and properties, by its id */
  lookup: FormulaLookup;
  /** a parent's refinements, in the file's order */
  refinementsOf: (pistarId: string) => readonly Refinement[];
  /** the dependencies an element is the depender of */
  dependenciesOf: (pistarId: string) => readonly Dependency[];
  /**
   * the goals variants start from: each actor's root goals, but a goal a
   * dependency reaches (the dependee's tree is walked from its depender)
   */
  roots: readonly string[];
  contributions: readonly AnalysisLink[];
  /** a task's cost (0 when it has none) */
  costOf: (pistarId: string) => number;
  /** the cost relations, each a pair of tasks and what they share */
  overlaps: readonly {
    link: AnalysisLink;
    a: string;
    b: string;
    amount: number;
  }[];
};

const TREE_KINDS = ['istar.Goal', 'istar.Task'];

export const readCgmModel = (model: AnalysisModel): CgmModel => {
  const elements = new Map(model.elements.map((e) => [e.id, e]));
  const idOf = (pistarId: string) => {
    const element = elements.get(pistarId);
    return (element && TEXT_ID.exec(element.name)?.[1]) ?? pistarId;
  };
  const byText = new Map<string, AnalysisElement>();
  for (const element of model.elements)
    if (!byText.has(idOf(element.id))) byText.set(idOf(element.id), element);
  const byId = (id: string) => byText.get(id) ?? elements.get(id);

  const refinements = new Map<string, Refinement[]>();
  const dependencies = new Map<string, Dependency[]>();
  const refined = new Set<string>();
  const reachedByDependency = new Set<string>();
  for (const link of model.links) {
    if (
      link.kind === 'istar.AndRefinementLink' ||
      link.kind === 'istar.OrRefinementLink' ||
      link.kind === 'istar.NeededByLink'
    ) {
      const list = refinements.get(link.target) ?? [];
      list.push({
        link,
        parent: link.target,
        child: link.source,
        relation: link.kind === 'istar.OrRefinementLink' ? 'or' : 'and',
      });
      refinements.set(link.target, list);
      refined.add(link.source);
    }
    if (
      link.kind === 'istar.DependencyLink' &&
      elements.get(link.source)?.actor !== undefined &&
      elements.has(link.target) &&
      elements.get(link.target)!.actor === undefined
    ) {
      const onward = model.links.find(
        (other) =>
          other.kind === 'istar.DependencyLink' && other.source === link.target,
      );
      const dependee =
        onward && elements.has(onward.target) ? onward.target : undefined;
      if (dependee) reachedByDependency.add(dependee);
      const list = dependencies.get(link.source) ?? [];
      list.push({
        link,
        depender: link.source,
        dependum: link.target,
        ...(dependee && { dependee }),
      });
      dependencies.set(link.source, list);
    }
  }
  const roots = model.actors.flatMap((actor) =>
    actor.elements.filter((id) => {
      const element = elements.get(id);
      return (
        element?.kind === 'istar.Goal' &&
        !refined.has(id) &&
        !reachedByDependency.has(id)
      );
    }),
  );
  const intOf = (text: string | undefined) => {
    const value = Number.parseInt(text ?? '', 10);
    return Number.isFinite(value) ? value : 0;
  };
  return {
    model,
    element: (id) => elements.get(id),
    idOf,
    byId,
    lookup: (id) => {
      const element = byId(id);
      return element && { kind: element.kind, properties: element.properties };
    },
    refinementsOf: (id) => refinements.get(id) ?? [],
    dependenciesOf: (id) => dependencies.get(id) ?? [],
    roots,
    contributions: model.links.filter(
      (link) => link.kind === 'istar.ContributionLink',
    ),
    costOf: (id) => intOf(elements.get(id)?.properties[CGM_KEYS.cost]),
    overlaps: model.links.flatMap((link) =>
      link.kind === CGM_LINKS.includes
        ? [
            {
              link,
              a: link.source,
              b: link.target,
              amount: intOf(
                elements.get(link.target)?.properties[CGM_KEYS.cost],
              ),
            },
          ]
        : link.kind === CGM_LINKS.intersects
          ? [
              {
                link,
                a: link.source,
                b: link.target,
                amount: intOf(link.properties[CGM_KEYS.amount]),
              },
            ]
          : [],
    ),
  };
};

/** Whether an element is a goal or a task (a variant's node). */
export const isTreeKind = (element: AnalysisElement | undefined): boolean =>
  !!element && TREE_KINDS.includes(element.kind);

/** The contexts a model declares, by id, in the file's order. */
export const contextsOf = (cgm: CgmModel): string[] =>
  cgm.model.elements
    .filter((element) => element.kind === CGM_KINDS.context)
    .map((element) => cgm.idOf(element.id));

/** A link's or element's context tree (`context`, `activation`); none when it has none. */
export const contextAt = (
  properties: Readonly<Record<string, string>>,
  key: string = CGM_KEYS.context,
) => formulaOf(properties[key]);

/**
 * A set of tasks' development cost (REJ 2010 §5.3, #151 D11): their costs,
 * less what each pair in the set shares.
 */
export const costOfTasks = (cgm: CgmModel, tasks: Iterable<string>): number => {
  const set = new Set(tasks);
  let total = 0;
  for (const task of set) total += cgm.costOf(task);
  for (const { a, b, amount } of cgm.overlaps)
    if (set.has(a) && set.has(b)) total -= amount;
  return total;
};
