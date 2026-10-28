/**
 * The engine worker (goal-controller#413) feeds `transform`/`analyze` the
 * mirror's own serialization (`toPistar(mirror.getModel())`), not the file's
 * own text like the inline call used to (goal-controller#432 review,
 * findings 3-4). For every example the workbench can open, this checks that
 * round-tripping a parsed model through `toPistar` and back changes nothing
 * `parseModel` would see: the engine worker's input is as faithful as the
 * text it replaced.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createModelStore, toPistar } from '@istar-ts/core';
import { describe, expect, it } from 'vitest';
import manifest from '@/lib/examples-manifest.json';
import { parseModel } from '@/lib/workbench/dialects';
import { writeModelMode } from '@/lib/workbench/pistar';
import { exampleMode } from '@/services/examples';
import type { ProjectIndexEntry } from '@/lib/project';

const ROOT = join(__dirname, '../../../..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

describe('toPistar(mirror.getModel()) round-trips every example (goal-controller#432 review)', () => {
  for (const entry of manifest as unknown as ProjectIndexEntry[]) {
    for (const file of entry.models) {
      it(`${entry.root}/${file}`, () => {
        // as the workbench opens it (services/examples.ts's openExample):
        // the engine or dialect it was recorded for, written into the text
        const raw = read(`examples/${entry.root}/${file}`);
        const mode = exampleMode(entry);
        const text = mode ? writeModelMode(raw, mode) : raw;
        const original = parseModel(text);
        const store = createModelStore(original);
        const roundTripText = toPistar(store.getModel());
        const roundTripped = parseModel(roundTripText);
        // deep equality, not the text: key order and whitespace don't count
        expect(roundTripped).toEqual(original);
      });
    }
  }
});
