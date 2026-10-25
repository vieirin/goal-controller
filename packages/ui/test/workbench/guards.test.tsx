/**
 * `rejectEdit`/`oneActorOnly` and an edgeV2 engine check as dispatcher guards
 * (goal-controller#412): a rejected operation never reaches the model (no
 * apply-then-undo round trip, so it never sits on the redo stack either),
 * and a compound with one bad child is rejected as a whole.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import React, { useEffect, useState } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import WorkbenchCanvas from '@/components/workbench/engines/shared/WorkbenchCanvas';
import {
  edgeOneActor,
  edgeV2ResourceBoundsGuard,
} from '@/components/workbench/engines/edgeFamily/extensions';
import { writeModelMode } from '@/lib/workbench/pistar';
import { mockReactFlowDom } from './reactFlowDom';

const ISTAR = readFileSync(
  join(__dirname, '../../../../examples/edge/simpleChoice.txt'),
  'utf8',
);
// edgev2's mode recorded: `wb.mode` (and so the session's own per-mode guards
// registry, goal-controller#439 review) must say 'edgev2' for these guards to
// run at all — a plain file with no recorded engine opens in piStar mode
const EDGEV2_ISTAR = writeModelMode(ISTAR, 'edgev2');
// in simpleChoice.txt: one actor, and R1, a bool resource under it
const ACTOR = '08f209f3-3f64-4f1e-9638-d36d0f1de8a8';
const R1 = '6630712e-f481-4da2-a960-ad9e89cc2cc9';

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
  const view = render(
    <WorkbenchProvider lockedEngine={null}>
      <Probe />
      <WorkbenchCanvas
        extensions={[]}
        postGuards={[edgeOneActor, edgeV2ResourceBoundsGuard]}
      />
    </WorkbenchProvider>,
  );
  return { wb: () => wb!, container: view.container };
};

const opened = async () => {
  const view = workbench();
  await act(() => view.wb().openModelFile('simpleChoice.txt', EDGEV2_ISTAR));
  await waitFor(() => expect(view.wb().tree).not.toBeNull());
  await waitFor(() => expect(view.wb().mode).toBe('edgev2'));
  return view;
};

/**
 * A diagram that can be unmounted on demand, simulating the Source tab
 * (`ModelTabView` renders `SourceView` in its place, not beside it) while
 * the workbench provider — and an edit from any surface — stays mounted.
 */
const workbenchWithToggleableCanvas = () => {
  let wb: Workbench | null = null;
  let hide: (() => void) | null = null;
  const Probe = () => {
    const current = useWorkbench();
    useEffect(() => {
      wb = current;
    });
    return null;
  };
  const ToggleableCanvas = () => {
    const [shown, setShown] = useState(true);
    hide = () => setShown(false);
    return shown ? (
      <WorkbenchCanvas
        extensions={[]}
        postGuards={[edgeOneActor, edgeV2ResourceBoundsGuard]}
      />
    ) : null;
  };
  render(
    <WorkbenchProvider lockedEngine={null}>
      <Probe />
      <ToggleableCanvas />
    </WorkbenchProvider>,
  );
  return { wb: () => wb!, hideCanvas: () => act(() => hide!()) };
};

