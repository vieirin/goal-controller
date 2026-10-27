/**
 * An analysis failure (goal-controller issue), closed over: once an engine's
 * analyse throws (its own bug, or a stale build), the Problems count must
 * drop to zero as soon as the model is closed. Before the fix, the badge
 * and status bar still counted the stale analysis problem while the
 * Problems view itself said "No model open." — counts and the view
 * disagreed.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';

vi.mock('@/services', async (original) => ({
  ...(await original<typeof import('@/services')>()),
  analyze: () => {
    throw new Error('(0 , import_dialect10.propertyOf) is not a function');
  },
}));

describe('problems after the model closes', () => {
  afterEach(() => {
    cleanup();
  });

  it('drops to zero once an analysis failure’s model is closed', async () => {
    let workbench: Workbench | null = null;
    const Probe = () => {
      workbench = useWorkbench();
      return null;
    };
    render(
      <WorkbenchProvider lockedEngine='edgev2'>
        <Probe />
      </WorkbenchProvider>,
    );
    act(() => workbench!.setText('{"actors":[]}', 'open'));
    await waitFor(() =>
      expect(workbench!.problems.some((p) => p.severity === 'error')).toBe(
        true,
      ),
    );
    act(() => workbench!.closeModel());
    expect(workbench!.hasModel).toBe(false);
    expect(workbench!.problems).toEqual([]);
  });
});
