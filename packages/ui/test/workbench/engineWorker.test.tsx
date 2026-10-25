/**
 * The engine worker (goal-controller#413): a dispatched edit updates
 * `wb.analysis`/`wb.problems` only after the worker's own message comes
 * back, not synchronously within the dispatch's tick. jsdom has no real
 * `Worker`, so this fakes one and drives its `onmessage` by hand, the way
 * the real worker's response would arrive over `postMessage`.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { useEffect } from 'react';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import type { EngineWorkerResponse } from '@/lib/workbench/engineWorkerProtocol';
import type { AnalyzeResponse } from '@/lib/workbench/types';
import { writeModelMode } from '@/lib/workbench/pistar';
import { analysisKey } from '@/lib/workbench/signature';

// recorded as edgev2 (not piStar mode): analysis only runs for an engine
const ISTAR = writeModelMode(
  readFileSync(
    join(__dirname, '../../../../examples/edge/simpleChoice.txt'),
    'utf8',
  ),
  'edgev2',
);
// in simpleChoice.txt: G1, OR-refined into G2 and G3
const G1 = '117b97d7-775b-41a9-8fec-9e923edde772';

class FakeWorker {
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
  crash(message: string): void {
    this.onerror?.({ message, preventDefault: () => {} } as ErrorEvent);
  }
  sendUnreadable(): void {
    this.onmessageerror?.({} as MessageEvent);
  }
}

let workers: FakeWorker[] = [];

beforeEach(() => {
  workers = [];
  vi.stubGlobal(
    'Worker',
    class {
      constructor() {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker;
      }
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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

const response: AnalyzeResponse = {
  success: true,
  variables: [],
  problems: [
    { severity: 'error', source: 'Edge', message: 'bad', elementId: G1 },
  ],
  knownProperties: { goal: [], task: [], resource: [], quality: [] },
};

describe('the engine worker (#413)', () => {
  it('updates analysis/problems only once the worker answers, not within the dispatch', async () => {
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));

    expect(workers).toHaveLength(1);
    const worker = workers[0]!;
    // the mirror's port, and the current engine, went out already
    expect(
      worker.posted.some(
        (message) => (message as { type: string }).type === 'connect',
      ),
    ).toBe(true);
    const configured = worker.posted.filter(
      (message) => (message as { type: string }).type === 'configure',
    );
    expect(configured.at(-1)).toEqual({
      type: 'configure',
      engine: 'edgev2',
      pistar: false,
    });

    expect(wb().analysis).toBeNull();
    await act(async () => {
      const result = await wb()
        .dispatcherFor('canvas')
        .dispatch({ kind: 'applyLabelEdit', labelId: G1, text: 'Renamed' });
      expect(result.ok).toBe(true);
    });
    // the edit applied, but the worker hasn't answered yet
    expect(wb().analysis).toBeNull();
    expect(
      wb().problems.some((p) => p.elementId === G1 && p.message === 'bad'),
    ).toBe(false);

    await act(async () => {
      worker.respond({ type: 'analyzed', key: 'k', data: response });
    });
    await waitFor(() => expect(wb().analysis).toEqual(response));
    await waitFor(() =>
      expect(
        wb().problems.some((p) => p.elementId === G1 && p.message === 'bad'),
      ).toBe(true),
    );
  });

  const lastTransformRequestId = (worker: FakeWorker): number => {
    const sent = worker.posted
      .filter(
        (
          message,
        ): message is { type: 'transform'; options: { requestId: number } } =>
          (message as { type: string }).type === 'transform',
      )
      .at(-1);
    if (!sent) throw new Error('no transform message was posted');
    return sent.options.requestId;
  };

  it('an engine throw comes back as a failed run, not a hang (goal-controller#432 review)', async () => {
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    const worker = workers[0]!;
    // variables ready: the key the worker would have answered with
    await act(async () => {
      worker.respond({
        type: 'analyzed',
        key: analysisKey(ISTAR, 'edgev2'),
        data: response,
      });
    });
    await waitFor(() => expect(wb().analyzing).toBe(false));

    act(() => wb().generate());
    await waitFor(() => expect(wb().generating).toBe(true));
    const requestId = lastTransformRequestId(worker);
    await act(async () => {
      worker.respond({
        type: 'transformed',
        outcome: {
          requestId,
          modelSignature: analysisKey(ISTAR, 'edgev2'),
          ok: false,
          error: 'the engine threw',
        },
      });
    });
    await waitFor(() => expect(wb().generating).toBe(false));
    expect(wb().runs[0]?.error).toBe('the engine threw');
    expect(wb().runs[0]?.files).toBeNull();
  });

  it('a worker crash fails every pending transform, clears analyzing/generating, and respawns (goal-controller#432 review)', async () => {
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    const worker = workers[0]!;
    await act(async () => {
      worker.respond({
        type: 'analyzed',
        key: analysisKey(ISTAR, 'edgev2'),
        data: response,
      });
    });
    await waitFor(() => expect(wb().analyzing).toBe(false));

    act(() => wb().generate());
    await waitFor(() => expect(wb().generating).toBe(true));

    await act(async () => {
      worker.crash('the engine worker died');
    });

    await waitFor(() => expect(wb().generating).toBe(false));
    expect(wb().runs[0]?.error).toBe('the engine worker died');
    await waitFor(() =>
      expect(
        wb().problems.some((p) => p.message === 'the engine worker died'),
      ).toBe(true),
    );
    expect(wb().analyzing).toBe(false);

    // a fresh worker, reconnected and reconfigured, for the next request
    await waitFor(() => expect(workers).toHaveLength(2));
    const respawned = workers[1]!;
    expect(
      respawned.posted.some(
        (message) => (message as { type: string }).type === 'connect',
      ),
    ).toBe(true);
    expect(
      respawned.posted.some(
        (message) => (message as { type: string }).type === 'configure',
      ),
    ).toBe(true);
  });
});
