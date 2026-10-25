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
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import * as glspServerModule from '@/lib/workbench/glspServer';
import type { GlspServer } from '@/lib/workbench/glspServer';

const ISTAR = readFileSync(
  join(__dirname, '../../../../examples/edge/simpleChoice.txt'),
  'utf8',
);

/** A `startGlspServer` stand-in whose resolution the test controls, so it
 * can toggle `glspEnabled`/switch sessions while a call's promise is still
 * pending and observe the race guard in `WorkbenchContext`. Each call to
 * `startGlspServer` gets its own pending promise, queued in call order;
 * `settle()` resolves the oldest unsettled one. */
const deferredGlspServer = () => {
  const disposes: Array<ReturnType<typeof vi.fn>> = [];
  const resolvers: Array<(server: GlspServer) => void> = [];
  const spy = vi.spyOn(glspServerModule, 'startGlspServer').mockImplementation(
    () =>
      new Promise<GlspServer>((resolve) => {
        resolvers.push(resolve);
      }),
  );
  const settle = () => {
    const dispose = vi.fn();
    disposes.push(dispose);
    const resolve = resolvers.shift();
    if (!resolve) throw new Error('no pending startGlspServer call to settle');
    resolve({
      mcp: {
        url: new URL('http://localhost/'),
        fetch: vi.fn(),
        sessionId: 'x',
      },
      dispose,
    });
  };
  return { spy, settle, disposes };
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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

  it('toggled off before startGlspServer resolves: the server it was starting gets disposed, wb.glspMcp stays null', async () => {
    const { settle, disposes } = deferredGlspServer();
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));

    act(() => wb().setGlspEnabled(true));
    act(() => wb().setGlspEnabled(false));
    expect(wb().glspMcp).toBeNull();

    await act(async () => {
      settle();
      await Promise.resolve();
    });

    expect(disposes[0]).toHaveBeenCalledTimes(1);
    expect(wb().glspMcp).toBeNull();
  });

  it('on, off, on again quickly: exactly one live server at the end', async () => {
    const { settle, disposes } = deferredGlspServer();
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));

    act(() => wb().setGlspEnabled(true));
    act(() => wb().setGlspEnabled(false));
    act(() => wb().setGlspEnabled(true));

    await act(async () => {
      settle();
      await Promise.resolve();
    });
    expect(disposes[0]).toHaveBeenCalledTimes(1);

    settle();
    await waitFor(() => expect(wb().glspMcp).not.toBeNull());
    expect(disposes[1]).not.toHaveBeenCalled();
  });

  it('a session switch while the server is starting: the old session server is disposed, the new session gets its own', async () => {
    const { settle, disposes } = deferredGlspServer();
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    act(() => wb().setGlspEnabled(true));

    await act(() => wb().openModelFile('simpleChoice2.txt', ISTAR));

    await act(async () => {
      settle();
      await Promise.resolve();
    });
    expect(disposes[0]).toHaveBeenCalledTimes(1);
    expect(wb().glspMcp).toBeNull();

    settle();
    await waitFor(() => expect(wb().glspMcp).not.toBeNull());
    expect(disposes[1]).not.toHaveBeenCalled();
  });
});
