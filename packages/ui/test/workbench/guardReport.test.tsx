/**
 * A raw write (`wb.setText`) bypasses the mode's guards (goal-controller#471):
 * - an import or a file open applies the text as written, the active mode's
 *   guards and post-guards run afterwards in report mode, and their
 *   diagnostics show as Problems, anchored to elements where they have one;
 * - a conversion or a ModelSettings edit is checked first, like any other
 *   dispatch: a rejection leaves the model untouched, in the mode it was
 *   already in, and shows where every other guard rejection does
 *   (`wb.editRejected`).
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import WorkbenchCanvas from '@/components/workbench/engines/shared/WorkbenchCanvas';
import { writeModelMode } from '@/lib/workbench/pistar';
import { mockReactFlowDom } from './reactFlowDom';

const ISTAR = readFileSync(
  join(__dirname, '../../../../examples/edge/simpleChoice.txt'),
  'utf8',
);
const EDGEV2_ISTAR = writeModelMode(ISTAR, 'edgev2');

/** `text`'s first actor, duplicated under a new id: oneActorOnly's "a second actor". */
const withSecondActor = (text: string): string => {
  const model: { actors: { id: string }[] } = JSON.parse(text);
  const [actor] = model.actors;
  return JSON.stringify({
    ...model,
    actors: [...model.actors, { ...actor, id: `${actor!.id}-2`, nodes: [] }],
  });
};
const TWO_ACTORS_EDGEV2 = withSecondActor(EDGEV2_ISTAR);

beforeAll(mockReactFlowDom);
afterEach(() => cleanup());

const workbench = () => {
  let wb: Workbench | null = null;
  const Probe = () => {
    const current = useWorkbench();
    useEffect(() => {
      wb = current;
    });
    return null;
  };
  render(
    <WorkbenchProvider lockedEngine={null}>
      <Probe />
      <WorkbenchCanvas extensions={[]} />
    </WorkbenchProvider>,
  );
  return () => wb!;
};

describe('an import or an open (goal-controller#471)', () => {
  it('a two-actor model into an Edge mode applies it and shows the Problem', async () => {
    const wb = workbench();
    await act(() => wb().openModelFile('twoActors.txt', TWO_ACTORS_EDGEV2));
    await waitFor(() => expect(wb().mode).toBe('edgev2'));
    await waitFor(() => expect(wb().tree).not.toBeNull());

    const actors = [...wb().session.store.getModel().elements.values()].filter(
      (element) => element.kind === 'istar.Actor',
    );
    expect(actors).toHaveLength(2);
    await waitFor(() =>
      expect(
        wb().problems.some(
          (p) => p.source === 'shield' && p.message.includes('single actor'),
        ),
      ).toBe(true),
    );
  });

  it('a valid import shows no guard Problem', async () => {
    const wb = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', EDGEV2_ISTAR));
    await waitFor(() => expect(wb().mode).toBe('edgev2'));
    await waitFor(() => expect(wb().tree).not.toBeNull());

    expect(wb().problems.some((p) => p.source === 'shield')).toBe(false);
  });
});

describe('a conversion or a ModelSettings edit (goal-controller#471)', () => {
  it('converting to a mode whose guard the model breaks is rejected, the model untouched', async () => {
    const wb = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    await waitFor(() => expect(wb().tree).not.toBeNull());
    const before = wb().session.store.getModel();
    const beforeMode = wb().mode;

    act(() => wb().applyConversion('edgev2', TWO_ACTORS_EDGEV2));
    await waitFor(() => expect(wb().editRejected.length).toBeGreaterThan(0));

    expect(wb().editRejected[0]?.message).toContain('single actor');
    expect(wb().session.store.getModel()).toBe(before);
    expect(wb().mode).toBe(beforeMode);
  });

  it("a ModelSettings change (the setup flow's direct conversion) that breaks a guard is rejected, the model untouched", async () => {
    // ModelSettingsModal's setup flow (an uploaded model's engine, chosen in
    // the dialog) applies its checked plan with the same `applyConversion`
    const wb = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    await waitFor(() => expect(wb().tree).not.toBeNull());
    const before = wb().session.store.getModel();

    act(() => wb().applyConversion('edgev2', TWO_ACTORS_EDGEV2));
    await waitFor(() => expect(wb().editRejected.length).toBeGreaterThan(0));

    expect(wb().session.store.getModel()).toBe(before);
    expect(wb().mode).not.toBe('edgev2');
  });

  it('a conversion the guard accepts applies, and the mode switches', async () => {
    const wb = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    await waitFor(() => expect(wb().tree).not.toBeNull());

    act(() => wb().applyConversion('edgev2', EDGEV2_ISTAR));
    await waitFor(() => expect(wb().mode).toBe('edgev2'));

    expect(wb().editRejected).toEqual([]);
  });
});
