/**
 * Two `setText` callers in this slice, ported to dispatch an action
 * (goal-controller#411), each reaching the model through
 * `dispatcherFor('inspector')`, undone by one `glspUndo`:
 * - `requestMode`'s mode record (WorkbenchContext.tsx): recording the
 *   current engine in a file that doesn't say so yet is one
 *   `istar.replaceModel` of the written text;
 * - `writeOptions`'s engine options (WorkbenchContext.tsx): they live in
 *   the model's top-level `project` key, istar-ts's `extra` — one
 *   `istar.updateModelExtra`.
 *
 * `ModelSettingsModal`'s framework switch (target `pistar`, only switching
 * into iStar 2.0 from a DSM3-goals framework, KAOS or NFR) dispatches too,
 * as one `istar.replaceModel` of the target's empty model (it needs the
 * whole file: the root `istar` field a DSM3-goals model lacks) — see
 * frameworkSettings.test.tsx.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import { writeModelMode } from '@/lib/workbench/pistar';
import { withEngineOptions } from '@/lib/workbench/projectSettings';
import { DEFAULT_OPTIONS } from '@/lib/workbench/types';

const ROOT = join(__dirname, '../../../..');
const ISTAR = readFileSync(
  join(ROOT, 'examples/edge/simpleChoice.txt'),
  'utf8',
);

afterEach(() => cleanup());

const workbench = () => {
  let wb: Workbench | null = null;
  const Probe = () => {
    wb = useWorkbench();
    return null;
  };
  render(
    <WorkbenchProvider lockedEngine={null}>
      <Probe />
    </WorkbenchProvider>,
  );
  return () => wb!;
};

describe('requestMode: recording the mode dispatches an action (#411)', () => {
  it('records the engine in a file that does not say yet, as an action; one glspUndo takes it back', async () => {
    const wb = workbench();
    // opens directly in edge mode (its own record says so), then the record
    // is stripped by a plain text edit: the settings stay edge, pistar false
    await act(() =>
      wb().openFile('simpleChoice.txt', writeModelMode(ISTAR, 'edge')),
    );
    await waitFor(() => expect(wb().mode).toBe('edge'));
    act(() => wb().setText(ISTAR, 'source'));
    const before = wb().text;
    expect(before).toBe(ISTAR);
    expect(before).not.toContain('"engine"');
    const dispatch = vi.spyOn(wb().dispatcherFor('inspector'), 'dispatch');
    const setText = vi.spyOn(wb(), 'setText');

    act(() => wb().requestMode('edge'));

    await waitFor(() => expect(wb().text).not.toBe(before));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]![0]).toMatchObject({
      kind: 'istar.replaceModel',
    });
    expect(setText).not.toHaveBeenCalled();
    expect(wb().text).toContain('"engine": "edge"');
    expect(wb().text).toBe(writeModelMode(ISTAR, 'edge'));

    await act(async () => {
      await wb().dispatcherFor('inspector').dispatch({ kind: 'glspUndo' });
    });
    // one glspUndo takes back the dispatched action; the test's own setup
    // edit (stripping the record) is a separate, earlier undo step
    expect(wb().text).toBe(before);
  });
});

describe('writeOptions: engine options dispatch an action (#411)', () => {
  it('writes the "project" key as istar.updateModelExtra; one glspUndo takes it back', async () => {
    const wb = workbench();
    await act(() =>
      wb().openFile('simpleChoice.txt', writeModelMode(ISTAR, 'edge')),
    );
    await waitFor(() => expect(wb().mode).toBe('edge'));
    const before = wb().text;
    expect(before).not.toContain('"project"');
    const dispatch = vi.spyOn(wb().dispatcherFor('inspector'), 'dispatch');
    const setText = vi.spyOn(wb(), 'setText');

    const nextOptions = { ...wb().options, achievabilitySpace: 10 };
    const expected = withEngineOptions(
      before,
      'edge',
      nextOptions,
      DEFAULT_OPTIONS,
    );

    act(() => wb().setOptions(nextOptions));

    await waitFor(() => expect(wb().text).not.toBe(before));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]![0]).toMatchObject({
      kind: 'istar.updateModelExtra',
    });
    expect(setText).not.toHaveBeenCalled();
    expect(wb().text).toBe(expected);

    await act(async () => {
      await wb().dispatcherFor('inspector').dispatch({ kind: 'glspUndo' });
    });
    expect(wb().text).toBe(before);
  });
});
