/**
 * `wb.setGlspEnabled`/`wb.glspSession` (goal-controller#414, #450): backend
 * A's session starts lazily, over the open session's own store and
 * dispatcher, and is torn down with it. `openGlspSession` is mocked
 * throughout (`openGlspMcpSession`'s own MCP connect mixes jsdom's and
 * Node's `AbortSignal` under jsdom): its tools and change set (tools/list,
 * edits, rejections, Propose's preview) are exercised for real in
 * `test/workbench/agentTools.test.ts`, a Node test, where there is only one
 * realm. This file is only the lifecycle: open, close, one session at a
 * time, torn down on a session switch or an unmount.
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
import * as glspSessionModule from '@/lib/workbench/agent/glspSession';
import type { GlspSession } from '@/lib/workbench/agent/glspSession';

const ISTAR = readFileSync(
  join(__dirname, '../../../../examples/edge/simpleChoice.txt'),
  'utf8',
);

/** An `openGlspSession` stand-in whose resolution the test controls, so it
 * can toggle `glspEnabled`/switch sessions while a call's promise is still
 * pending and observe the race guard in `WorkbenchContext`. Each call to
 * `openGlspSession` gets its own pending promise, queued in call order;
 * `settle()` resolves the oldest unsettled one. */
const deferredGlspSession = () => {
  const closes: Array<ReturnType<typeof vi.fn>> = [];
  const resolvers: Array<(session: GlspSession) => void> = [];
  const spy = vi.spyOn(glspSessionModule, 'openGlspSession').mockImplementation(
    () =>
      new Promise<GlspSession>((resolve) => {
        resolvers.push(resolve);
      }),
  );
  const settle = () => {
    const close = vi.fn();
    closes.push(close);
    const resolve = resolvers.shift();
    if (!resolve) throw new Error('no pending openGlspSession call to settle');
    resolve({
      liveRegistry: {
        list: () => [],
        call: async () => ({ ok: true, content: null }),
      },
      changeSet: {
        openScratch: async () => ({
          registry: {
            list: () => [],
            call: async () => ({ ok: true, content: null }),
          },
        }),
        apply: async () => ({ ok: true, content: null, createdIds: [] }),
        step: () => undefined,
        describeUndo: () => undefined,
      },
      close,
    });
  };
  return { spy, settle, closes };
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
  const { unmount } = render(
    <WorkbenchProvider lockedEngine={null}>
      <Probe />
    </WorkbenchProvider>,
  );
  return { wb: () => wb!, unmount };
};

describe("backend A's session over the workbench session, lazily (#414, #450)", () => {
  it('off until wb.setGlspEnabled(true): wb.glspSession stays null', async () => {
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    expect(wb().glspEnabled).toBe(false);
    expect(wb().glspSession).toBeNull();
  });

  it('turned on, it starts and gives a session (liveRegistry, changeSet, close)', async () => {
    const { settle } = deferredGlspSession();
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));

    act(() => wb().setGlspEnabled(true));
    await act(async () => {
      settle();
      await Promise.resolve();
    });
    await waitFor(() => expect(wb().glspSession).not.toBeNull());

    const glsp = wb().glspSession!;
    expect(typeof glsp.liveRegistry.list).toBe('function');
    expect(typeof glsp.changeSet.apply).toBe('function');
    expect(typeof glsp.close).toBe('function');
  });

  it('turned off again, wb.glspSession goes back to null', async () => {
    const { settle } = deferredGlspSession();
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    act(() => wb().setGlspEnabled(true));
    await act(async () => {
      settle();
      await Promise.resolve();
    });
    await waitFor(() => expect(wb().glspSession).not.toBeNull());

    act(() => wb().setGlspEnabled(false));
    expect(wb().glspSession).toBeNull();
  });

  it('opening another file restarts the session (a fresh one)', async () => {
    const { settle } = deferredGlspSession();
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    act(() => wb().setGlspEnabled(true));
    await act(async () => {
      settle();
      await Promise.resolve();
    });
    await waitFor(() => expect(wb().glspSession).not.toBeNull());
    const first = wb().glspSession;

    await act(() => wb().openModelFile('simpleChoice2.txt', ISTAR));
    await act(async () => {
      settle();
      await Promise.resolve();
    });
    await waitFor(() => expect(wb().glspSession).not.toBeNull());
    expect(wb().glspSession).not.toBe(first);
  });

  it('toggled off before openGlspSession resolves: the session it was starting gets closed, wb.glspSession stays null', async () => {
    const { settle, closes } = deferredGlspSession();
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));

    act(() => wb().setGlspEnabled(true));
    act(() => wb().setGlspEnabled(false));
    expect(wb().glspSession).toBeNull();

    await act(async () => {
      settle();
      await Promise.resolve();
    });

    expect(closes[0]).toHaveBeenCalledTimes(1);
    expect(wb().glspSession).toBeNull();
  });

  it('on, off, on again quickly: exactly one live session at the end', async () => {
    const { settle, closes } = deferredGlspSession();
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));

    act(() => wb().setGlspEnabled(true));
    act(() => wb().setGlspEnabled(false));
    act(() => wb().setGlspEnabled(true));

    await act(async () => {
      settle();
      await Promise.resolve();
    });
    expect(closes[0]).toHaveBeenCalledTimes(1);

    settle();
    await waitFor(() => expect(wb().glspSession).not.toBeNull());
    expect(closes[1]).not.toHaveBeenCalled();
  });

  it('unmounting disposes the live session', async () => {
    const { settle, closes } = deferredGlspSession();
    const { wb, unmount } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    act(() => wb().setGlspEnabled(true));
    await act(async () => {
      settle();
      await Promise.resolve();
    });
    await waitFor(() => expect(wb().glspSession).not.toBeNull());

    unmount();

    expect(closes[0]).toHaveBeenCalledTimes(1);
  });

  it('a session switch while the session is starting: the old session is closed, the new session gets its own', async () => {
    const { settle, closes } = deferredGlspSession();
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    act(() => wb().setGlspEnabled(true));

    await act(() => wb().openModelFile('simpleChoice2.txt', ISTAR));

    await act(async () => {
      settle();
      await Promise.resolve();
    });
    expect(closes[0]).toHaveBeenCalledTimes(1);
    expect(wb().glspSession).toBeNull();

    settle();
    await waitFor(() => expect(wb().glspSession).not.toBeNull());
    expect(closes[1]).not.toHaveBeenCalled();
  });
});
