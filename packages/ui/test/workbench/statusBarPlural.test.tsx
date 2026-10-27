/** The status bar's error/warning counts read right in the singular (goal-controller#469). */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import { StatusBar } from '@/components/workbench/Workbench';
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

describe('the status bar', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('says "1 error" and "1 warning", not "1 errors"/"1 warnings"', async () => {
    let workbench: Workbench | null = null;
    const Probe = () => {
      workbench = useWorkbench();
      return null;
    };
    render(
      <WorkbenchProvider lockedEngine='edgev2'>
        <Probe />
        <StatusBar />
      </WorkbenchProvider>,
    );
    const text = '{"actors":[]}';
    act(() => workbench!.setText(text, 'open'));
    act(() =>
      engineWorkers[0]!.respond({
        type: 'analyzeFailed',
        key: analysisKey(text, 'edgev2'),
        message: 'analysis failed',
      }),
    );
    await vi.waitFor(() =>
      expect(workbench!.problems.some((p) => p.severity === 'error')).toBe(
        true,
      ),
    );
    // singular: exactly one error, none plural
    expect(screen.getByText((text) => text === '1 error')).toBeDefined();
    expect(screen.queryByText('1 errors')).toBeNull();
    // plural: none of either severity but the error
    expect(screen.getByText((text) => text === '0 warnings')).toBeDefined();
  });
});
