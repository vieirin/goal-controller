/**
 * Reduction: goals that only pass a single child through are removed, and the child is
 * refined directly into the first ancestor with more than one child (or the root).
 */
import {
  isNode,
  removeElements,
  updateElement,
  type IstarLink,
  type IstarModel,
} from '@istar-ts/core';
import { linkEnds, linkRelation } from './roots';

const isRefinement = (link: IstarLink): boolean => {
  const relation = linkRelation(link);
  return relation === 'and' || relation === 'or';
};

/** RT id at the start of an element's text ("G3: ..."), if any */
const RT_ID = /^\s*([A-Za-z]+\d+[A-Za-z0-9.]*)\s*:/;

/**
 * piStar ids of the goals with exactly one child (through AND/OR refinements) and at
 * least one parent: roots are never reduced.
 */
export function singleChildGoals(model: IstarModel): string[] {
  const children = new Map<string, number>();
  const hasParent = new Set<string>();
  for (const link of model.links.values()) {
    if (!isRefinement(link)) continue;
    const [parent, child] = linkEnds(link);
    children.set(parent, (children.get(parent) ?? 0) + 1);
    hasParent.add(child);
  }
  return [...model.elements.values()]
    .filter(
      (element) =>
        isNode(element) &&
        element.kind === 'istar.Goal' &&
        children.get(element.id) === 1 &&
        hasParent.has(element.id),
    )
    .map((element) => element.id);
}

/** Replace an RT id in the `[...]` notation of an element text. */
const renameInNotation = (text: string, from: string, to: string): string => {
  const open = text.indexOf('[');
  if (open < 0) return text;
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const notation = text
    .slice(open)
    .replace(
      new RegExp(`(?<![A-Za-z0-9.])${escaped}(?![A-Za-z0-9.])`, 'g'),
      to,
    );
  return text.slice(0, open) + notation;
};

/**
 * Removes every single-child goal (see `singleChildGoals`). The child takes the removed
 * chain's place under the first ancestor that is kept: its link keeps the ancestor's
 * refinement kind and id, and the ancestor's notation names the child instead of the
 * removed goal. Anything else attached to a removed goal (its properties, Needed-By,
 * Qualification or Contribution links) goes with it.
 */
export function reduceModel(model: IstarModel): {
  model: IstarModel;
  removed: string[];
} {
  const removed = singleChildGoals(model);
  if (removed.length === 0) return { model, removed };
  const removable = new Set(removed);

  const childOf = new Map<string, string>();
  for (const link of model.links.values()) {
    if (!isRefinement(link)) continue;
    const [parent, child] = linkEnds(link);
    if (removable.has(parent)) childOf.set(parent, child);
  }
  /** the first kept element down a chain of removed goals */
  const keptBelow = (id: string): string => {
    const seen = new Set<string>();
    let current = id;
    while (removable.has(current) && !seen.has(current)) {
      seen.add(current);
      current = childOf.get(current) ?? current;
    }
    return current;
  };

  const rtId = (id: string): string | null =>
    RT_ID.exec(model.elements.get(id)?.name ?? '')?.[1] ?? null;

  const links = new Map<string, IstarLink>();
  const renames: Array<[parent: string, from: string, to: string]> = [];
  for (const [id, link] of model.links) {
    if (!isRefinement(link)) {
      links.set(id, link);
      continue;
    }
    const [parent, child] = linkEnds(link);
    // links into a removed goal go: its child is linked from the top of the chain
    if (removable.has(parent)) continue;
    if (!removable.has(child)) {
      links.set(id, link);
      continue;
    }
    const kept = keptBelow(child);
    links.set(id, { ...link, source: kept });
    const from = rtId(child);
    const to = rtId(kept);
    if (from && to) renames.push([parent, from, to]);
  }

  let reduced: IstarModel = { ...model, links };
  for (const [parent, from, to] of renames) {
    const element = reduced.elements.get(parent);
    if (!element) continue;
    const name = renameInNotation(element.name, from, to);
    if (name !== element.name)
      reduced = updateElement(reduced, parent, { name });
  }
  return { model: removeElements(reduced, removed), removed };
}
