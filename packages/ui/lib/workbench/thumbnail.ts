/**
 * A model as the home page's cards draw it: its elements' boxes and its links'
 * ends, laid out by istar-ts as the canvas lays them out (modelToFlow), with
 * no text. Pure, so a card computes it once from a model or a preview.
 */
import { metamodelOf, type IstarModel } from '@istar-ts/core';
import { modelToFlow, registryForMetamodel } from '@istar-ts/react';
import { parseModel } from './dialects';

/** What a card draws an element as. */
export type ThumbnailShape = 'goal' | 'task' | 'resource' | 'quality' | 'other';

/** What a card draws a link as: its colour says how it refines. */
export type ThumbnailLine = 'and' | 'or' | 'other';

export type ThumbnailBox = { x: number; y: number; w: number; h: number };

export type Thumbnail = {
  /** what all of it covers: the card's viewBox */
  box: ThumbnailBox;
  actors: ThumbnailBox[];
  elements: (ThumbnailBox & { shape: ThumbnailShape })[];
  links: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    line: ThumbnailLine;
  }[];
};

/** iStar's kinds and a dialect's (`istar.Goal`, `ext.SoftGoal`), by what they end in. */
const shapeOf = (kind: string): ThumbnailShape => {
  const name = kind.slice(kind.lastIndexOf('.') + 1).toLowerCase();
  if (name.endsWith('quality') || name.endsWith('softgoal')) return 'quality';
  if (name.endsWith('goal')) return 'goal';
  if (name.endsWith('task')) return 'task';
  if (name.endsWith('resource')) return 'resource';
  return 'other';
};

const lineOf = (kind: string): ThumbnailLine =>
  /AndRefinement/.test(kind)
    ? 'and'
    : /OrRefinement/.test(kind)
      ? 'or'
      : 'other';

/** A model's thumbnail; null when it draws nothing. */
export const thumbnailOf = (model: IstarModel): Thumbnail | null => {
  // a dialect's kinds too: the registry istar-ts builds for the model's metamodel
  const registry = registryForMetamodel(
    metamodelOf(model),
  ) as unknown as Parameters<typeof modelToFlow>[1];
  const flow = modelToFlow(model, registry);
  const boxes = new Map<string, ThumbnailBox>();
  const actors: ThumbnailBox[] = [];
  const elements: Thumbnail['elements'] = [];
  for (const node of flow.nodes) {
    if (node.hidden) continue;
    const origin = flow.origins.get(node.id);
    if (!origin) continue;
    const box = {
      x: origin.x,
      y: origin.y,
      w: node.width ?? 0,
      h: node.height ?? 0,
    };
    boxes.set(node.id, box);
    if (node.type === 'istarActor') actors.push(box);
    else {
      const element = model.elements.get(node.id);
      elements.push({ ...box, shape: shapeOf(element?.kind ?? '') });
    }
  }
  const all = [...actors, ...elements];
  if (all.length === 0) return null;
  const centre = (b: ThumbnailBox) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  const links: Thumbnail['links'] = [];
  for (const edge of flow.edges) {
    const from = boxes.get(edge.source);
    const to = boxes.get(edge.target);
    if (!from || !to) continue;
    const a = centre(from);
    const b = centre(to);
    const link = edge.data && model.links.get(edge.data.linkId);
    links.push({
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      line: lineOf(link?.kind ?? ''),
    });
  }
  const minX = Math.min(...all.map((b) => b.x));
  const minY = Math.min(...all.map((b) => b.y));
  const maxX = Math.max(...all.map((b) => b.x + b.w));
  const maxY = Math.max(...all.map((b) => b.y + b.h));
  return {
    box: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
    actors,
    elements,
    links,
  };
};

/**
 * A model text's thumbnail (a Recent entry's, a preview's), read with `mode`
 * (by default, the one it records); null when it doesn't read.
 */
export const thumbnailOfText = (
  text: string,
  mode?: string | null,
): Thumbnail | null => {
  try {
    return thumbnailOf(
      mode === undefined ? parseModel(text) : parseModel(text, mode),
    );
  } catch {
    return null;
  }
};
