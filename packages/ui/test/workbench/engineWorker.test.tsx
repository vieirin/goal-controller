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
  readonly posted: unknown[] = [];
  terminate = vi.fn();
  postMessage(data: unknown): void {
    this.posted.push(data);
  }
  respond(message: EngineWorkerResponse): void {
    this.onmessage?.({ data: message } as MessageEvent<EngineWorkerResponse>);
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
});
