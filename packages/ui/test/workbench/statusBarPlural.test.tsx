/** The status bar's error/warning counts read right in the singular (goal-controller#469). */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import { StatusBar } from '@/components/workbench/Workbench';

// one error: the engine's analysis failing
vi.mock('@/services', async (original) => ({
  ...(await original<typeof import('@/services')>()),
  analyze: () => {
    throw new Error('analysis failed');
  },
}));

describe('the status bar', () => {
  afterEach(() => cleanup());

  it('says "1 error" and "1 warning", not "1 errors"/"1 warnings"', async () => {
    let workbench: Workbench | null = null;
    const Probe = () => {
      workbench = useWorkbench();
      return null;
    };
    render(
      <WorkbenchProvider lockedEngine='edgev2'>
        <Probe />
        <StatusBar />
      </WorkbenchProvider>,
    );
    act(() => workbench!.setText('{"actors":[]}', 'open'));
    await vi.waitFor(() =>
      expect(workbench!.problems.some((p) => p.severity === 'error')).toBe(
        true,
      ),
    );
    // singular: exactly one error, none plural
    expect(screen.getByText((text) => text === '1 error')).toBeDefined();
    expect(screen.queryByText('1 errors')).toBeNull();
    // plural: none of either severity but the error
    expect(screen.getByText((text) => text === '0 warnings')).toBeDefined();
  });
});
