/**
 * `wb.setGlspEnabled`/`wb.glspMcp` (goal-controller#414): a headless GLSP
 * server starts lazily, over the open session's own store and dispatcher,
 * and is torn down with it. The MCP traffic itself (tools/list, edits,
 * rejections) is exercised in `test/workbench/glspMcp.test.ts`, a Node
 * test: an MCP SDK client's `fetch` mixes jsdom's and Node's `AbortSignal`
 * under jsdom, so that part runs where there is only one realm.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
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
  return { wb: () => wb! };
};

describe('a GLSP server over the workbench session, lazily (#414)', () => {
  it('off until wb.setGlspEnabled(true): wb.glspMcp stays null', async () => {
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    expect(wb().glspEnabled).toBe(false);
    expect(wb().glspMcp).toBeNull();
  });

  it('turned on, it starts and gives an MCP handle (url, fetch, sessionId)', async () => {
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));

    act(() => wb().setGlspEnabled(true));
    await waitFor(() => expect(wb().glspMcp).not.toBeNull());

    const mcp = wb().glspMcp!;
    expect(mcp.url).toBeInstanceOf(URL);
    expect(typeof mcp.fetch).toBe('function');
    expect(mcp.sessionId).toBeTruthy();
  });

  it('turned off again, wb.glspMcp goes back to null', async () => {
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    act(() => wb().setGlspEnabled(true));
    await waitFor(() => expect(wb().glspMcp).not.toBeNull());

    act(() => wb().setGlspEnabled(false));
    expect(wb().glspMcp).toBeNull();
  });

  it('opening another file restarts the server (a fresh MCP handle)', async () => {
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    act(() => wb().setGlspEnabled(true));
    await waitFor(() => expect(wb().glspMcp).not.toBeNull());
    const first = wb().glspMcp;

    await act(() => wb().openModelFile('simpleChoice2.txt', ISTAR));
    await waitFor(() => expect(wb().glspMcp).not.toBeNull());
    expect(wb().glspMcp).not.toBe(first);
  });
});
