/**
 * A dialect's views of the one diagram (goal-controller#162): the view
 * picked hides the elements, actors and links it doesn't show, each in its
 * place (switching views moves nothing). Never written to the model, and
 * the Notation text stays the whole model.
 */
import type { IstarModel } from '@istar-ts/core';
import { viewHides, type ViewDefinition } from '@goal-controller/dialect';
import { partSelectors } from './canvasStyle';

/** The attribute the canvas's container has while a view hides something. */
export const VIEW_ATTRIBUTE = 'data-dialect-view';

/** The piStar ids a view hides of a model: its elements, actors and links as the diagram has them. */
export const modelViewHides = (
  view: ViewDefinition,
  model: IstarModel,
): string[] => viewHides(view, model.elements.values(), model.links.values());

/**
 * How the canvas hides them: a stylesheet, under the container's
 * VIEW_ATTRIBUTE, over the nodes and edges with those piStar ids (React
 * Flow's `data-id`); null when nothing is hidden.
 */
export const viewStyle = (hidden: readonly string[]): string | null => {
  if (!hidden.length) return null;
  return `${partSelectors(VIEW_ATTRIBUTE, hidden)} { visibility: hidden; pointer-events: none; }`;
};
