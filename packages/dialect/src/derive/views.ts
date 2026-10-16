/**
 * What a dialect's view shows of a model (goal-controller#162): its
 * elements and actors of the kinds the view lists, and the links between
 * them (of the link kinds it lists, when it lists some). The workbench
 * hides the rest of the one diagram. Nothing here knows a dialect.
 */
import type { AnyDialect, ViewDefinition } from '../schema';

/** A model's part as a view reads it: its piStar id and kind (a link's ends too). */
export type ViewedElement = { id: string; kind: string };
export type ViewedLink = ViewedElement & { source: string; target: string };

/**
 * The piStar ids a view hides: every element and actor whose kind it
 * doesn't list, and every link one of whose ends it hides, or whose kind
 * isn't among its `links` when it lists some. In the model's order,
 * elements first.
 */
export const viewHides = (
  view: ViewDefinition,
  elements: Iterable<ViewedElement>,
  links: Iterable<ViewedLink>,
): string[] => {
  const hidden = new Set<string>();
  for (const { id, kind } of elements)
    if (!view.kinds.includes(kind)) hidden.add(id);
  for (const { id, kind, source, target } of links)
    if (
      hidden.has(source) ||
      hidden.has(target) ||
      (view.links !== undefined && !view.links.includes(kind))
    )
      hidden.add(id);
  return [...hidden];
};

/** A dialect's views, by id, in its order (none: it has one diagram only). */
export const viewsOf = (
  definition: Partial<Pick<AnyDialect, 'id' | 'views'>> | null | undefined,
): [string, ViewDefinition][] => Object.entries(definition?.views ?? {});
