/**
 * `beginAgentChanges`/`endAgentChanges`/`clearAgentChanges` on the workbench
 * itself (goal-controller#415's drawer runs the first two around each of its
 * runs): several runs accumulate into one `agentChanges`, and opening another
 * model drops it.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import React, { useEffect } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';

const ISTAR = readFileSync(
  join(__dirname, '../../../../examples/edge/simpleChoice.txt'),
  'utf8',
);
const G1 = '117b97d7-775b-41a9-8fec-9e923edde772';
const G2 = '10d8d506-1fd6-4808-b711-86dba7aca2f0';

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
    </WorkbenchProvider>,
  );
  return () => wb!;
};

const opened = async () => {
  const wb = workbench();
  await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
  await waitFor(() => expect(wb().tree).not.toBeNull());
  return wb;
};

const rename = async (wb: () => Workbench, labelId: string, text: string) =>
  act(async () => {
    await wb()
      .dispatcherFor('inspector')
      .dispatch({ kind: 'applyLabelEdit', labelId, text });
  });

describe('agent changes on the workbench', () => {
  it('starts empty, with nothing snapshotted to diff against', async () => {
    const wb = await opened();
    act(() => wb().endAgentChanges());
    expect(wb().agentChanges).toEqual({
      added: new Set(),
      edited: new Set(),
      removed: new Set(),
    });
  });

  it('accumulates across runs: a later run’s edit joins an earlier run’s, both kept', async () => {
    const wb = await opened();

    act(() => wb().beginAgentChanges());
    await rename(wb, G1, 'First run');
    act(() => wb().endAgentChanges());
    await waitFor(() => expect(wb().agentChanges.edited.has(G1)).toBe(true));

    act(() => wb().beginAgentChanges());
    await rename(wb, G2, 'Second run');
    act(() => wb().endAgentChanges());

    await waitFor(() => {
      expect(wb().agentChanges.edited.has(G1)).toBe(true);
      expect(wb().agentChanges.edited.has(G2)).toBe(true);
    });
  });

  it('is dropped by clearAgentChanges, and by opening another model', async () => {
    const wb = await opened();
    act(() => wb().beginAgentChanges());
    await rename(wb, G1, 'Changed');
    act(() => wb().endAgentChanges());
    await waitFor(() =>
      expect(wb().agentChanges.edited.size).toBeGreaterThan(0),
    );

    act(() => wb().clearAgentChanges());
    expect(wb().agentChanges.edited.size).toBe(0);

    act(() => wb().beginAgentChanges());
    await rename(wb, G1, 'Changed again');
    act(() => wb().endAgentChanges());
    await waitFor(() =>
      expect(wb().agentChanges.edited.size).toBeGreaterThan(0),
    );

    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    await waitFor(() => expect(wb().tree).not.toBeNull());
    expect(wb().agentChanges.edited.size).toBe(0);
  });
});
