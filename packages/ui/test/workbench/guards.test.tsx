/**
 * `rejectEdit`/`oneActorOnly` and an edgeV2 engine check as dispatcher guards
 * (goal-controller#412): a rejected operation never reaches the model (no
 * apply-then-undo round trip, so it never sits on the redo stack either),
 * and a compound with one bad child is rejected as a whole.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import React, { useEffect } from 'react';
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
import { mockReactFlowDom } from './reactFlowDom';

const ISTAR = readFileSync(
  join(__dirname, '../../../../examples/edge/simpleChoice.txt'),
  'utf8',
);
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
        guards={[edgeOneActor]}
        postGuards={[edgeV2ResourceBoundsGuard]}
      />
    </WorkbenchProvider>,
  );
  return { wb: () => wb!, container: view.container };
};

const opened = async () => {
  const view = workbench();
  await act(() => view.wb().openModelFile('simpleChoice.txt', ISTAR));
  await waitFor(() => expect(view.wb().tree).not.toBeNull());
  return view;
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

  it("edgeV2's resource-bounds check rejects a resource property edit it can't read", async () => {
    const { wb } = await opened();
    const before = wb().session.store.getModel().elements.get(R1);

    // drops initialValue/lowerBound/upperBound: an int resource needs all three
    const result = await wb()
      .dispatcherFor('canvas')
      .dispatch({
        kind: 'istar.updateProperties',
        elementId: R1,
        properties: { type: 'int', initialValue: null },
      });

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.diagnostics[0]?.message).toContain('[INVALID RESOURCE]');
    expect(wb().session.store.getModel().elements.get(R1)).toEqual(before);
  });

  it('a resource edit the check accepts applies normally', async () => {
    const { wb } = await opened();

    const result = await wb()
      .dispatcherFor('canvas')
      .dispatch({
        kind: 'istar.updateProperties',
        elementId: R1,
        properties: { initialValue: 'true' },
      });

    expect(result.ok).toBe(true);
    expect(
      wb().session.store.getModel().elements.get(R1)?.customProperties,
    ).toMatchObject({ initialValue: 'true' });
  });
});
