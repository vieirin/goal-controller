/**
 * Diffing a text edit into dispatched actions (goal-controller#411): the
 * risky part of SourceView's port, so it is tested on its own, against a
 * real session and dispatcher (no DOM): applying the diff reproduces the
 * exact bytes of the edited text, and one `glspUndo` restores the original.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { moveElement, updateElement, withFileMetamodel } from '@istar-ts/core';
import type { AnyModel } from '@goal-controller/lib';
import { emptyModel, parseModel } from '@/lib/workbench/dialects';
import { serializeModel, writeModelMode } from '@/lib/workbench/pistar';
import { createModelSession } from '@/lib/workbench/modelSession';
import { applyTextThroughActions } from '@/lib/workbench/modelDiff';

const ROOT = join(__dirname, '../../../..');
const ISTAR = readFileSync(
  join(ROOT, 'examples/edge/simpleChoice.txt'),
  'utf8',
);
const ANOTHER_MODEL = readFileSync(
  join(ROOT, 'examples/edge/anotherSimple.txt'),
  'utf8',
);
// a piStar-ext model (its mode recorded, so it is read with its file
// metamodel applied): examples/pistar-ext/minimal.txt isn't self-describing
const PISTAR_EXT = writeModelMode(
  readFileSync(join(ROOT, 'examples/pistar-ext/minimal.txt'), 'utf8'),
  'pistarext',
);

// simpleChoice.txt's ids
const ACTOR = '08f209f3-3f64-4f1e-9638-d36d0f1de8a8';
const G1 = '117b97d7-775b-41a9-8fec-9e923edde772';
const G2 = '10d8d506-1fd6-4808-b711-86dba7aca2f0';
const NEEDED_BY_LINK = '63f6cc85-fc79-46d4-b1a8-dfff1e08cc50';

/**
 * Applies `after` over `before` through a real session's dispatcher, as
 * SourceView does, and checks the round trip: the resulting text is `after`
 * byte for byte, and one `glspUndo` gives back `before` byte for byte.
 * `expectFallback`: whether this case is expected to fall back to a
 * host-side replace (no dispatch) instead of a diffed action.
 */
const roundTrip = async (
  before: string,
  after: string,
  expectFallback = false,
) => {
  const beforeModel: AnyModel = before.trim()
    ? parseModel(before)
    : emptyModel();
  let text = before;
  let fellBack = false;
  const session = createModelSession(beforeModel, (change) => {
    text = serializeModel(change.model, text);
  });
  await applyTextThroughActions(
    session.dispatcherFor('inspector'),
    session.store,
    after,
    () => {
      fellBack = true;
      text = after;
    },
  );
  expect(fellBack).toBe(expectFallback);
  expect(text).toBe(after);
  if (!expectFallback) {
    await session.dispatcherFor('inspector').dispatch({ kind: 'glspUndo' });
    expect(text).toBe(before);
  }
  session.dispose();
};

describe('diffing SourceView edits into actions (#411)', () => {
  it('a rename', async () => {
    const before = parseModel(ISTAR);
    const after = serializeModel(
      updateElement(before, G1, { name: 'G1: Renamed' }),
      ISTAR,
    );
    await roundTrip(ISTAR, after);
  });

  it('a property change', async () => {
    const before = parseModel(ISTAR);
    const g1 = before.elements.get(G1)!;
    const after = serializeModel(
      updateElement(before, G1, {
        customProperties: { ...g1.customProperties, Description: 'changed' },
      }),
      ISTAR,
    );
    await roundTrip(ISTAR, after);
  });

  it('an added node', async () => {
    const before = parseModel(ISTAR);
    const elements = new Map(before.elements);
    elements.set('new-g4', {
      id: 'new-g4',
      kind: 'istar.Goal',
      name: 'G4: New',
      x: 500,
      y: 500,
      parent: ACTOR,
    });
    const after = serializeModel({ ...before, elements }, ISTAR);
    await roundTrip(ISTAR, after);
  });

  it('a removed link', async () => {
    const before = parseModel(ISTAR);
    const links = new Map(before.links);
    links.delete(NEEDED_BY_LINK);
    const after = serializeModel({ ...before, links }, ISTAR);
    await roundTrip(ISTAR, after);
  });

  it('a moved node', async () => {
    const before = parseModel(ISTAR);
    const g2 = before.elements.get(G2)!;
    const after = serializeModel(
      moveElement(before, G2, g2.x + 40, g2.y + 10),
      ISTAR,
    );
    await roundTrip(ISTAR, after);
  });

  it('a change to the metamodel block (istar.setFileMetamodel)', async () => {
    const before = parseModel(PISTAR_EXT);
    const after = serializeModel(
      withFileMetamodel(before, { name: 'iStar4RationalAgents', elements: [] }),
      PISTAR_EXT,
    );
    await roundTrip(PISTAR_EXT, after);
  });

  it('a paste of a whole different model falls back (it reorders links, which the diff does not keep)', async () => {
    await roundTrip(ISTAR, ANOTHER_MODEL, true);
  });

  it('falls back on text that does not parse', async () => {
    await roundTrip(ISTAR, '{ "actors": [', true);
  });

  it('falls back on a change the vocabulary has no action for (model.extra)', async () => {
    const before = parseModel(ISTAR);
    const after = serializeModel(
      { ...before, extra: { metamodelVersion: '1.0' } },
      ISTAR,
    );
    await roundTrip(ISTAR, after, true);
  });
});
