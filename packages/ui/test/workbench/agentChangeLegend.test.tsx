/**
 * The notation views' legend footer (goal-controller#415's mock): the node-id
 * colours always show; "Clear" (dropping every run's `agentChanges`) only
 * once a run actually added or edited something.
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react';
import React, { useEffect } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import AgentChangeLegend from '@/components/workbench/engines/definition/AgentChangeLegend';

const ISTAR = readFileSync(
  join(__dirname, '../../../../examples/edge/simpleChoice.txt'),
  'utf8',
);
const G1 = '117b97d7-775b-41a9-8fec-9e923edde772';

afterEach(() => cleanup());

const workbench = (body: React.ReactNode) => {
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
      {body}
    </WorkbenchProvider>,
  );
  return { wb: () => wb!, container: view.container };
};

const opened = async (body: React.ReactNode) => {
  const view = workbench(body);
  await act(() => view.wb().openModelFile('simpleChoice.txt', ISTAR));
  await waitFor(() => expect(view.wb().tree).not.toBeNull());
  return view;
};

describe('AgentChangeLegend', () => {
  it('always shows the AND/OR/Task/Added swatches, with no Clear button when nothing changed', async () => {
    const { container } = await opened(<AgentChangeLegend />);
    expect(container.textContent).toContain('AND refinement');
    expect(container.textContent).toContain('OR refinement');
    expect(container.textContent).toContain('Task');
    expect(container.textContent).toContain('Added');
    expect(container.querySelector('button[type="button"]')).toBeNull();
  });

  it('shows Clear once a run edited something, and it drops the change on click', async () => {
    const { wb, container } = await opened(<AgentChangeLegend />);

    act(() => wb().beginAgentChanges());
    await act(async () => {
      await wb()
        .dispatcherFor('inspector')
        .dispatch({ kind: 'applyLabelEdit', labelId: G1, text: 'Renamed' });
    });
    act(() => wb().endAgentChanges());
    await waitFor(() => expect(wb().agentChanges.edited.has(G1)).toBe(true));

    const clearButton = await waitFor(() => {
      const found = container.querySelector('button[type="button"]');
      expect(found).not.toBeNull();
      return found as HTMLButtonElement;
    });
    expect(clearButton.textContent).toBe('Clear');

    fireEvent.click(clearButton);
    await waitFor(() => expect(wb().agentChanges.edited.size).toBe(0));
    expect(container.querySelector('button[type="button"]')).toBeNull();
  });
});