describe('a guard rejects an edit before it applies (#412)', () => {
  it('a second actor under oneActorOnly never reaches the model or wb.text', async () => {
    const { wb } = await opened();
    const before = wb().session.store.getModel();
    const text = wb().text;

    const result = await wb()
      .dispatcherFor('canvas')
      .dispatch({ kind: 'createNode', elementTypeId: 'istar.Actor' });

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.diagnostics[0]?.message).toContain('single actor');
    expect(wb().session.store.getModel()).toBe(before);
    expect(wb().text).toBe(text);
    expect(wb().canUndo).toBe(false);
  });

  it('redo after a rejection does nothing', async () => {
    const { wb } = await opened();
    const before = wb().session.store.getModel();

    const rejected = await wb()
      .dispatcherFor('canvas')
      .dispatch({ kind: 'createNode', elementTypeId: 'istar.Actor' });
    expect(rejected.ok).toBe(false);

    const redo = await wb()
      .dispatcherFor('canvas')
      .dispatch({ kind: 'glspRedo' });
    expect(redo.ok).toBe(true);
    expect(wb().session.store.getModel()).toBe(before);
    expect(wb().canRedo).toBe(false);
  });

  it('a compound with one bad child (a second actor) is rejected as a whole', async () => {
    const { wb } = await opened();
    const before = wb().session.store.getModel();
    const tasksBefore = [...before.elements.values()].filter(
      (element) => element.kind === 'istar.Task',
    ).length;

    const result = await wb()
      .dispatcherFor('canvas')
      .dispatch({
        kind: 'compound',
        operationList: [
          {
            kind: 'createNode',
            elementTypeId: 'istar.Task',
            containerId: ACTOR,
          },
          { kind: 'createNode', elementTypeId: 'istar.Actor' },
        ],
      });

    expect(result.ok).toBe(false);
    expect(wb().session.store.getModel()).toBe(before);
    // the good child (the task) is not applied either
    expect(
      [...wb().session.store.getModel().elements.values()].filter(
        (element) => element.kind === 'istar.Task',
      ),
    ).toHaveLength(tasksBefore);
  });

  it(
    "edgeV2's resource-bounds check warns, but applies, a resource property " +
      'edit it cannot read yet (#439 review: never an error)',
    async () => {
      const { wb } = await opened();

      // drops initialValue/lowerBound/upperBound: an int resource needs all
      // three, but the Inspector sends one key per edit — every intermediate
      // state would be rejected forever if this were an error
      const result = await wb()
        .dispatcherFor('canvas')
        .dispatch({
          kind: 'istar.updateProperties',
          elementId: R1,
          properties: { type: 'int', initialValue: null },
        });

      expect(result.ok).toBe(true);
      expect(
        result.ok &&
          result.diagnostics?.some(
            (d) =>
              d.severity === 'warning' &&
              d.message.includes('[INVALID RESOURCE]'),
          ),
      ).toBe(true);
      expect(
        wb().session.store.getModel().elements.get(R1)?.customProperties,
      ).toMatchObject({ type: 'int' });
    },
  );

  it('a resource edit the check accepts applies normally, with no diagnostics', async () => {
    const { wb } = await opened();

    const result = await wb()
      .dispatcherFor('canvas')
      .dispatch({
        kind: 'istar.updateProperties',
        elementId: R1,
        properties: { initialValue: 'true' },
      });

    expect(result.ok).toBe(true);
    expect(result.ok && (result.diagnostics?.length ?? 0)).toBe(0);
    expect(
      wb().session.store.getModel().elements.get(R1)?.customProperties,
    ).toMatchObject({ initialValue: 'true' });
  });

  it('switching R1 bool→int and setting its bounds one key at a time ends valid, warned along the way (#439)', async () => {
    const { wb } = await opened();
    const dispatchOne = (properties: Record<string, string | null>) =>
      wb().dispatcherFor('canvas').dispatch({
        kind: 'istar.updateProperties',
        elementId: R1,
        properties,
      });

    const steps: Record<string, string | null>[] = [
      { type: 'int', initialValue: null }, // missing all three bounds
      { lowerBound: '0' }, // still missing initialValue/upperBound
      { upperBound: '5' }, // still missing initialValue
      { initialValue: '5' }, // now 0 <= 5 <= 5: valid
    ];
    const results = [];
    for (const properties of steps) results.push(await dispatchOne(properties));

    // every step applied: none was ever rejected
    expect(results.every((r) => r.ok)).toBe(true);
    // every step but the last was still invalid, warned about it
    expect(
      results
        .slice(0, -1)
        .every(
          (r) => r.ok && r.diagnostics?.some((d) => d.severity === 'warning'),
        ),
    ).toBe(true);
    // the last step leaves it valid: no diagnostic left
    const last = results[results.length - 1]!;
    expect(last.ok && (last.diagnostics?.length ?? 0)).toBe(0);
    expect(
      wb().session.store.getModel().elements.get(R1)?.customProperties,
    ).toMatchObject({
      type: 'int',
      lowerBound: '0',
      upperBound: '5',
      initialValue: '5',
    });
  });
});

describe('a guard still applies once the diagram unmounts (#439 review)', () => {
  it('an inspector edit on the Source tab (the diagram unmounted) is still rejected by oneActorOnly', async () => {
    const view = workbenchWithToggleableCanvas();
    await act(() => view.wb().openModelFile('simpleChoice.txt', EDGEV2_ISTAR));
    await waitFor(() => expect(view.wb().tree).not.toBeNull());
    await waitFor(() => expect(view.wb().mode).toBe('edgev2'));

    // switching to the Source tab unmounts the diagram (and its GuardsBridge);
    // the session's own per-mode registry must still have the guard set
    view.hideCanvas();
    const before = view.wb().session.store.getModel();

    const result = await view
      .wb()
      .dispatcherFor('inspector')
      .dispatch({ kind: 'createNode', elementTypeId: 'istar.Actor' });

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.diagnostics[0]?.message).toContain('single actor');
    expect(view.wb().session.store.getModel()).toBe(before);
  });

  it("an inspector edit on the Source tab is still rejected by edgeV2's resource-bounds check", async () => {
    const view = workbenchWithToggleableCanvas();
    await act(() => view.wb().openModelFile('simpleChoice.txt', EDGEV2_ISTAR));
    await waitFor(() => expect(view.wb().tree).not.toBeNull());
    await waitFor(() => expect(view.wb().mode).toBe('edgev2'));

    view.hideCanvas();

    const result = await view
      .wb()
      .dispatcherFor('inspector')
      .dispatch({
        kind: 'istar.updateProperties',
        elementId: R1,
        properties: { type: 'int', initialValue: null },
      });

    // a warning, not a rejection (#1 above), but still raised with no diagram mounted
    expect(result.ok).toBe(true);
    expect(
      result.ok &&
        result.diagnostics?.some((d) =>
          d.message.includes('[INVALID RESOURCE]'),
        ),
    ).toBe(true);
  });
});

describe('the rejection banner clears (#439 review)', () => {
  const reject = (wb: () => Workbench) =>
    act(() =>
      wb().notifyEditRejected([
        { elementId: '', severity: 'error', message: 'nope' },
      ]),
    );

  it('clears on the next successful dispatch, from any surface', async () => {
    const { wb } = await opened();
    reject(wb);
    expect(wb().editRejected.length).toBeGreaterThan(0);

    await act(async () => {
      await wb().dispatcherFor('canvas').dispatch({
        kind: 'createNode',
        elementTypeId: 'istar.Task',
        containerId: ACTOR,
      });
    });

    expect(wb().editRejected).toEqual([]);
  });

  it('clears on a model switch', async () => {
    const { wb } = await opened();
    reject(wb);
    expect(wb().editRejected.length).toBeGreaterThan(0);

    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));

    expect(wb().editRejected).toEqual([]);
  });

  it('clears on a mode change', async () => {
    const { wb } = await opened();
    reject(wb);
    expect(wb().editRejected.length).toBeGreaterThan(0);

    act(() => wb().requestMode('pistar'));
    await waitFor(() => expect(wb().mode).toBe('pistar'));

    expect(wb().editRejected).toEqual([]);
  });
});
