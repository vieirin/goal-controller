/**
 * A diagnostic with `data.elementId` (the goal language LSP's,
 * goal-controller#416) becomes a marker on that element in the canvas,
 * through the same diagnostics store the LSP already publishes to
 * (`publishDiagnostics`, `lib/workbench/diagnosticsStore.ts`). The canvas
 * reads it from `useIstarEditor().diagnosticsById`.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import React, { useEffect } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useIstarEditor, type IstarEditor } from '@istar-ts/react';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import WorkbenchCanvas from '@/components/workbench/engines/shared/WorkbenchCanvas';
import { publishDiagnostics } from '@/lib/workbench/diagnosticsStore';
import { writeModelMode } from '@/lib/workbench/pistar';
import { mockReactFlowDom } from './reactFlowDom';

// recorded as edgev2 (not piStar mode): the Problems memo only merges the
// service-published diagnostics for a dialect engine's model, same as #433
const ISTAR = writeModelMode(
  readFileSync(
    join(__dirname, '../../../../examples/edge/simpleChoice.txt'),
    'utf8',
  ),
  'edgev2',
);
// in simpleChoice.txt: G1 (its RT id), OR-refined into G2 and G3. The
// diagnostic is published by its RT id, as the LSP reports it; the canvas
// remaps it to the model's own id (goal-tree's GoalViewNode.iStarId), which
// `useIstarEditor().diagnosticsById` keys by.
const G1_ISTAR_ID = '117b97d7-775b-41a9-8fec-9e923edde772';

beforeAll(mockReactFlowDom);
afterEach(() => cleanup());

const workbench = () => {
  let wb: Workbench | null = null;
  let editor: IstarEditor | null = null;
  const Probe = () => {
    const current = useWorkbench();
    useEffect(() => {
      wb = current;
    });
    return null;
  };
  const EditorProbe = () => {
    const current = useIstarEditor();
    useEffect(() => {
      editor = current;
    });
    return null;
  };
  render(
    <WorkbenchProvider lockedEngine={null}>
      <Probe />
      <WorkbenchCanvas extensions={[]} aside={<EditorProbe />} />
    </WorkbenchProvider>,
  );
  return { wb: () => wb!, editor: () => editor! };
};

describe('an elementId diagnostic as a canvas marker (#416)', () => {
  it('shows up on the element once published, and clears once retracted', async () => {
    const { wb, editor } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    await waitFor(() => expect(wb().tree).not.toBeNull());
    await waitFor(() => expect(editor()).not.toBeNull());

    expect(
      (editor().diagnosticsById.get(G1_ISTAR_ID) ?? []).some(
        (d) => d.message === 'bad',
      ),
    ).toBe(false);

    act(() => {
      publishDiagnostics('goal language', 'file:///notation.goal', [
        {
          severity: 'error',
          source: 'goal language',
          message: 'bad',
          elementId: 'G1',
        },
      ]);
    });

    await waitFor(() =>
      expect(wb().problems.some((p) => p.message === 'bad')).toBe(true),
    );
    await waitFor(() =>
      expect(
        (editor().diagnosticsById.get(G1_ISTAR_ID) ?? []).some(
          (d) => d.message === 'bad',
        ),
      ).toBe(true),
    );

    act(() => {
      publishDiagnostics('goal language', 'file:///notation.goal', []);
    });

    await waitFor(() =>
      expect(
        (editor().diagnosticsById.get(G1_ISTAR_ID) ?? []).some(
          (d) => d.message === 'bad',
        ),
      ).toBe(false),
    );
  });
});
