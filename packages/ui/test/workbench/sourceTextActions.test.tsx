/**
 * `requestMode`'s `setText` call (WorkbenchContext.tsx), ported to dispatch
 * an action (goal-controller#411): recording the current engine in a file
 * that doesn't say so yet is one `istar.updateDiagram`, reaching the model
 * through `dispatcherFor('inspector')`, undone by one `glspUndo`.
 *
 * The other two `setText` callers in this slice stay on the host-side
 * replace, each for its own reason, both documented where they are:
 * - `ModelSettingsModal`'s framework switch (`empty`, target `pistar`) only
 *   runs switching into iStar 2.0 from a DSM3-goals framework (KAOS, NFR),
 *   whose `tool`/`metamodelVersion` the diff can't express into an action;
 * - `writeOptions`'s engine options (WorkbenchContext.tsx) live in the
 *   model's top-level `project` key, istar-ts's `extra` — no action writes
 *   that either (see `lib/workbench/modelDiff.ts`'s module doc).
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
      kind: 'istar.updateDiagram',
    });
    expect(setText).not.toHaveBeenCalled();
    expect(wb().text).toContain('"engine": "edge"');

    await act(async () => {
      await wb().dispatcherFor('inspector').dispatch({ kind: 'glspUndo' });
    });
    // one glspUndo takes back the dispatched action; the test's own setup
    // edit (stripping the record) is a separate, earlier undo step
    expect(wb().text).toBe(before);
  });
});
