/**
 * The model worker's crash recovery (goal-controller#469, #479): an
 * `onerror`/`onmessageerror`, or a dispatch whose own `ack` never arrives
 * within its deadline (the worker is genuinely gone, not merely busy),
 * respawns the worker and replaces the session on the last derived
 * `wb.text` and the current mode, with a dismissible notice (the undo
 * history is lost). A dispatch that's merely slow — the worker's
 * dispatcher is single-threaded, so a big `replaceModel`, import or
 * Propose batch applies synchronously — only shows a non-fatal "taking
 * longer than expected" notice, with its own manual "Restart editor"
 * action (`restartModelWorker`); nothing recovers on its own for that case.
 * Every in-flight dispatch and `synced()` wait rejects on a real crash
 * instead of hanging, and the engine worker and the agent's session
 * reconnect on their own (both are keyed on the session's identity
 * already).
 *
 * jsdom has no `Worker`, so the model worker always runs in-process
 * (modelWorkerLocal.ts) here, real `onerror`/`onmessageerror` wiring and
 * all: `modelWorker()` (the module's own shared endpoint) is driven by hand,
 * the way a real worker's own handlers would be. Only the engine-worker
 * test needs a `Worker` stub at all (its hook skips entirely with none).
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import type { EngineWorkerResponse } from '@/lib/workbench/engineWorkerProtocol';
import {
  modelWorker,
  restartModelWorker,
} from '@/lib/workbench/modelWorkerClient';
import { createLocalModelWorker } from '@/lib/workbench/modelWorkerLocal';
import { writeModelMode } from '@/lib/workbench/pistar';
import type { AnalyzeResponse } from '@/lib/workbench/types';

const ISTAR = readFileSync(
  join(__dirname, '../../../../examples/edge/simpleChoice.txt'),
  'utf8',
);
// in simpleChoice.txt: one actor, G1 OR-refined into G2 and G3
const G1 = '117b97d7-775b-41a9-8fec-9e923edde772';

class FakeEngineWorker {
  onmessage: ((event: MessageEvent<EngineWorkerResponse>) => void) | null =
    null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  readonly posted: unknown[] = [];
  terminate = vi.fn();
  postMessage(data: unknown): void {
    this.posted.push(data);
  }
  respond(message: EngineWorkerResponse): void {
    this.onmessage?.({ data: message } as MessageEvent<EngineWorkerResponse>);
  }
}

let engineWorkers: FakeEngineWorker[] = [];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * The model session's own port (a real `MessagePort`, even in jsdom):
 * dropping or delaying what crosses it here simulates what a slow or
 * genuinely hung worker would do, without timing an actual apply
 * (goal-controller#479). `null`: every message passes through unpatched.
 */
let patchPort: ((data: unknown) => 'drop' | number | null) | null = null;
// the overloaded DOM signature (`Transferable[]` or `StructuredSerializeOptions`)
// has no single shape a plain function can satisfy structurally; this patch
// only ever needs `message` and forwards `transfer` through as given
type PostMessage = (
  this: MessagePort,
  message: unknown,
  transfer?: Transferable[],
) => void;
const originalPostMessage = MessagePort.prototype
  .postMessage as unknown as PostMessage;
function patchedPostMessage(
  this: MessagePort,
  message: unknown,
  transfer?: Transferable[],
): void {
  const action = patchPort?.(message) ?? null;
  if (action === 'drop') return;
  if (typeof action === 'number') {
    setTimeout(() => originalPostMessage.call(this, message, transfer), action);
    return;
  }
  originalPostMessage.call(this, message, transfer);
}

