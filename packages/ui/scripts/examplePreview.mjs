/**
 * An example's preview, for the home page's thumbnails (lib/workbench/thumbnail.ts):
 * its piStar model with what a thumbnail draws only, so all of them are fetched
 * at once. Written by examples-manifest.mjs, read the same way by the tests.
 */

/** A piStar model's drawing only: its elements' kinds, places and links, no text. */
export const previewOf = (text) => {
  const model = JSON.parse(text);
  const node = ({ id, type, x, y }) => ({ id, text: '', type, x, y });
  const end = ({ id, type, source, target }) => ({ id, type, source, target });
  // an n-ary link (KAOS's refinement, goal-controller#171): its hub, legs and end
  const link = (entry) =>
    entry.hub
      ? {
          hub: { ...node(entry.hub), customProperties: {} },
          starts: (entry.starts ?? []).map(end),
          ...(entry.end && { end: end(entry.end) }),
        }
      : end(entry);
  return {
    actors: (model.actors ?? []).map((actor) => ({
      ...node(actor),
      nodes: (actor.nodes ?? []).map(node),
    })),
    orphans: (model.orphans ?? []).map(node),
    dependencies: (model.dependencies ?? []).map(node),
    links: (model.links ?? []).map(link),
    display: model.display ?? {},
    tool: model.tool,
    istar: model.istar,
    // the mode it records and the kinds it adds: what it is read with
    diagram: {
      width: model.diagram?.width,
      height: model.diagram?.height,
      name: '',
      customProperties: model.diagram?.customProperties?.engine
        ? { engine: model.diagram.customProperties.engine }
        : {},
    },
    ...(model.metamodel && { metamodel: model.metamodel }),
  };
};
