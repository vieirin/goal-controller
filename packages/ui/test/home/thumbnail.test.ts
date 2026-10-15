/**
 * The home page's thumbnails (lib/workbench/thumbnail.ts): a model laid out as
 * istar-ts lays it out on the canvas, its elements by shape and its links by
 * refinement; a preview (scripts/examples-manifest.mjs, no text) draws the
 * same as its model.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { thumbnailOfText } from '@/lib/workbench/thumbnail';
import manifest from '@/lib/examples-manifest.json';
import { previewOf } from '@/scripts/examplePreview.mjs';

const EXAMPLES = join(__dirname, '../../../../examples');
const read = (path: string) => readFileSync(join(EXAMPLES, path), 'utf8');
// what scripts/examples-manifest.mjs writes to public/example-previews.json
const PREVIEWS: Record<string, unknown> = Object.fromEntries(
  manifest.map((entry) => [
    entry.path,
    previewOf(read(`${entry.root}/${entry.models[0]}`)),
  ]),
);

describe('thumbnailOfText', () => {
  it('draws each element by its shape and each link by its refinement, inside its box', () => {
    const text = read('mutrose/medicine-delivery/gm/MedicineDelivery.txt');
    const model = JSON.parse(text);
    const nodes = model.actors.flatMap((a: { nodes: unknown[] }) => a.nodes);
    const thumbnail = thumbnailOfText(text)!;
    expect(thumbnail.actors).toHaveLength(model.actors.length);
    expect(thumbnail.elements).toHaveLength(nodes.length);
    expect(thumbnail.links).toHaveLength(model.links.length);
    const shapes = new Set(thumbnail.elements.map((e) => e.shape));
    expect([...shapes].sort()).toEqual(['goal', 'task']);
    expect(thumbnail.links.every((l) => l.line === 'and')).toBe(true);
    const { box } = thumbnail;
    for (const e of [...thumbnail.elements, ...thumbnail.actors]) {
      expect(e.x).toBeGreaterThanOrEqual(box.x);
      expect(e.y).toBeGreaterThanOrEqual(box.y);
      expect(e.x + e.w).toBeLessThanOrEqual(box.x + box.w + 1e-9);
      expect(e.y + e.h).toBeLessThanOrEqual(box.y + box.h + 1e-9);
    }
  });

  it('tells OR refinements from AND ones', () => {
    const lines = new Set(
      thumbnailOfText(read('edge/simpleChoice.txt'))!.links.map((l) => l.line),
    );
    expect(lines.has('or')).toBe(true);
  });

  it('draws a preview as its model, and every example has one that draws', () => {
    const entry = manifest.find((e) => e.path === 'mutrose/medicine-delivery')!;
    const preview = JSON.stringify(PREVIEWS[entry.path]);
    expect(preview).not.toContain('Deliver Medicines');
    expect(thumbnailOfText(preview)).toEqual(
      thumbnailOfText(read(`${entry.root}/${entry.models[0]}`)),
    );
    for (const { path, group } of manifest)
      expect(
        // a piStar-ext model records no mode: read as its folder's
        thumbnailOfText(
          JSON.stringify(PREVIEWS[path]),
          group === 'pistar-ext' ? 'pistarext' : undefined,
        ),
        path,
      ).not.toBeNull();
  });

  it('draws nothing for what does not read', () => {
    expect(thumbnailOfText('not json')).toBeNull();
    expect(thumbnailOfText('{"actors":[],"links":[]}')).toBeNull();
  });
});
