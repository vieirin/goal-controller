/**
 * The tree (goal-tree's `GoalView`) is read from the session store's model
 * (goal-controller#449), not by re-parsing `wb.text`: a canvas edit updates
 * the tree with just the one parse SourceView's JSON check keeps, and the
 * tree's identity is stable across a render that changes nothing.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import React, { useEffect } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useIstarEditor, type IstarEditor } from '@istar-ts/react';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import WorkbenchCanvas from '@/components/workbench/engines/shared/WorkbenchCanvas';
import * as dialects from '@/lib/workbench/dialects';
import { mockReactFlowDom } from './reactFlowDom';

const ISTAR = readFileSync(
  join(__dirname, '../../../../examples/edge/simpleChoice.txt'),
  'utf8',
);
// simpleChoice.txt's G1, OR-refined into G2 and G3
const G2 = '10d8d506-1fd6-4808-b711-86dba7aca2f0';

beforeAll(mockReactFlowDom);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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
  const view = render(
    <WorkbenchProvider lockedEngine={null}>
      <Probe />
      <WorkbenchCanvas extensions={[]} aside={<EditorProbe />} />
    </WorkbenchProvider>,
  );
  return { wb: () => wb!, editor: () => editor!, container: view.container };
};

const opened = async () => {
  const view = workbench();
  await act(() => view.wb().openModelFile('simpleChoice.txt', ISTAR));
  await waitFor(() => expect(view.wb().tree).not.toBeNull());
  await waitFor(() => expect(view.editor()).not.toBeNull());
  return view;
};

describe('the tree comes from the store, not from re-parsing wb.text (#449)', () => {
  it('a canvas edit updates the tree with no extra parse (just SourceView’s JSON check)', async () => {
    const { wb, editor } = await opened();
    const parseModel = vi.spyOn(dialects, 'parseModel');
    parseModel.mockClear();
    const tree = wb().tree;
    const { x, y } = wb().session.store.getModel().elements.get(G2)!;

    await act(async () => {
      const result = await editor()
        .dispatcherFor('canvas')
        .dispatch({
          kind: 'changeBounds',
          newBounds: [{ elementId: G2, newPosition: { x: x + 40, y: y + 10 } }],
        });
      expect(result.ok).toBe(true);
    });

    expect(wb().tree).not.toBe(tree);
    // one parse: the browser's own JSON check on the newly serialized text
    // (parsed.error), not a second one to build the tree or check a framework
    expect(parseModel).toHaveBeenCalledTimes(1);
  });

  it('the tree’s identity is stable when nothing changed', async () => {
    const { wb } = await opened();
    const tree = wb().tree;
    // a render with no model or engine change keeps the same tree
    await act(async () => {});
    expect(wb().tree).toBe(tree);
  });
});
