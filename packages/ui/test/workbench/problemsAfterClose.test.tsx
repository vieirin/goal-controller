/**
 * An analysis failure (goal-controller issue), closed over: once an engine's
 * analyse throws (its own bug, or a stale build), the Problems count must
 * drop to zero as soon as the model is closed. Before the fix, the badge
 * and status bar still counted the stale analysis problem while the
 * Problems view itself said "No model open." — counts and the view
 * disagreed.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import type { EngineWorkerResponse } from '@/lib/workbench/engineWorkerProtocol';
import { createLocalModelWorker } from '@/lib/workbench/modelWorkerLocal';
import { analysisKey } from '@/lib/workbench/signature';

// jsdom has no real Worker (engineWorker.test.tsx): fake the engine worker so
// its analysis failure arrives the way the real worker's would, over
// `postMessage`; the model worker still runs for real, in-process
class FakeWorker {
  onmessage: ((event: MessageEvent<EngineWorkerResponse>) => void) | null =
    null;
  terminate = vi.fn();
  postMessage(): void {}
  respond(message: EngineWorkerResponse): void {
    this.onmessage?.({ data: message } as MessageEvent<EngineWorkerResponse>);
  }
}

let engineWorkers: FakeWorker[] = [];

beforeEach(() => {
  engineWorkers = [];
  vi.stubGlobal(
    'Worker',
    class {
      constructor(url: URL) {
        if (url.pathname.endsWith('/modelWorker.ts'))
          return createLocalModelWorker();
        const worker = new FakeWorker();
        engineWorkers.push(worker);
        return worker;
      }
    },
  );
});

describe('problems after the model closes', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('drops to zero once an analysis failure’s model is closed', async () => {
    let workbench: Workbench | null = null;
    const Probe = () => {
      workbench = useWorkbench();
      return null;
    };
    render(
      <WorkbenchProvider lockedEngine='edgev2'>
        <Probe />
      </WorkbenchProvider>,
    );
    const text = '{"actors":[]}';
    act(() => workbench!.setText(text, 'open'));
    act(() =>
      engineWorkers[0]!.respond({
        type: 'analyzeFailed',
        key: analysisKey(text, 'edgev2'),
        message: '(0 , import_dialect10.propertyOf) is not a function',
      }),
    );
    await waitFor(() =>
      expect(workbench!.problems.some((p) => p.severity === 'error')).toBe(
        true,
      ),
    );
    act(() => workbench!.closeModel());
    expect(workbench!.hasModel).toBe(false);
    expect(workbench!.problems).toEqual([]);
  });
});