beforeEach(() => {
  engineWorkers = [];
  patchPort = null;
  MessagePort.prototype.postMessage =
    patchedPostMessage as unknown as typeof MessagePort.prototype.postMessage;
  // only the engine worker needs faking: its hook has no fallback for a
  // missing `Worker` at all, unlike the model worker's own (modelWorkerClient.ts)
  vi.stubGlobal(
    'Worker',
    class {
      constructor(url: URL) {
        if (url.pathname.endsWith('/modelWorker.ts'))
          return createLocalModelWorker();
        const worker = new FakeEngineWorker();
        engineWorkers.push(worker);
        return worker;
      }
    },
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  MessagePort.prototype.postMessage =
    originalPostMessage as unknown as typeof MessagePort.prototype.postMessage;
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
  return () => wb!;
};

const opened = async (text = ISTAR) => {
  const wb = workbench();
  await act(() => wb().openModelFile('simpleChoice.txt', text));
  await waitFor(() => expect(wb().tree).not.toBeNull());
  await act(() => wb().session.ready);
  return wb;
};

const nameOf = (wb: Workbench, id: string) =>
  wb.session.store.getModel().elements.get(id)?.name;

/** `modelWorker().onerror`, as a real worker's own crash would call it. */
const crashModelWorker = (message: string): void => {
  modelWorker().onerror?.({
    message,
    preventDefault: () => {},
  } as ErrorEvent);
};

describe('the model worker recovers from a crash (goal-controller#469)', () => {
  it('a crashed worker: the next edit works on the respawned one, the text is unchanged, the notice shows', async () => {
    const wb = await opened();
    const text = wb().text;

    act(() => crashModelWorker('the model worker died'));

    expect(wb().text).toBe(text);
    expect(wb().modelWorkerNotice).toMatch(/restarted/i);

    await act(async () => {
      const result = await wb()
        .dispatcherFor('canvas')
        .dispatch({ kind: 'applyLabelEdit', labelId: G1, text: 'G1: After' });
      expect(result.ok).toBe(true);
    });
    expect(nameOf(wb(), G1)).toBe('G1: After');
    // the new session's own history: one step, this edit, with nothing
    // from the crashed session's history behind it
    expect(wb().canUndo).toBe(true);
    await act(async () => {
      await wb().dispatcherFor('canvas').dispatch({ kind: 'glspUndo' });
    });
    expect(wb().canUndo).toBe(false);

    act(() => wb().dismissModelWorkerNotice());
    expect(wb().modelWorkerNotice).toBeNull();
  });

  it('an in-flight dispatch during a crash rejects, and so does a waiting synced()', async () => {
    const wb = await opened();

    const dispatched = wb()
      .dispatcherFor('canvas')
      .dispatch({ kind: 'applyLabelEdit', labelId: G1, text: 'G1: Hung' });
    const synced = wb().session.synced();
    // the crash is synchronous: it reaches `raceCrash`'s listeners before
    // the in-process host's own answer (a microtask away) ever does
    act(() => crashModelWorker('the model worker died'));

    await expect(dispatched).rejects.toThrow(/model worker died/);
    await expect(synced).rejects.toThrow(/model worker died/);
  });

  it('an onmessageerror triggers the same recovery', async () => {
    const wb = await opened();
    const text = wb().text;

    act(() => modelWorker().onmessageerror?.({} as MessageEvent));

    expect(wb().text).toBe(text);
    expect(wb().modelWorkerNotice).toMatch(/restarted/i);
  });

  it('a 20s dispatch completes with no recovery and no undo loss, the slow notice shown then cleared', async () => {
    const wb = await opened();
    vi.useFakeTimers();
    // the dispatch's own JSON-RPC answer, held back 20s: the worker still
    // acks it at once (goal-controller#479), so this never reads as a crash
    patchPort = (data) =>
      isRecord(data) && data.jsonrpc === '2.0' && 'result' in data
        ? 20_000
        : null;

    const dispatched = wb()
      .dispatcherFor('canvas')
      .dispatch({ kind: 'applyLabelEdit', labelId: G1, text: 'G1: Slow' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000);
    });
    expect(wb().modelWorkerSlow).toBe(true);
    expect(wb().modelWorkerNotice).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });
    const result = await dispatched;

    expect(result.ok).toBe(true);
    expect(wb().modelWorkerSlow).toBe(false);
    expect(wb().modelWorkerNotice).toBeNull();
    expect(nameOf(wb(), G1)).toBe('G1: Slow');
    expect(wb().canUndo).toBe(true);

    vi.useRealTimers();
    patchPort = null;
  });

  it('a worker that stops acking is recovered automatically', async () => {
    const wb = await opened();
    const text = wb().text;
    vi.useFakeTimers();
    // every message the worker's end of the port would send is lost: a
    // dead worker's dispatch never resolves either, not only its own ack
    patchPort = () => 'drop';

    void wb()
      .dispatcherFor('canvas')
      .dispatch({ kind: 'applyLabelEdit', labelId: G1, text: 'G1: Hung' })
      .catch(() => undefined);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_001);
    });

    expect(wb().text).toBe(text);
    expect(wb().modelWorkerNotice).toMatch(/restarted/i);

    vi.useRealTimers();
    patchPort = null;
  });

  it('a stale error from an already-replaced worker is ignored (goal-controller#479 review)', async () => {
    const wb = await opened();
    const staleWorker = modelWorker();

    act(() => crashModelWorker('the model worker died'));
    const text = wb().text;
    const incident = wb().modelWorkerIncident;
    expect(modelWorker()).not.toBe(staleWorker);

    // a late event from the now-terminated worker (`terminate()` stops
    // further script execution but doesn't cancel an already-queued
    // error's delivery) must not tear down the one that replaced it
    act(() =>
      staleWorker.onerror?.({
        message: 'late error from the dead worker',
        preventDefault: () => {},
      } as ErrorEvent),
    );

    expect(wb().modelWorkerIncident).toBe(incident);
    expect(wb().text).toBe(text);
  });

  it('the manual restart action recovers on demand', async () => {
    const wb = await opened();
    const text = wb().text;

    act(() => restartModelWorker());

    expect(wb().text).toBe(text);
    expect(wb().modelWorkerNotice).toMatch(/restarted/i);

    await act(async () => {
      const result = await wb()
        .dispatcherFor('canvas')
        .dispatch({ kind: 'applyLabelEdit', labelId: G1, text: 'G1: After' });
      expect(result.ok).toBe(true);
    });
    expect(nameOf(wb(), G1)).toBe('G1: After');
  });

  it('the engine worker reconnects (analysis updates after the crash)', async () => {
    const wb = await opened(writeModelMode(ISTAR, 'edgev2'));
    await waitFor(() => expect(engineWorkers).toHaveLength(1));
    const engineWorker = engineWorkers[0]!;

    act(() => crashModelWorker('the model worker died'));
    await waitFor(() =>
      expect(
        engineWorker.posted.filter(
          (message) => (message as { type: string }).type === 'connect',
        ).length,
      ).toBeGreaterThan(1),
    );

    const response: AnalyzeResponse = {
      success: true,
      variables: [],
      problems: [],
      knownProperties: { goal: [], task: [], resource: [], quality: [] },
    };
    await act(async () => {
      engineWorker.respond({
        type: 'analyzed',
        key: 'after-crash',
        data: response,
      });
    });
    await waitFor(() => expect(wb().analysis).toEqual(response));
  });
});
